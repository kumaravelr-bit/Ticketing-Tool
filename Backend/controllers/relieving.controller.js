const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const {
  getReadableMailError,
  sendMailWithFallback,
} = require("../utils/mailTransport");
require("dotenv").config();

const uploadDir = path.join(__dirname, "../uploads/relieving_letters");
const templatePath = path.join(
  __dirname,
  "../uploads/template/relieving-letter.html"
);
const backendRootDir = path.join(__dirname, "..");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let relievingSchemaChecked = false;
let logoBase64Cache = null;
let signatureBase64Cache = null;
let hrManagerSignatureBase64Cache = null;
const EMPTY_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const hasColumn = async (tableName, columnName) => {
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
};

const ensureRelievingSchema = async () => {
  if (relievingSchemaChecked) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS relieving_letters (
      id INT AUTO_INCREMENT PRIMARY KEY,

      employee_id INT NOT NULL,
      document_id VARCHAR(40) NOT NULL UNIQUE,

      letter_date DATE NOT NULL,
      relieving_date DATE NOT NULL,
      last_working_date DATE NOT NULL,
      date_of_joining DATE NOT NULL,

      approval_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
      approved_by INT DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      rejected_by INT DEFAULT NULL,
      rejected_at DATETIME DEFAULT NULL,
      rejection_reason VARCHAR(255) DEFAULT NULL,

      remarks VARCHAR(255) DEFAULT NULL,
      file_path VARCHAR(255) DEFAULT NULL,

      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_relieving_employee (employee_id),
      INDEX idx_relieving_date (relieving_date),
      INDEX idx_letter_date (letter_date),
      INDEX idx_relieving_created_by (created_by),
      INDEX idx_relieving_emp_date (employee_id, relieving_date),
      INDEX idx_relieving_approval (approval_status, relieving_date),

      CONSTRAINT fk_relieving_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE,

      CONSTRAINT fk_relieving_created_by
        FOREIGN KEY (created_by) REFERENCES employees(id)
        ON DELETE SET NULL,

      CONSTRAINT fk_relieving_approved_by
        FOREIGN KEY (approved_by) REFERENCES employees(id)
        ON DELETE SET NULL,

      CONSTRAINT fk_relieving_rejected_by
        FOREIGN KEY (rejected_by) REFERENCES employees(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

  const extraColumns = [
    ["file_path", "ALTER TABLE relieving_letters ADD COLUMN file_path VARCHAR(255) NULL AFTER remarks"],
    ["approval_status", "ALTER TABLE relieving_letters ADD COLUMN approval_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING' AFTER date_of_joining"],
    ["approved_by", "ALTER TABLE relieving_letters ADD COLUMN approved_by INT NULL AFTER approval_status"],
    ["approved_at", "ALTER TABLE relieving_letters ADD COLUMN approved_at DATETIME NULL AFTER approved_by"],
    ["rejected_by", "ALTER TABLE relieving_letters ADD COLUMN rejected_by INT NULL AFTER approved_at"],
    ["rejected_at", "ALTER TABLE relieving_letters ADD COLUMN rejected_at DATETIME NULL AFTER rejected_by"],
    ["rejection_reason", "ALTER TABLE relieving_letters ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER rejected_at"],
  ];

  for (const [column, sql] of extraColumns) {
    const exists = await hasColumn("relieving_letters", column);
    if (!exists) {
      try {
        await db.execute(sql);
      } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") {
          throw error;
        }
      }
    }
  }

  try {
    await db.execute(`
      ALTER TABLE employees
      ADD INDEX idx_emp_status_zone_branch_team (status, zone_id, branch_id, team_id, joining_date)
    `);
  } catch (error) {
    if (error.code !== "ER_DUP_KEYNAME") {
      throw error;
    }
  }

  relievingSchemaChecked = true;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pad = (value) => String(value).padStart(2, "0");

const normalizeDateInput = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
      value.getDate()
    )}`;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
};

const formatDate = (value) => {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "";

  const [year, month, day] = normalized.split("-");
  return `${day}.${month}.${year}`;
};

const formatDateForInput = (value) => normalizeDateInput(value);

const buildSafeFileName = (documentId) =>
  String(documentId || "").replace(/[\/\\]/g, "_");

const buildRelativePath = (documentId) =>
  `uploads/relieving_letters/${buildSafeFileName(documentId)}.pdf`;

const resolveAbsolutePath = (storedPath, documentId) => {
  if (storedPath) {
    const cleanPath = String(storedPath).replace(/^\/+/, "");
    return path.isAbsolute(cleanPath)
      ? cleanPath
      : path.join(backendRootDir, cleanPath);
  }

  return path.join(uploadDir, `${buildSafeFileName(documentId)}.pdf`);
};

const getAssetCache = (cacheKey) => {
  if (cacheKey === "logo") return logoBase64Cache;
  if (cacheKey === "signature") return signatureBase64Cache;
  if (cacheKey === "hr_manager_signature") return hrManagerSignatureBase64Cache;
  return null;
};

const setAssetCache = (cacheKey, value) => {
  if (cacheKey === "logo") logoBase64Cache = value;
  if (cacheKey === "signature") signatureBase64Cache = value;
  if (cacheKey === "hr_manager_signature") hrManagerSignatureBase64Cache = value;
};

const getBase64Asset = (candidates, cacheKey) => {
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    setAssetCache(cacheKey, {
      filePath: null,
      mtimeMs: 0,
      encoded: EMPTY_PIXEL,
    });
    return EMPTY_PIXEL;
  }

  const stats = fs.statSync(filePath);
  const cached = getAssetCache(cacheKey);

  if (
    cached &&
    cached.filePath === filePath &&
    cached.mtimeMs === stats.mtimeMs &&
    cached.encoded
  ) {
    return cached.encoded;
  }

  const ext = path.extname(filePath).toLowerCase();
  let mimeType = "image/png";

  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".svg") mimeType = "image/svg+xml";
  else if (ext === ".webp") mimeType = "image/webp";

  const fileBuffer = fs.readFileSync(filePath);
  const encoded = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  setAssetCache(cacheKey, {
    filePath,
    mtimeMs: stats.mtimeMs,
    encoded,
  });

  return encoded;
};

const getLogoBase64 = () =>
  getBase64Asset(
    [
      path.join(__dirname, "../uploads/template/images/image1.png"),
      path.join(__dirname, "../uploads/template/images/image1.jpg"),
      path.join(__dirname, "../uploads/template/images/image1.jpeg"),
      path.join(__dirname, "../assets/infonet-logo.png"),
      path.join(__dirname, "../uploads/template/infonet-logo.png"),
      path.join(__dirname, "../uploads/infonet-logo.png"),
    ],
    "logo"
  );

const getSignatureBase64 = () =>
  getBase64Asset(
    [
      path.join(__dirname, "../uploads/template/images/signature.png"),
      path.join(__dirname, "../uploads/template/images/signature.jpg"),
      path.join(__dirname, "../uploads/template/images/signature.jpeg"),
      path.join(__dirname, "../uploads/template/signature.png"),
    ],
    "signature"
  );

const getHrManagerSignatureBase64 = () =>
  getBase64Asset(
    [
      path.join(
        __dirname,
        "../uploads/template/hr-manager-sign/hr_manager_sign.png"
      ),
      path.join(
        __dirname,
        "../uploads/template/hr-manager-sign/hr_manager_sign.jpg"
      ),
      path.join(
        __dirname,
        "../uploads/template/hr-manager-sign/hr_manager_sign.jpeg"
      ),
      path.join(
        __dirname,
        "../uploads/template/hr-manager-sign/hr_manager_sign.webp"
      ),
      path.join(
        __dirname,
        "../uploads/template/hr-manager-sign/hr_manager_sign.svg"
      ),
    ],
    "hr_manager_signature"
  );

const isHrManagerApprover = (row) => {
  const approvalStatus = String(row?.approval_status || "").trim().toUpperCase();
  const approverTeamName = String(row?.approver_team_name || "")
    .trim()
    .toUpperCase();
  const approverDesignationName = String(row?.approver_designation_name || "")
    .trim()
    .toUpperCase();

  return (
    approvalStatus === "APPROVED" &&
    (approverTeamName === "HRD TEAM" || approverTeamName === "HRD") &&
    approverDesignationName.includes("MANAGER")
  );
};

const getRelievingSignatureBase64 = (row) =>
  isHrManagerApprover(row) ? getHrManagerSignatureBase64() : getSignatureBase64();

const renderTemplate = (template, data) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    data[key] !== undefined && data[key] !== null ? String(data[key]) : ""
  );

const generateDocumentId = async () => {
  const year = new Date().getFullYear();

  const [rows] = await db.execute(
    `SELECT id
     FROM relieving_letters
     WHERE YEAR(letter_date) = ?
     ORDER BY id DESC
     LIMIT 1`,
    [year]
  );

  const next = rows.length ? rows[0].id + 1 : 1;
  return `Infonet Comm/HR/RL/${year}/${String(next).padStart(3, "0")}`;
};

const getLetterBaseQuery = () => `
  FROM relieving_letters rl
  INNER JOIN employees e ON e.id = rl.employee_id
  LEFT JOIN teams t ON t.id = e.team_id
  LEFT JOIN designations d ON d.id = e.designation_id
  LEFT JOIN branches b ON b.id = e.branch_id
  LEFT JOIN zones z ON z.id = e.zone_id
`;

const getLetterSelectQuery = () => `
  SELECT
    rl.id,
    rl.employee_id,
    rl.document_id,
    rl.letter_date,
    rl.relieving_date,
    rl.last_working_date,
    rl.date_of_joining,
    rl.approval_status,
    rl.approved_by,
    rl.approved_at,
    rl.rejected_by,
    rl.rejected_at,
    rl.rejection_reason,
    rl.remarks,
    rl.file_path,
    rl.created_at,

    e.emp_id,
    e.name AS employee_name,
    e.gender,
    e.email,
    e.phone,
    e.joining_date,
    e.status,
    e.role AS employee_role,

    t.id AS team_id,
    t.team_name AS department,

    d.id AS designation_id,
    d.designation_name AS designation,

    b.id AS branch_id,
    b.branch_name,

    z.id AS zone_id,
    z.zone_name,

    ab.name AS approver_name,
    ab.role AS approver_role,
    ad.designation_name AS approver_designation_name,
    at.team_name AS approver_team_name
  ${getLetterBaseQuery()}
  LEFT JOIN employees ab ON ab.id = rl.approved_by
  LEFT JOIN designations ad ON ad.id = ab.designation_id
  LEFT JOIN teams at ON at.id = ab.team_id
`;

const getRelievingById = async (id) => {
  const [[row]] = await db.execute(
    `${getLetterSelectQuery()} WHERE rl.id = ? LIMIT 1`,
    [id]
  );
  return row || null;
};

const buildDashboardFilters = (query = {}, params = [], employeeOnly = false) => {
  const clauses = [];

  if (query.employee_name) {
    const pattern = `%${String(query.employee_name).trim()}%`;
    clauses.push(`e.name LIKE ?`);
    params.push(pattern);
  }

  if (query.status) {
    clauses.push(`e.status = ?`);
    params.push(String(query.status).trim().toUpperCase());
  } else {
    clauses.push(`e.status IN ('ACTIVE', 'RELIEVED')`);
  }

  if (query.zone_id) {
    clauses.push(`e.zone_id = ?`);
    params.push(Number(query.zone_id));
  }

  if (query.branch_id) {
    clauses.push(`e.branch_id = ?`);
    params.push(Number(query.branch_id));
  }

  if (query.team_id) {
    clauses.push(`e.team_id = ?`);
    params.push(Number(query.team_id));
  }

  if (query.fromDate) {
    clauses.push(
      employeeOnly
        ? `e.joining_date >= ?`
        : `(CASE WHEN e.status = 'RELIEVED' THEN rl.relieving_date ELSE e.joining_date END) >= ?`
    );
    params.push(query.fromDate);
  }

  if (query.toDate) {
    clauses.push(
      employeeOnly
        ? `e.joining_date <= ?`
        : `(CASE WHEN e.status = 'RELIEVED' THEN rl.relieving_date ELSE e.joining_date END) <= ?`
    );
    params.push(query.toDate);
  }

  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
};

const buildPageClause = (page, limit) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const safeOffset = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    offset: safeOffset,
    sql: ` LIMIT ${safeLimit} OFFSET ${safeOffset}`,
  };
};

const buildRelievingHtml = (row) => {
  const template = fs.readFileSync(templatePath, "utf8");

  const rawName = String(row.employee_name || "").trim();
  const cleanName = rawName.replace(/^(mr|mrs|ms|miss)\.?\s+/i, "").trim();
  const normalizedGender = String(row.gender || "").trim().toUpperCase();

  let salutation = cleanName || rawName;
  if (normalizedGender === "FEMALE") {
    salutation = cleanName ? `Miss. ${cleanName}` : "Miss.";
  } else if (normalizedGender === "MALE") {
    salutation = cleanName ? `Mr. ${cleanName}` : "Mr.";
  }

  const approverDesignation = [
    row.approver_team_name,
    row.approver_designation_name,
  ]
    .filter(Boolean)
    .join(" - ") || "MANAGER-HR.";

  const payload = {
    logoBase64: getLogoBase64(),
    signatureBase64: getRelievingSignatureBase64(row),
    documentId: escapeHtml(row.document_id || ""),
    letterDate: formatDate(row.letter_date),
    employeeName: escapeHtml(cleanName || rawName),
    employeeId: escapeHtml(row.emp_id || ""),
    department: escapeHtml(row.department || ""),
    salutationName: escapeHtml(salutation),
    relievingDate: escapeHtml(formatDate(row.relieving_date)),
    designation: escapeHtml(row.designation || ""),
    dateOfJoining: escapeHtml(formatDate(row.date_of_joining || row.joining_date)),
    lastWorkingDate: escapeHtml(formatDate(row.last_working_date)),
    approverName: escapeHtml(row.approver_name || "Authorized Signatory"),
    approverDesignation: escapeHtml(approverDesignation),
  };

  return renderTemplate(template, payload);
};

const generateRelievingPdfBuffer = async (row) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(buildRelievingHtml(row), {
      waitUntil: "networkidle0",
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });
  } finally {
    if (browser) await browser.close();
  }
};

const ensureRelievingPdf = async (row, options = {}) => {
  if (!row) {
    throw new Error("Relieving letter row is required for PDF generation");
  }

  const absolutePath = resolveAbsolutePath(row.file_path, row.document_id);
  if (!options.force && fs.existsSync(absolutePath)) {
    return absolutePath;
  }

  const pdfBuffer = await generateRelievingPdfBuffer(row);
  await fs.promises.writeFile(absolutePath, pdfBuffer);
  return absolutePath;
};

// DASHBOARD
exports.getRelievingDashboard = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const { page, limit, sql: pageSql } = buildPageClause(
      req.query.page,
      req.query.limit
    );

    const employeeName = String(req.query.employee_name || "").trim();
    const zoneId = Number(req.query.zone_id) || null;
    const branchId = Number(req.query.branch_id) || null;
    const teamId = Number(req.query.team_id) || null;
    const fromDate = String(req.query.fromDate || "").trim();
    const toDate = String(req.query.toDate || "").trim();

    const where = [];
    const params = [];

    if (employeeName) {
      where.push(`(e.name LIKE ? OR e.emp_id LIKE ?)`);
      const pattern = `%${employeeName}%`;
      params.push(pattern, pattern);
    }

    if (zoneId) {
      where.push(`e.zone_id = ?`);
      params.push(zoneId);
    }

    if (branchId) {
      where.push(`e.branch_id = ?`);
      params.push(branchId);
    }

    if (teamId) {
      where.push(`e.team_id = ?`);
      params.push(teamId);
    }

    if (fromDate) {
      where.push(`rl.relieving_date >= ?`);
      params.push(fromDate);
    }

    if (toDate) {
      where.push(`rl.relieving_date <= ?`);
      params.push(toDate);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const listSql = `
  SELECT
    rl.id,
    rl.employee_id AS employee_pk,
    rl.document_id,
    rl.letter_date,
    rl.relieving_date,
    rl.last_working_date,
    rl.date_of_joining,
    rl.remarks,
    rl.file_path,
    rl.created_at,
    rl.letter_date AS date,
    rl.approval_status,
    rl.approved_by,
    rl.approved_at,
    rl.rejected_by,
    rl.rejected_at,
    rl.rejection_reason,

    e.emp_id AS employee_id,
    e.name AS employee_name,
    e.email,
    e.phone,
    e.status,
    e.role AS employee_role,

    t.id AS team_id,
    t.team_name AS department,

    d.id AS designation_id,
    d.designation_name AS designation,

    b.id AS branch_id,
    b.branch_name,

    z.id AS zone_id,
    z.zone_name
  FROM relieving_letters rl
  INNER JOIN employees e ON e.id = rl.employee_id
  LEFT JOIN teams t ON t.id = e.team_id
  LEFT JOIN designations d ON d.id = e.designation_id
  LEFT JOIN branches b ON b.id = e.branch_id
  LEFT JOIN zones z ON z.id = e.zone_id
  ${whereSql}
  ORDER BY rl.created_at DESC, rl.id DESC
  ${pageSql}
`;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM relieving_letters rl
      INNER JOIN employees e ON e.id = rl.employee_id
      LEFT JOIN teams t ON t.id = e.team_id
      LEFT JOIN designations d ON d.id = e.designation_id
      LEFT JOIN branches b ON b.id = e.branch_id
      LEFT JOIN zones z ON z.id = e.zone_id
      ${whereSql}
    `;

    const [rows] = await db.query(listSql, params);
    const [countRows] = await db.query(countSql, params);

    const total = countRows?.[0]?.total || 0;

    return res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("RELIEVING DASHBOARD ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch relieving dashboard",
      details: error.message,
    });
  }
};

// CREATE
exports.generateRelievingLetter = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const d = req.body || {};
    const employeeId = Number(d.employee_id);

    if (!employeeId) {
      return res.status(400).json({ message: "Employee is required" });
    }

    if (!d.letter_date || !d.relieving_date || !d.last_working_date) {
      return res.status(400).json({
        message: "Letter date, relieving date and last working date are required",
      });
    }

    const [[employee]] = await db.execute(
      `
      SELECT
        e.id,
        e.emp_id,
        e.name AS employee_name,
        e.gender,
        e.email,
        e.joining_date,
        e.status,
        t.team_name AS department,
        d.designation_name AS designation
      FROM employees e
      LEFT JOIN teams t ON t.id = e.team_id
      LEFT JOIN designations d ON d.id = e.designation_id
      WHERE e.id = ?
      LIMIT 1
      `,
      [employeeId]
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const [[existing]] = await db.execute(
      `SELECT id, document_id FROM relieving_letters WHERE employee_id = ? LIMIT 1`,
      [employeeId]
    );

    if (existing) {
      return res.status(409).json({
        message: "Relieving letter already exists for this employee",
      });
    }

    const documentId = await generateDocumentId();
    const relativePath = buildRelativePath(documentId);

    const [insertResult] = await db.execute(
      `
      INSERT INTO relieving_letters (
        employee_id,
        document_id,
        letter_date,
        relieving_date,
        last_working_date,
        date_of_joining,
        approval_status,
        remarks,
        file_path,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
      `,
      [
        employeeId,
        documentId,
        formatDateForInput(d.letter_date),
        formatDateForInput(d.relieving_date),
        formatDateForInput(d.last_working_date),
        formatDateForInput(d.date_of_joining || employee.joining_date),
        d.remarks ? String(d.remarks).trim().slice(0, 255) : null,
        relativePath,
        Number(d.created_by) || null,
      ]
    );

    await ensureRelievingPdf({
      ...employee,
      id: insertResult.insertId,
      employee_id: employeeId,
      document_id: documentId,
      letter_date: formatDateForInput(d.letter_date),
      relieving_date: formatDateForInput(d.relieving_date),
      last_working_date: formatDateForInput(d.last_working_date),
      date_of_joining: formatDateForInput(d.date_of_joining || employee.joining_date),
      remarks: d.remarks ? String(d.remarks).trim().slice(0, 255) : null,
      file_path: relativePath,
      approval_status: "PENDING",
    });

    return res.status(201).json({
      message: "Relieving request created successfully",
      data: {
        id: insertResult.insertId,
        document_id: documentId,
        employee_id: employeeId,
        approval_status: "PENDING",
      },
    });
  } catch (error) {
    console.error("GENERATE RELIEVING ERROR:", error);
    return res.status(500).json({
      message: "Failed to generate relieving letter",
      details: error.message,
    });
  }
};

const canApproveRelieving = (user) => {
  if (!user) return false;

  const role = String(user.role || "").trim().toUpperCase();
  const teamName = String(user.team_name || user.department || "").trim().toUpperCase();
  const designation = String(user.designation || user.designation_name || "").trim().toUpperCase();

  const isAllowedRole = role === "ADMIN" || role === "SUPER_ADMIN";
  const isHrdManager =
    (teamName === "HRD TEAM" || teamName === "HRD") &&
    designation.includes("MANAGER");

  return isAllowedRole || isHrdManager;
};

const getApprovalUserFromRequest = async (req) => {
  if (req.user?.emp_id) {
    const [[userByEmpId]] = await db.execute(
      `
      SELECT
        e.id,
        e.emp_id,
        e.name,
        e.role,
        t.team_name,
        d.designation_name
      FROM employees e
      LEFT JOIN teams t ON t.id = e.team_id
      LEFT JOIN designations d ON d.id = e.designation_id
      WHERE e.emp_id = ?
      LIMIT 1
      `,
      [req.user.emp_id]
    );

    if (userByEmpId) return userByEmpId;
  }

  const candidateEmpId = String(
    req.body?.approved_by_emp_id || req.body?.emp_id || ""
  ).trim();

  if (candidateEmpId) {
    const [[userByEmpId]] = await db.execute(
      `
      SELECT
        e.id,
        e.emp_id,
        e.name,
        e.role,
        t.team_name,
        d.designation_name
      FROM employees e
      LEFT JOIN teams t ON t.id = e.team_id
      LEFT JOIN designations d ON d.id = e.designation_id
      WHERE e.emp_id = ?
      LIMIT 1
      `,
      [candidateEmpId]
    );

    if (userByEmpId) return userByEmpId;
  }

  const userId =
    Number(req.body?.approved_by) ||
    Number(req.body?.user_id) ||
    null;

  if (!userId) return null;

  const [[user]] = await db.execute(
    `
    SELECT
      e.id,
      e.emp_id,
      e.name,
      e.role,
      t.team_name,
      d.designation_name
    FROM employees e
    LEFT JOIN teams t ON t.id = e.team_id
    LEFT JOIN designations d ON d.id = e.designation_id
    WHERE e.id = ?
    LIMIT 1
    `,
    [userId]
  );

  return user || null;
};

exports.approveRelievingLetter = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid relieving letter ID" });
    }

    const approver = await getApprovalUserFromRequest(req);
    if (!canApproveRelieving(approver)) {
      return res.status(403).json({
        message: "You are not authorized to approve this request",
      });
    }

    const row = await getRelievingById(id);
    if (!row) {
      return res.status(404).json({ message: "Relieving letter not found" });
    }

    if (row.approval_status === "APPROVED") {
      return res.status(400).json({ message: "Relieving letter already approved" });
    }

    await db.execute(
      `
      UPDATE relieving_letters
      SET
        approval_status = 'APPROVED',
        approved_by = ?,
        approved_at = NOW(),
        rejected_by = NULL,
        rejected_at = NULL,
        rejection_reason = NULL
      WHERE id = ?
      `,
      [approver.id, id]
    );

    await db.execute(
      `UPDATE employees SET status = 'RELIEVED' WHERE id = ?`,
      [row.employee_id]
    );

    const approvedRow = await getRelievingById(id);
    await ensureRelievingPdf(approvedRow, { force: true });

    return res.json({
      message: "Relieving letter approved successfully",
    });
  } catch (error) {
    console.error("APPROVE RELIEVING ERROR:", error);
    return res.status(500).json({
      message: "Failed to approve relieving letter",
      details: error.message,
    });
  }
};

exports.rejectRelievingLetter = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid relieving letter ID" });
    }

    const approver = await getApprovalUserFromRequest(req);
    if (!canApproveRelieving(approver)) {
      return res.status(403).json({
        message: "You are not authorized to reject this request",
      });
    }

    const row = await getRelievingById(id);
    if (!row) {
      return res.status(404).json({ message: "Relieving letter not found" });
    }

    await db.execute(
      `
      UPDATE relieving_letters
      SET
        approval_status = 'REJECTED',
        rejected_by = ?,
        rejected_at = NOW(),
        rejection_reason = ?,
        approved_by = NULL,
        approved_at = NULL
      WHERE id = ?
      `,
      [
        approver.id,
        String(req.body?.reason || "").trim().slice(0, 255) || null,
        id,
      ]
    );

    await db.execute(
      `UPDATE employees SET status = 'ACTIVE' WHERE id = ?`,
      [row.employee_id]
    );

    return res.json({
      message: "Relieving letter rejected successfully",
    });
  } catch (error) {
    console.error("REJECT RELIEVING ERROR:", error);
    return res.status(500).json({
      message: "Failed to reject relieving letter",
      details: error.message,
    });
  }
};

// GET BY ID
exports.getRelievingLetterById = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const row = await getRelievingById(Number(id));
    if (!row) {
      return res.status(404).json({ message: "Relieving letter not found" });
    }

    return res.json({
      data: {
        ...row,
        employee_name: row.employee_name,
        employee_id: row.emp_id,
      },
    });
  } catch (error) {
    console.error("GET RELIEVING ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch relieving letter" });
  }
};

// UPDATE
exports.updateRelievingLetter = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const { id } = req.params;
    const d = req.body || {};

    if (!id || id === "undefined") {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const existing = await getRelievingById(Number(id));
    if (!existing) {
      return res.status(404).json({ message: "Relieving letter not found" });
    }

    if (String(existing.approval_status || "").toUpperCase() === "APPROVED") {
      return res.status(400).json({
        message: "Approved relieving letter cannot be edited",
      });
    }

    const updatedRow = {
      ...existing,
      letter_date: d.letter_date || existing.letter_date,
      relieving_date: d.relieving_date || existing.relieving_date,
      last_working_date: d.last_working_date || existing.last_working_date,
      date_of_joining: d.date_of_joining || existing.date_of_joining,
      remarks:
        d.remarks !== undefined
          ? String(d.remarks || "").trim().slice(0, 255)
          : existing.remarks,
    };

    await ensureRelievingPdf(updatedRow, { force: true });

    await db.execute(
      `
      UPDATE relieving_letters SET
        letter_date = ?,
        relieving_date = ?,
        last_working_date = ?,
        date_of_joining = ?,
        remarks = ?,
        file_path = ?
      WHERE id = ?
      `,
      [
        formatDateForInput(updatedRow.letter_date),
        formatDateForInput(updatedRow.relieving_date),
        formatDateForInput(updatedRow.last_working_date),
        formatDateForInput(updatedRow.date_of_joining),
        updatedRow.remarks || null,
        existing.file_path || buildRelativePath(existing.document_id),
        id,
      ]
    );

    return res.json({ message: "Relieving letter updated successfully" });
  } catch (error) {
    console.error("UPDATE RELIEVING ERROR:", error);
    return res.status(500).json({ message: "Failed to update relieving letter" });
  }
};

// PREVIEW
exports.previewRelievingLetter = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const row = await getRelievingById(Number(req.params.id));
    if (!row) {
      return res.status(404).send("Relieving letter not found");
    }

    const filePath = await ensureRelievingPdf(row, { force: true });

    const pdfBuffer = await fs.promises.readFile(filePath);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${row.document_id}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("PREVIEW RELIEVING ERROR:", error);
    return res.status(500).json({ message: "Failed to preview relieving letter" });
  }
};

// DOWNLOAD
exports.downloadRelievingLetter = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const row = await getRelievingById(Number(req.params.id));
    if (!row) {
      return res.status(404).json({ message: "Relieving letter not found" });
    }

    const filePath = await ensureRelievingPdf(row, { force: true });

    return res.download(filePath, `${row.document_id}.pdf`);
  } catch (error) {
    console.error("DOWNLOAD RELIEVING ERROR:", error);
    return res.status(500).json({ message: "Failed to download relieving letter" });
  }
};

// SEND MAIL
exports.sendRelievingLetterMail = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const relievingId = Number(req.body?.relieving_id);

    if (!relievingId) {
      return res.status(400).json({ message: "Relieving ID is required" });
    }

    const row = await getRelievingById(relievingId);
    if (!row) {
      return res.status(404).json({ message: "Relieving letter not found" });
    }

    const to = String(req.body?.email || row.email || "").trim();
    if (!to) {
      return res.status(400).json({ message: "Employee email is not available" });
    }

    const filePath = await ensureRelievingPdf(row, { force: true });

    const employeeName = escapeHtml(row.employee_name || "Employee");
    const designation = escapeHtml(row.designation || "");
    const relievingDate = escapeHtml(formatDate(row.relieving_date));

    await sendMailWithFallback(
      {
        to,
        subject: `Relieving & Experience Letter - ${row.document_id}`,
        text: `Dear ${row.employee_name || "Employee"},

Please find attached your relieving and experience letter.

Designation: ${row.designation || ""}
Relieving Date: ${formatDate(row.relieving_date)}

Regards,
HR Team`,
        html: `
          <p><strong>Dear ${employeeName}</strong>,</p>
          <p>Please find attached your relieving and experience letter.</p>
          <p>
            <strong>Designation:</strong> ${designation}<br/>
            <strong>Relieving Date:</strong> ${relievingDate}
          </p>
          <p>Regards,<br/>HR Team</p>
        `,
        attachments: [
          {
            filename: `${row.document_id}.pdf`,
            path: filePath,
          },
        ],
      },
      "HR Team"
    );

    return res.json({ message: "Mail sent successfully" });
  } catch (error) {
    console.error("SEND RELIEVING MAIL ERROR:", error);
    const message = getReadableMailError(error);
    const statusCode =
      error.code === "EAUTH" ||
      error.code === "ESOCKET" ||
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.command === "CONN"
        ? 502
        : 500;

    return res.status(statusCode).json({ message });
  }
};

exports.getRelievingCandidates = async (req, res) => {
  try {
    await ensureRelievingSchema();

    const search = String(req.query.search || "").trim();
    const employeeId = String(req.query.employee_id || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const where = [`e.status = 'ACTIVE'`];
    const params = [];

    // only employees for whom relieving letter is not yet created
    where.push(`
      NOT EXISTS (
        SELECT 1
        FROM relieving_letters rl
        WHERE rl.employee_id = e.id
      )
    `);

    if (employeeId) {
      where.push(`(e.id = ? OR e.emp_id = ?)`);
      params.push(Number(employeeId) || 0, employeeId);
    } else if (search) {
      where.push(`(
        e.name LIKE ?
        OR e.emp_id LIKE ?
        OR e.email LIKE ?
      )`);
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const sql = `
      SELECT
        e.id AS employee_pk,
        e.emp_id AS employee_id,
        e.name AS employee_name,
        e.email,
        e.phone,
        e.joining_date AS date_of_joining,
        e.joining_date,
        e.status,

        t.id AS team_id,
        t.team_name AS department,

        d.id AS designation_id,
        d.designation_name AS designation,

        b.id AS branch_id,
        b.branch_name,

        z.id AS zone_id,
        z.zone_name
      FROM employees e
      LEFT JOIN teams t ON t.id = e.team_id
      LEFT JOIN designations d ON d.id = e.designation_id
      LEFT JOIN branches b ON b.id = e.branch_id
      LEFT JOIN zones z ON z.id = e.zone_id
      WHERE ${where.join(" AND ")}
      ORDER BY e.name ASC
      LIMIT ?
    `;

    const [rows] = await db.query(sql, [...params, limit]);

    return res.json({
      data: rows,
    });
  } catch (error) {
    console.error("RELIEVING CANDIDATES ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch relieving candidates",
      details: error.message,
    });
  }
};
