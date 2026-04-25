const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { getAccessProfile } = require("../middleware/access");
const {
  getReadableMailError,
  sendMailWithFallback,
} = require("../utils/mailTransport");

const PAYSLIP_COMPONENTS = [
  { key: "basicPay", label: "Basic Pay", type: "EARNING" },
  { key: "hra", label: "HRA", type: "EARNING" },
  { key: "otherAllowance", label: "Other Allowance", type: "EARNING" },
  { key: "foodAllowance", label: "Food Allowance", type: "EARNING" },
  { key: "vehicleAllowance", label: "Vehicle Allowance", type: "EARNING" },
  { key: "ot", label: "OT", type: "EARNING" },
  { key: "positionAllowance", label: "Position Allowance", type: "EARNING" },
  { key: "arrear", label: "Arrear", type: "EARNING" },
  { key: "holidayPay", label: "Holiday Pay", type: "EARNING" },
  { key: "esi", label: "ESI", type: "DEDUCTION" },
  { key: "pf", label: "PF", type: "DEDUCTION" },
  { key: "insurance", label: "Insurance", type: "DEDUCTION" },
  { key: "uniform", label: "Uniform", type: "DEDUCTION" },
  { key: "specialDeductions", label: "Special Deductions", type: "DEDUCTION" },
  { key: "salaryAdvance", label: "Salary Advance", type: "DEDUCTION" },
  { key: "tds", label: "TDS", type: "DEDUCTION" },
];

const PAYSLIP_BULK_TEMPLATE_HEADERS = [
  "emp_id",
  "salary_month",
  "salary_year",
  "salary_date",
  "account_number",
  "lop",
  "salary_days",
  "remarks",
  ...PAYSLIP_COMPONENTS.map((item) => item.key),
];

const PAYSLIP_BULK_SAMPLE_ROW = [
  "ICEEMP0001",
  "4",
  "2026",
  "2026-04-30",
  "1234567890",
  "0",
  "30",
  "April payroll",
  "25000",
  "12000",
  "5000",
  "1500",
  "0",
  "0",
  "0",
  "0",
  "0",
  "0",
  "1800",
  "0",
  "0",
  "0",
  "0",
  "0",
];

const COMPONENT_MAP = new Map(PAYSLIP_COMPONENTS.map((item) => [item.key, item]));
const TEMPLATE_PATH = path.join(__dirname, "../uploads/template/payslip.html");
const PAYSLIP_DIR = path.join(__dirname, "../uploads/payslips");
const EMPTY_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

let logoBase64Cache = null;
const PAYSLIP_FULL_ACCESS_DESIGNATIONS = new Set([
  "MANAGER",
  "ADMIN",
  "RECRUITER",
  "RECRUTIER",
]);
const PAYSLIP_MANAGE_DESIGNATIONS = new Set([
  "MANAGER",
  "ADMIN",
  "RECRUITER",
  "RECRUTIER",
]);

const ensurePayslipDir = () => {
  if (!fs.existsSync(PAYSLIP_DIR)) {
    fs.mkdirSync(PAYSLIP_DIR, { recursive: true });
  }
};

const safeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
};

const fmtDisplayNumber = (value) => {
  const normalized = safeNumber(value);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
};

const scientificToPlainString = (value) => {
  const trimmed = String(value || "").trim();
  if (!/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(trimmed)) {
    return trimmed;
  }

  const sign = trimmed.startsWith("-") ? "-" : "";
  const normalized = trimmed.replace(/^[+-]/, "");
  const [mantissa, exponentText] = normalized.toLowerCase().split("e");
  const exponent = Number(exponentText);
  const [whole = "", fraction = ""] = mantissa.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const decimalPlaces = fraction.length;
  const shift = exponent - decimalPlaces;

  if (shift >= 0) {
    return `${sign}${digits}${"0".repeat(shift)}`;
  }

  const pointIndex = digits.length + shift;
  if (pointIndex > 0) {
    return `${sign}${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
  }

  return `${sign}0.${"0".repeat(Math.abs(pointIndex))}${digits}`;
};

const normalizeAccountNumber = (value) => {
  let text = String(value ?? "").trim();
  if (!text) return "";

  text = text.replace(/^'/, "").replace(/,/g, "").replace(/\s+/g, "");
  text = scientificToPlainString(text);

  if (/^\d+\.0+$/.test(text)) {
    text = text.replace(/\.0+$/, "");
  }

  return text;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN");
};

const formatPayMonth = (month, year) => {
  const monthIndex = Number(month) - 1;
  const date = new Date(Number(year), monthIndex, 1);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    month: "short",
    year: "numeric",
  });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getLogoBase64 = () => {
  if (logoBase64Cache) return logoBase64Cache;

  const candidates = [
    path.join(__dirname, "../uploads/template/images/image1.png"),
    path.join(__dirname, "../uploads/template/images/image1.jpg"),
    path.join(__dirname, "../uploads/template/images/image1.jpeg"),
    path.join(__dirname, "../assets/infonet-logo.png"),
    path.join(__dirname, "../uploads/template/infonet-logo.png"),
    path.join(__dirname, "../uploads/infonet-logo.png"),
  ];

  const logoPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!logoPath) {
    logoBase64Cache = EMPTY_PIXEL;
    return logoBase64Cache;
  }

  const ext = path.extname(logoPath).toLowerCase();
  let mimeType = "image/png";

  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".svg") mimeType = "image/svg+xml";
  else if (ext === ".webp") mimeType = "image/webp";

  const logoBuffer = fs.readFileSync(logoPath);
  logoBase64Cache = `data:${mimeType};base64,${logoBuffer.toString("base64")}`;
  return logoBase64Cache;
};

const renderTemplate = (template, data) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    data[key] !== undefined && data[key] !== null ? String(data[key]) : "",
  );

const buildComponentState = (components = []) => {
  const state = PAYSLIP_COMPONENTS.reduce((acc, item) => {
    acc[item.key] = 0;
    return acc;
  }, {});

  for (const component of components) {
    if (COMPONENT_MAP.has(component.component_key)) {
      state[component.component_key] = safeNumber(component.amount);
    }
  }

  return state;
};

const calculateTotals = (components = []) => {
  return components.reduce(
    (acc, component) => {
      const config = COMPONENT_MAP.get(component.component_key);
      const amount = safeNumber(component.amount);
      if (!config) return acc;
      if (config.type === "EARNING") {
        acc.total_earnings += amount;
      } else {
        acc.total_deductions += amount;
      }
      return acc;
    },
    { total_earnings: 0, total_deductions: 0 },
  );
};

const normalizeComponents = (components = []) => {
  const inputMap = new Map(
    Array.isArray(components)
      ? components.map((item) => [String(item.component_key || ""), item])
      : [],
  );

  return PAYSLIP_COMPONENTS.map((config) => {
    const source = inputMap.get(config.key) || {};
    return {
      component_key: config.key,
      component_label: config.label,
      component_type: config.type,
      amount: safeNumber(source.amount),
    };
  });
};

const buildPdfPath = (payslipNo) =>
  path.join(
    PAYSLIP_DIR,
    `${String(payslipNo || "payslip").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
  );

const canDeletePayslip = (user = {}) =>
  ["ADMIN", "SUPER_ADMIN"].includes(
    String(user.role || "").trim().toUpperCase(),
  );

const setNoCacheHeaders = (res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
};

const getPayslipAccessScope = (user = {}) => {
  const profile = getAccessProfile(user);
  const teamName = String(user.team_name || user.team || "").trim().toUpperCase();
  const designation = String(user.designation_name || user.designation || "").trim().toUpperCase();
  const isHrdPayslipFullAccess =
    (teamName === "HRD" || teamName === "HRD TEAM") &&
    PAYSLIP_FULL_ACCESS_DESIGNATIONS.has(designation);
  const isHrdPayslipManager =
    (teamName === "HRD" || teamName === "HRD TEAM") &&
    PAYSLIP_MANAGE_DESIGNATIONS.has(designation);
  const fullAccess =
    profile.is.superAdmin || profile.is.admin || isHrdPayslipFullAccess;
  const canManage =
    profile.is.superAdmin || profile.is.admin || isHrdPayslipManager;

  return {
    fullAccess,
    selfEmpId: fullAccess ? "" : String(user.emp_id || "").trim(),
    canManage,
  };
};

const normalizeKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const csvEscape = (value = "") => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const parseCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.replace(/\r/g, "").trim());
};

const parseCsvBuffer = (buffer) => {
  const content = String(buffer || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");

  const lines = content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] ?? "";
    });
    row.__rowNumber = index + 2;
    return row;
  });
};

const parseExcelBuffer = (buffer) => {
  const xlsx = require("xlsx");
  const workbook = xlsx.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });

  return rows.map((rawRow, index) => {
    const row = Object.fromEntries(
      Object.entries(rawRow).map(([key, value]) => [normalizeKey(key), value]),
    );
    row.__rowNumber = index + 2;
    return row;
  });
};

const readUploadRows = (file) => {
  const ext = path.extname(file?.originalname || "").toLowerCase();
  if (!file?.buffer?.length) {
    throw new Error("Uploaded file is empty");
  }
  if (ext === ".csv") return parseCsvBuffer(file.buffer);
  if (ext === ".xlsx" || ext === ".xls") return parseExcelBuffer(file.buffer);
  throw new Error("Unsupported file type");
};

const normalizeDateInput = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error(`Invalid date value '${text}'`);
};

const getField = (row, aliases) => {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const buildResponsePayload = (rows, inserted, failed, successMessage, partialMessage) => ({
  message: failed.length ? partialMessage : successMessage,
  summary: {
    total_rows: rows.length,
    inserted_count: inserted.length,
    failed_count: failed.length,
  },
  inserted,
  failed,
});

const assertPayslipManageAccess = (user = {}) => {
  const scope = getPayslipAccessScope(user);
  if (!scope.canManage) {
    const error = new Error("You do not have permission to manage all employees' payslips");
    error.status = 403;
    throw error;
  }
  return scope;
};

const runWithConcurrency = async (items, limit, worker) => {
  const concurrency = Math.max(1, Number(limit) || 1);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
};

const getPayslipBaseQuery = () => `
  FROM payslips p
  INNER JOIN employees e ON e.id = p.employee_id
  LEFT JOIN branches b ON b.id = e.branch_id
  LEFT JOIN zones z ON z.id = b.zone_id
  LEFT JOIN teams t ON t.id = e.team_id
  LEFT JOIN designations d ON d.id = e.designation_id
`;

const getPayslipSelectQuery = () => `
  SELECT
    p.id,
    p.payslip_no,
    p.employee_id,
    p.salary_month,
    p.salary_year,
    p.salary_date,
    p.account_number,
    p.lop,
    p.salary_days,
    p.total_earnings,
    p.total_deductions,
    p.net_pay,
    p.remarks,
    p.created_at,
    e.emp_id,
    e.name AS employee_name,
    e.email,
    e.joining_date AS doj,
    b.id AS branch_id,
    b.branch_name,
    z.id AS zone_id,
    z.zone_name,
    t.id AS team_id,
    t.team_name AS department,
    d.id AS designation_id,
    d.designation_name,
    COALESCE(b.branch_name, z.zone_name, t.team_name, '') AS location
  ${getPayslipBaseQuery()}
`;

const buildPayslipFilters = (query = {}, params = [], accessScope = {}) => {
  const clauses = [];

  if (query.search) {
    const pattern = `%${String(query.search).trim()}%`;
    clauses.push(
      `(e.emp_id LIKE ? OR e.name LIKE ? OR COALESCE(e.email, '') LIKE ?)`,
    );
    params.push(pattern, pattern, pattern);
  }

  if (query.zone_id) {
    clauses.push("z.id = ?");
    params.push(Number(query.zone_id));
  }

  if (query.branch_id) {
    clauses.push("b.id = ?");
    params.push(Number(query.branch_id));
  }

  if (query.team_id) {
    clauses.push("t.id = ?");
    params.push(Number(query.team_id));
  }

  if (query.month) {
    clauses.push("p.salary_month = ?");
    params.push(Number(query.month));
  }

  if (query.year) {
    clauses.push("p.salary_year = ?");
    params.push(Number(query.year));
  }

  if (!accessScope.fullAccess) {
    clauses.push("e.emp_id = ?");
    params.push(accessScope.selfEmpId || "__NO_EMP_ID__");
  }

  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
};

const getPayslipById = async (id, accessScope = { fullAccess: true }) => {
  const params = [id];
  let visibilitySql = "";
  if (!accessScope.fullAccess) {
    visibilitySql = " AND e.emp_id = ?";
    params.push(accessScope.selfEmpId || "__NO_EMP_ID__");
  }

  const [[row]] = await db.query(
    `${getPayslipSelectQuery()} WHERE p.id = ?${visibilitySql} LIMIT 1`,
    params,
  );

  if (!row) return null;

  const [components] = await db.query(
    `SELECT
       component_key,
       component_label,
       component_type,
       amount
     FROM payslip_components
     WHERE payslip_id = ?
     ORDER BY id ASC`,
    [id],
  );

  row.components = components;
  row.componentMap = buildComponentState(components);
  return row;
};

const buildTemplatePayload = (row) => ({
  logoBase64: getLogoBase64(),
  payMonth: formatPayMonth(row.salary_month, row.salary_year),
  employeeId: escapeHtml(row.emp_id || ""),
  employeeName: escapeHtml(row.employee_name || ""),
  department: escapeHtml(row.department || ""),
  designation: escapeHtml(row.designation_name || ""),
  doj: escapeHtml(formatDate(row.doj)),
  location: escapeHtml(row.location || ""),
  lopDays: fmtDisplayNumber(row.lop),
  salaryDays: fmtDisplayNumber(row.salary_days),
  accountNumber: escapeHtml(row.account_number || ""),
  basicPay: fmtDisplayNumber(row.componentMap.basicPay),
  hra: fmtDisplayNumber(row.componentMap.hra),
  otherAllowance: fmtDisplayNumber(row.componentMap.otherAllowance),
  foodAllowance: fmtDisplayNumber(row.componentMap.foodAllowance),
  vehicleAllowance: fmtDisplayNumber(row.componentMap.vehicleAllowance),
  ot: fmtDisplayNumber(row.componentMap.ot),
  positionAllowance: fmtDisplayNumber(row.componentMap.positionAllowance),
  arrear: fmtDisplayNumber(row.componentMap.arrear),
  holidayPay: fmtDisplayNumber(row.componentMap.holidayPay),
  totalEarnings: fmtDisplayNumber(row.total_earnings),
  esi: fmtDisplayNumber(row.componentMap.esi),
  pf: fmtDisplayNumber(row.componentMap.pf),
  insurance: fmtDisplayNumber(row.componentMap.insurance),
  uniform: fmtDisplayNumber(row.componentMap.uniform),
  specialDeductions: fmtDisplayNumber(row.componentMap.specialDeductions),
  salaryAdvance: fmtDisplayNumber(row.componentMap.salaryAdvance),
  tds: fmtDisplayNumber(row.componentMap.tds),
  totalDeductions: fmtDisplayNumber(row.total_deductions),
  netPay: fmtDisplayNumber(row.net_pay),
});

const renderPayslipHtml = (row) => {
  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  return renderTemplate(template, buildTemplatePayload(row));
};

const launchPdfBrowser = () =>
  puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

const generatePayslipPdfBuffer = async (row, browserInstance = null) => {
  const browser = browserInstance || (await launchPdfBrowser());
  const ownsBrowser = !browserInstance;

  try {
    const page = await browser.newPage();
    await page.setContent(renderPayslipHtml(row), { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    await page.close();
    return pdfBuffer;
  } finally {
    if (ownsBrowser) {
      await browser.close();
    }
  }
};

const generateAndStorePdfBuffer = async (row, browserInstance = null) => {
  ensurePayslipDir();
  const filePath = buildPdfPath(row.payslip_no);
  const pdfBuffer = await generatePayslipPdfBuffer(row, browserInstance);
  await fs.promises.writeFile(filePath, pdfBuffer);
  return pdfBuffer;
};

const refreshPayslipPdf = async (payslipId) => {
  const row = await getPayslipById(Number(payslipId));
  if (!row) return null;
  await generateAndStorePdfBuffer(row);
  return row;
};

exports.downloadPayslipBulkTemplate = async (_req, res) => {
  const csvContent = [PAYSLIP_BULK_TEMPLATE_HEADERS, PAYSLIP_BULK_SAMPLE_ROW]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="payslip-bulk-upload-template.csv"');
  return res.send(`\uFEFF${csvContent}`);
};

exports.bulkUploadPayslips = async (req, res) => {
  let browser = null;
  let conn = null;
  try {
    assertPayslipManageAccess(req.user);

    if (!req.file) {
      return res.status(400).json({ message: "Upload a CSV or Excel file" });
    }

    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "Uploaded file has no data rows" });
    }

    const referencedEmpIds = [
      ...new Set(
        rows
          .map((row) => String(getField(row, ["emp_id", "employee_id"])).trim())
          .filter(Boolean),
      ),
    ];

    const employeeMap = new Map();
    if (referencedEmpIds.length) {
      const [employees] = await db.query(
        `SELECT id, emp_id, name, email
         FROM employees
         WHERE emp_id IN (${referencedEmpIds.map(() => "?").join(",")})`,
        referencedEmpIds,
      );

      for (const employee of employees) {
        employeeMap.set(String(employee.emp_id).trim().toUpperCase(), employee);
      }
    }

    const inserted = [];
    const failed = [];
    const createdPayslipIds = [];
    conn = await db.getConnection();
    await conn.beginTransaction();

    for (const row of rows) {
      const rowNumber = row.__rowNumber || inserted.length + failed.length + 2;
      const savepointName = `payslip_row_${rowNumber}`;
      const rawEmpId = String(getField(row, ["emp_id", "employee_id"])).trim();

      try {
        await conn.query(`SAVEPOINT ${savepointName}`);

        if (!rawEmpId) {
          throw new Error("emp_id is required");
        }

        const employee = employeeMap.get(rawEmpId.toUpperCase());
        if (!employee) {
          throw new Error(`Employee '${rawEmpId}' not found`);
        }

        const salaryMonth = Number(getField(row, ["salary_month", "month"]));
        const salaryYear = Number(getField(row, ["salary_year", "year"]));
        const salaryDate = normalizeDateInput(getField(row, ["salary_date", "pay_date", "date"]));

        if (!salaryMonth || salaryMonth < 1 || salaryMonth > 12) {
          throw new Error("salary_month must be between 1 and 12");
        }

        if (!salaryYear || salaryYear < 2000) {
          throw new Error("salary_year is required");
        }

        if (!salaryDate) {
          throw new Error("salary_date is required");
        }

        const body = {
          employee_id: employee.id,
          salary_month: salaryMonth,
          salary_year: salaryYear,
          salary_date: salaryDate,
          account_number: normalizeAccountNumber(getField(row, ["account_number"])),
          lop: getField(row, ["lop", "lop_days"]) || 0,
          salary_days: getField(row, ["salary_days"]) || 30,
          remarks: String(getField(row, ["remarks"])).trim(),
          components: PAYSLIP_COMPONENTS.map((component) => ({
            component_key: component.key,
            component_label: component.label,
            component_type: component.type,
            amount: getField(row, [component.key]) || 0,
          })),
        };

        const result = await savePayslip({ conn, body });

        if (result.status >= 400) {
          throw new Error(result.payload?.message || "Failed to create payslip");
        }

        createdPayslipIds.push(result.payload.data.id);
        inserted.push({
          row_number: rowNumber,
          emp_id: employee.emp_id,
          employee_name: employee.name,
          payslip_no: result.payload.data.payslip_no,
          month: formatPayMonth(salaryMonth, salaryYear),
        });
        await conn.query(`RELEASE SAVEPOINT ${savepointName}`);
      } catch (error) {
        await conn.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        failed.push({
          row_number: rowNumber,
          emp_id: rawEmpId || "-",
          error: error.message || "Failed to create payslip",
        });
      }
    }

    await conn.commit();
    conn.release();
    conn = null;

    if (createdPayslipIds.length) {
      browser = await launchPdfBrowser();
      await runWithConcurrency(createdPayslipIds, 4, async (payslipId) => {
        const row = await getPayslipById(payslipId);
        if (row) {
          await generateAndStorePdfBuffer(row, browser);
        }
      });
    }

    return res.json(
      buildResponsePayload(
        rows,
        inserted,
        failed,
        "Payslip bulk upload completed successfully",
        "Payslip bulk upload completed with some failed rows",
      ),
    );
  } catch (error) {
    if (conn) {
      await conn.rollback();
    }
    console.error("BULK PAYSLIP UPLOAD ERROR:", error);
    return res.status(error.status || 500).json({ message: error.message || "Payslip bulk upload failed" });
  } finally {
    if (conn) {
      conn.release();
    }
    if (browser) {
      await browser.close();
    }
  }
};

const savePayslip = async ({
  conn,
  payslipId = null,
  body = {},
  existingPayslipNo = null,
}) => {
  const employeeId = Number(body.employee_id);
  const salaryMonth = Number(body.salary_month);
  const salaryYear = Number(body.salary_year);
  const salaryDate = body.salary_date;

  if (!employeeId || !salaryMonth || !salaryYear || !salaryDate) {
    return { status: 400, payload: { message: "Employee, salary month, year and date are required" } };
  }

  const normalizedComponents = normalizeComponents(body.components);
  const totals = calculateTotals(normalizedComponents);
  const netPay = safeNumber(totals.total_earnings - totals.total_deductions);
  const accountNumber = normalizeAccountNumber(body.account_number).slice(0, 50);

  const [[employee]] = await conn.query(
    `SELECT id, emp_id, name, email
     FROM employees
     WHERE id = ?
     LIMIT 1`,
    [employeeId],
  );

  if (!employee) {
    return { status: 404, payload: { message: "Employee not found" } };
  }

  const duplicateParams = [employeeId, salaryMonth, salaryYear];
  let duplicateSql = `
    SELECT id, payslip_no
    FROM payslips
    WHERE employee_id = ? AND salary_month = ? AND salary_year = ?
  `;

  if (payslipId) {
    duplicateSql += " AND id <> ?";
    duplicateParams.push(payslipId);
  }

  duplicateSql += " LIMIT 1";

  const [[existing]] = await conn.query(duplicateSql, duplicateParams);

  if (existing) {
    return {
      status: 409,
      payload: {
        message: `Payslip already exists for this employee for ${formatPayMonth(salaryMonth, salaryYear)}`,
      },
    };
  }

  if (accountNumber) {
    const accountParams = [accountNumber, employeeId];
    let accountSql = `
      SELECT p.id, e.emp_id, e.name
      FROM payslips p
      INNER JOIN employees e ON e.id = p.employee_id
      WHERE p.account_number = ? AND p.employee_id <> ?
    `;

    if (payslipId) {
      accountSql += " AND p.id <> ?";
      accountParams.push(payslipId);
    }

    accountSql += " LIMIT 1";

    const [[duplicateAccount]] = await conn.query(accountSql, accountParams);
    if (duplicateAccount) {
      return {
        status: 409,
        payload: {
          message: `Account number already used for ${duplicateAccount.emp_id} - ${duplicateAccount.name}`,
        },
      };
    }
  }

  const payload = [
    employeeId,
    salaryMonth,
    salaryYear,
    salaryDate,
    accountNumber || null,
    safeNumber(body.lop),
    safeNumber(body.salary_days),
    safeNumber(totals.total_earnings),
    safeNumber(totals.total_deductions),
    netPay,
    body.remarks ? String(body.remarks).trim().slice(0, 255) : null,
  ];

  let resolvedPayslipId = payslipId;
  let payslipNo = existingPayslipNo;

  if (payslipId) {
    await conn.query(
      `UPDATE payslips
       SET employee_id = ?,
           salary_month = ?,
           salary_year = ?,
           salary_date = ?,
           account_number = ?,
           lop = ?,
           salary_days = ?,
           total_earnings = ?,
           total_deductions = ?,
           net_pay = ?,
           remarks = ?
       WHERE id = ?`,
      [...payload, payslipId],
    );

    await conn.query("DELETE FROM payslip_components WHERE payslip_id = ?", [payslipId]);
  } else {
    const tempPayslipNo = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const [insertResult] = await conn.query(
      `INSERT INTO payslips (
         payslip_no,
         employee_id,
         salary_month,
         salary_year,
         salary_date,
         account_number,
         lop,
         salary_days,
         total_earnings,
         total_deductions,
         net_pay,
         remarks,
         created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tempPayslipNo, ...payload, null],
    );

    resolvedPayslipId = insertResult.insertId;
    payslipNo = `PSL-${salaryYear}${String(salaryMonth).padStart(2, "0")}-${String(insertResult.insertId).padStart(5, "0")}`;

    await conn.query(
      "UPDATE payslips SET payslip_no = ? WHERE id = ?",
      [payslipNo, resolvedPayslipId],
    );
  }

  if (normalizedComponents.length) {
    const values = normalizedComponents.map((component) => [
      resolvedPayslipId,
      component.component_key,
      component.component_label,
      component.component_type,
      component.amount,
    ]);

    await conn.query(
      `INSERT INTO payslip_components (
         payslip_id,
         component_key,
         component_label,
         component_type,
         amount
       ) VALUES ?`,
      [values],
    );
  }

  return {
    status: payslipId ? 200 : 201,
    payload: {
      message: payslipId ? "Payslip updated successfully" : "Payslip created successfully",
      data: {
        id: resolvedPayslipId,
        payslip_no: payslipNo,
        employee_id: employeeId,
        employee_name: employee.name,
        email: employee.email,
        salary_month: salaryMonth,
        salary_year: salaryYear,
        total_earnings: safeNumber(totals.total_earnings),
        total_deductions: safeNumber(totals.total_deductions),
        net_pay: netPay,
      },
    },
  };
};

exports.searchEmployees = async (req, res) => {
  try {
    assertPayslipManageAccess(req.user);
    const search = String(req.query.search || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25);
    if (!search) {
      return res.json({ data: [] });
    }

    const pattern = `%${search}%`;
    const [rows] = await db.query(
      `SELECT
         e.id,
         e.emp_id,
         e.name AS employee_name,
         e.email,
         e.joining_date AS doj,
         b.id AS branch_id,
         b.branch_name,
         z.id AS zone_id,
         z.zone_name,
         t.id AS team_id,
         t.team_name AS department,
         d.id AS designation_id,
         d.designation_name,
         COALESCE(b.branch_name, z.zone_name, t.team_name, '') AS location
       FROM employees e
       LEFT JOIN branches b ON b.id = e.branch_id
       LEFT JOIN zones z ON z.id = b.zone_id
       LEFT JOIN teams t ON t.id = e.team_id
       LEFT JOIN designations d ON d.id = e.designation_id
       WHERE UPPER(COALESCE(e.status, 'ACTIVE')) = 'ACTIVE'
         AND (
           e.emp_id LIKE ?
           OR e.name LIKE ?
           OR COALESCE(e.email, '') LIKE ?
         )
       ORDER BY
         CASE WHEN e.emp_id LIKE ? THEN 0 ELSE 1 END,
         e.name ASC
       LIMIT ?`,
      [pattern, pattern, pattern, `${search}%`, limit],
    );

    res.json({ data: rows });
  } catch (error) {
    console.error("PAYSLIP EMPLOYEE SEARCH ERROR:", error);
    res.status(error.status || 500).json({ message: error.message || "Failed to search employees" });
  }
};

exports.createPayslip = async (req, res) => {
  const conn = await db.getConnection();
  try {
    assertPayslipManageAccess(req.user);
    await conn.beginTransaction();
    const result = await savePayslip({
      conn,
      body: req.body || {},
    });

    if (result.status >= 400) {
      await conn.rollback();
      return res.status(result.status).json(result.payload);
    }

    await conn.commit();
    await refreshPayslipPdf(result.payload.data.id);
    res.status(result.status).json(result.payload);
  } catch (error) {
    await conn.rollback();
    console.error("CREATE PAYSLIP ERROR:", error);
    res.status(error.status || 500).json({ message: error.message || "Failed to create payslip" });
  } finally {
    conn.release();
  }
};

exports.updatePayslip = async (req, res) => {
  const conn = await db.getConnection();
  try {
    assertPayslipManageAccess(req.user);
    const payslipId = Number(req.params.id);
    if (!payslipId) {
      return res.status(400).json({ message: "Valid payslip id is required" });
    }

    const [[existingPayslip]] = await conn.query(
      "SELECT id, payslip_no FROM payslips WHERE id = ? LIMIT 1",
      [payslipId],
    );

    if (!existingPayslip) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    await conn.beginTransaction();

    const result = await savePayslip({
      conn,
      payslipId,
      body: req.body || {},
      existingPayslipNo: existingPayslip.payslip_no,
    });

    if (result.status >= 400) {
      await conn.rollback();
      return res.status(result.status).json(result.payload);
    }

    await conn.commit();
    await refreshPayslipPdf(payslipId);
    res.status(200).json(result.payload);
  } catch (error) {
    await conn.rollback();
    console.error("UPDATE PAYSLIP ERROR:", error);
    res.status(error.status || 500).json({ message: error.message || "Failed to update payslip" });
  } finally {
    conn.release();
  }
};

exports.getPayslips = async (req, res) => {
  try {
    const accessScope = getPayslipAccessScope(req.user);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const params = [];
    const whereSql = buildPayslipFilters(req.query, params, accessScope);

    const [rows] = await db.query(
      `${getPayslipSelectQuery()}
       ${whereSql}
       ORDER BY p.salary_year DESC, p.salary_month DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       ${getPayslipBaseQuery()}
       ${whereSql}`,
      params,
    );

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: countRow.total || 0,
        totalPages: Math.max(Math.ceil((countRow.total || 0) / limit), 1),
      },
      access: {
        fullAccess: accessScope.fullAccess,
        canManage: accessScope.canManage,
      },
    });
  } catch (error) {
    console.error("LIST PAYSLIPS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch payslips" });
  }
};

exports.getPayslipById = async (req, res) => {
  try {
    const row = await getPayslipById(Number(req.params.id), getPayslipAccessScope(req.user));
    if (!row) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    res.json({ data: row });
  } catch (error) {
    console.error("GET PAYSLIP BY ID ERROR:", error);
    res.status(500).json({ message: "Failed to fetch payslip" });
  }
};

exports.previewPayslip = async (req, res) => {
  try {
    const row = await getPayslipById(Number(req.params.id), getPayslipAccessScope(req.user));
    if (!row) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const pdfBuffer = await generateAndStorePdfBuffer(row);
    setNoCacheHeaders(res);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${row.payslip_no}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error("PREVIEW PAYSLIP ERROR:", error);
    res.status(500).json({ message: "Failed to preview payslip" });
  }
};

exports.downloadPayslip = async (req, res) => {
  try {
    const row = await getPayslipById(Number(req.params.id), getPayslipAccessScope(req.user));
    if (!row) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const pdfBuffer = await generateAndStorePdfBuffer(row);
    setNoCacheHeaders(res);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${row.payslip_no}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error("DOWNLOAD PAYSLIP ERROR:", error);
    res.status(500).json({ message: "Failed to download payslip" });
  }
};

exports.deletePayslip = async (req, res) => {
  const payslipId = Number(req.params.id);

  if (!payslipId) {
    return res.status(400).json({ message: "Valid payslip id is required" });
  }

  if (!canDeletePayslip(req.user)) {
    return res
      .status(403)
      .json({ message: "Only Admin and Super Admin can delete payslips" });
  }

  let conn;
  try {
    const [[existingPayslip]] = await db.query(
      "SELECT id, payslip_no FROM payslips WHERE id = ? LIMIT 1",
      [payslipId],
    );

    if (!existingPayslip) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query("DELETE FROM payslip_components WHERE payslip_id = ?", [
      payslipId,
    ]);
    const [deleteResult] = await conn.query("DELETE FROM payslips WHERE id = ?", [
      payslipId,
    ]);

    if (!deleteResult.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ message: "Payslip not found" });
    }

    await conn.commit();

    const pdfPath = buildPdfPath(existingPayslip.payslip_no);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    return res.json({ message: "Payslip deleted successfully" });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("DELETE PAYSLIP ROLLBACK ERROR:", rollbackError);
      }
    }
    console.error("DELETE PAYSLIP ERROR:", error);
    return res.status(500).json({ message: "Failed to delete payslip" });
  } finally {
    if (conn) conn.release();
  }
};

exports.sendPayslipMail = async (req, res) => {
  try {
    const payslipId = Number(req.body?.payslip_id);
    const requestedEmail = String(req.body?.email || "").trim();

    if (!payslipId) {
      return res.status(400).json({ message: "Payslip id is required" });
    }

    const row = await getPayslipById(payslipId, getPayslipAccessScope(req.user));
    if (!row) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    const to = requestedEmail || row.email;
    if (!to) {
      return res.status(400).json({ message: "Employee email is not available" });
    }

    const pdfBuffer = await generateAndStorePdfBuffer(row);
    await sendMailWithFallback({
      to,
      subject: `Payslip ${row.payslip_no}`,
      html: `
        <p>Dear ${escapeHtml(row.employee_name || "Employee")},</p>
        <p>Please find attached your payslip for ${escapeHtml(formatPayMonth(row.salary_month, row.salary_year))}.</p>
        <p>Regards,<br/>HR Team</p>
      `,
      attachments: [
        {
          filename: `${row.payslip_no}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    }, "HR System");

    res.json({ message: "Payslip mailed successfully" });
  } catch (error) {
    console.error("SEND PAYSLIP MAIL ERROR:", error);
    const statusCode =
      error.code === "EAUTH" ||
      error.code === "ESOCKET" ||
      error.code === "ECONNRESET" ||
      error.command === "CONN"
        ? 502
        : 500;
    res.status(statusCode).json({
      message: getReadableMailError(error) || "Failed to send payslip mail",
    });
  }
};
