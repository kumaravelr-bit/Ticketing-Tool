const nodemailer = require("nodemailer");
require("dotenv").config();

const transporterCache = new Map();

const normalizeCandidate = (value) => String(value || "").trim();
const isTrue = (value, fallback = false) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "on"].includes(text);
};
const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const deriveAtStyleUser = (value) => {
  const text = normalizeCandidate(value);
  if (!text || text.includes("@")) return "";

  const parts = text.split(".");
  if (parts.length < 2) return "";

  return `${parts[0]}@${parts.slice(1).join(".")}`;
};

const getMailAuthCandidates = () => {
  const rawCandidates = [
    process.env.MAIL_AUTH_USER,
    process.env.MAIL_USER,
    deriveAtStyleUser(process.env.MAIL_USER),
    process.env.MAIL_FROM,
  ];

  return [...new Set(rawCandidates.map(normalizeCandidate).filter(Boolean))];
};

const getMailPassword = () => normalizeCandidate(process.env.MAIL_PASS);

const getConfiguredPorts = () => {
  const primaryPort = toNumber(process.env.MAIL_PORT, 465);
  const extraPorts = String(process.env.MAIL_FALLBACK_PORTS || "587")
    .split(",")
    .map((value) => toNumber(value.trim(), 0))
    .filter(Boolean);

  return [...new Set([primaryPort, ...extraPorts])];
};

const getTransportConfig = (authUser, portOverride) => {
  const port = toNumber(portOverride, toNumber(process.env.MAIL_PORT, 465));
  const secure = port === 465;

  return {
    host: process.env.MAIL_HOST || "mail.infonetsmart.com",
    port,
    secure,
    requireTLS: secure ? false : true,
    name: "infonetsmart.com",
    family: 4,
    connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT || 15000),
    tls: {
      servername: process.env.MAIL_HOST || "mail.infonetsmart.com",
      rejectUnauthorized: isTrue(
        process.env.MAIL_TLS_REJECT_UNAUTHORIZED,
        false
      ),
      minVersion: process.env.MAIL_TLS_MIN_VERSION || "TLSv1.2",
    },
    auth: {
      user: authUser,
      pass: getMailPassword(),
    },
    pool: true,
    maxConnections: Number(process.env.MAIL_POOL_MAX_CONNECTIONS || 5),
    maxMessages: Number(process.env.MAIL_POOL_MAX_MESSAGES || 100),
    rateDelta: Number(process.env.MAIL_RATE_DELTA || 1000),
    rateLimit: Number(process.env.MAIL_RATE_LIMIT || 5),
    logger: false,
    debug: false,
  };
};

const getTransportConfigs = (authUser) =>
  getConfiguredPorts().map((port) => {
    const isPrimaryPort = port === toNumber(process.env.MAIL_PORT, 465);
    const secure = isPrimaryPort
      ? isTrue(process.env.MAIL_SECURE, port === 465)
      : port === 465;

    return {
      ...getTransportConfig(authUser, port),
      secure,
      requireTLS: secure
        ? false
        : isPrimaryPort
        ? isTrue(process.env.MAIL_REQUIRE_TLS, false)
        : true,
    };
  });

const buildTransport = (authUser, portOverride) =>
  nodemailer.createTransport(getTransportConfig(authUser, portOverride));

const getCacheKey = (transportConfig) =>
  [
    transportConfig.host,
    transportConfig.port,
    transportConfig.secure ? "secure" : "starttls",
    transportConfig.auth?.user || "",
  ].join("|");

const getCachedTransporter = (transportConfig) => {
  const cacheKey = getCacheKey(transportConfig);
  const cached = transporterCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const entry = {
    cacheKey,
    transporter: nodemailer.createTransport(transportConfig),
    verified: false,
    verifying: null,
  };

  transporterCache.set(cacheKey, entry);
  return entry;
};

const ensureTransportVerified = async (entry) => {
  if (entry.verified) {
    return;
  }

  if (!entry.verifying) {
    entry.verifying = entry.transporter.verify()
      .then(() => {
        entry.verified = true;
      })
      .finally(() => {
        entry.verifying = null;
      });
  }

  await entry.verifying;
};

const clearCachedTransporter = (cacheKey) => {
  const entry = transporterCache.get(cacheKey);
  if (!entry) return;

  transporterCache.delete(cacheKey);
  try {
    entry.transporter.close();
  } catch {
    // Ignore cleanup errors while resetting bad transporters.
  }
};

const getFromAddress = (fallbackName = "HR System") =>
  `"${fallbackName}" <${process.env.MAIL_FROM || process.env.MAIL_USER || ""}>`;

const sendMailWithFallback = async (message, fallbackName = "HR System") => {
  const candidates = getMailAuthCandidates();
  let lastError = null;

  if (!candidates.length) {
    const error = new Error("SMTP username is not configured");
    error.code = "EMAIL_CONFIG_MISSING";
    throw error;
  }

  if (!getMailPassword()) {
    const error = new Error("SMTP password is not configured");
    error.code = "EMAIL_CONFIG_MISSING";
    throw error;
  }

  for (const candidate of candidates) {
    for (const transportConfig of getTransportConfigs(candidate)) {
      const transportEntry = getCachedTransporter(transportConfig);
      try {
        await ensureTransportVerified(transportEntry);

        return await transportEntry.transporter.sendMail({
          ...message,
          from: message.from || getFromAddress(fallbackName),
        });
      } catch (error) {
        lastError = error;

        const isConnectionError =
          error?.code === "ESOCKET" ||
          error?.code === "ECONNRESET" ||
          error?.code === "ETIMEDOUT" ||
          error?.command === "CONN";

        if (isConnectionError) {
          clearCachedTransporter(transportEntry.cacheKey);
          continue;
        }

        if (error?.code === "EAUTH") {
          clearCachedTransporter(transportEntry.cacheKey);
          continue;
        }

        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  const error = new Error("Unable to send mail");
  error.code = "EMAIL_UNKNOWN";
  throw error;
};

const getReadableMailError = (error) => {
  if (!error) return "Mail error";

  if (error.code === "EAUTH") {
    return "SMTP authentication failed. Check MAIL_USER / MAIL_AUTH_USER / MAIL_PASS in backend .env";
  }

  if (error.code === "EMAIL_CONFIG_MISSING") {
    return "SMTP configuration is incomplete. Check MAIL_USER, MAIL_AUTH_USER, and MAIL_PASS in backend .env";
  }

  if (
    error.code === "ESOCKET" ||
    error.code === "ECONNRESET" ||
    error.errno === -4077 ||
    error.command === "CONN"
  ) {
    return "SMTP connection to mail.infonetsmart.com was reset. Check MAIL_HOST, MAIL_PORT, MAIL_SECURE, firewall access, and the mail server SSL/TLS settings.";
  }

  if (error.code === "ETIMEDOUT") {
    return "SMTP connection timed out. The app tried mail.infonetsmart.com but the server did not respond in time. Check the active SMTP port, firewall access, and whether the server expects SSL on 465 or STARTTLS on 587.";
  }

  return error.message || "Mail error";
};

module.exports = {
  buildTransport,
  getReadableMailError,
  getFromAddress,
  getMailAuthCandidates,
  getMailPassword,
  getTransportConfig,
  getTransportConfigs,
  sendMailWithFallback,
};
