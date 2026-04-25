const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isTrue = (value, fallback = false) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "on"].includes(text);
};

const host = process.env.MAIL_HOST || "mail.infonetsmart.com";
const authUser = process.env.MAIL_AUTH_USER || process.env.MAIL_USER;
const fromAddress = process.env.MAIL_FROM || process.env.MAIL_USER;
const password = process.env.MAIL_PASS || "";

const configuredPrimaryPort = toNumber(process.env.MAIL_PORT, 465);
const fallbackPorts = String(process.env.MAIL_FALLBACK_PORTS || "587")
  .split(",")
  .map((value) => toNumber(value.trim(), 0))
  .filter(Boolean);

const portsToTry = [...new Set([configuredPrimaryPort, ...fallbackPorts])];

console.log("MAIL_HOST =", host);
console.log("MAIL_PORT =", configuredPrimaryPort);
console.log("MAIL_USER =", process.env.MAIL_USER);
console.log("MAIL_AUTH_USER =", process.env.MAIL_AUTH_USER);
console.log("MAIL_FROM =", process.env.MAIL_FROM);
console.log("PORTS_TO_TRY =", portsToTry.join(", "));

const createTransportConfig = (port) => {
  const secure = port === 465;

  return {
    host,
    port,
    secure,
    requireTLS: !secure,
    family: 4,
    auth: {
      user: authUser,
      pass: password,
    },
    tls: {
      servername: host,
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: true,
    debug: true,
  };
};

const getReadableError = (error) => {
  if (!error) return "Unknown mail error";

  if (error.code === "EAUTH") {
    return "SMTP authentication failed. Check MAIL_AUTH_USER / MAIL_USER / MAIL_PASS.";
  }

  if (error.code === "ETIMEDOUT") {
    return "SMTP connection timed out. The SMTP server/port is reachable by DNS but not accepting connection from this environment.";
  }

  if (
    error.code === "ESOCKET" ||
    error.code === "ECONNRESET" ||
    error.code === "ECONNREFUSED" ||
    error.command === "CONN"
  ) {
    return "SMTP connection failed. Check active SMTP port, firewall rules, and SSL/TLS mode.";
  }

  return error.message || "Mail error";
};

(async () => {
  let lastError = null;

  if (!authUser) {
    console.error("SMTP TEST ERROR: MAIL_AUTH_USER / MAIL_USER is missing");
    process.exit(1);
  }

  if (!password) {
    console.error("SMTP TEST ERROR: MAIL_PASS is missing");
    process.exit(1);
  }

  for (const port of portsToTry) {
    try {
      console.log(`\nTrying SMTP on port ${port} ...`);

      const transporter = nodemailer.createTransport(createTransportConfig(port));

      await transporter.verify();
      console.log(`SMTP VERIFY SUCCESS on port ${port}`);

      const info = await transporter.sendMail({
        from: `"HR System" <${fromAddress}>`,
        to: fromAddress,
        subject: `SMTP Test (${port})`,
        html: `<p>SMTP working on port <b>${port}</b></p>`,
      });

      console.log(`MAIL SENT on port ${port}:`, info.messageId);
      process.exit(0);
    } catch (error) {
      lastError = error;
      console.error(`SMTP FAILED on port ${port}:`, getReadableError(error));
      console.error(error);
    }
  }

  console.error("\nFINAL SMTP TEST ERROR:");
  console.error(getReadableError(lastError));
  process.exit(1);
})();