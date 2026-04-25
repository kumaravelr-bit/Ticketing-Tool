const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const numberToWords = require("../utils/hrd/numberToWords");
const generateHTML = require("../utils/hrd/htmlGenerator");
const {
  getReadableMailError,
  sendMailWithFallback,
} = require("../utils/mailTransport");

require("dotenv").config();

const uploadDir = path.join(__dirname, "../uploads/offer_letters");
const backendRootDir = path.join(__dirname, "..");

const OFFER_BULK_TEMPLATE_HEADERS = [
  "employee_name",
  "email",
  "phone",
  "zone",
  "branch",
  "designation",
  "team_name",
  "doj",
  "gender",
  "marital_status",
  "grade",
  "probation_period",
  "gross_pay",
  "insurance",
];

const OFFER_BULK_SAMPLE_ROW = [
  "Kumaravel R",
  "kumaravel@example.com",
  "9876543210",
  "West",
  "Namakkal",
  "Manager",
  "IT",
  "2026-04-25",
  "MALE",
  "MARRIED",
  "A1",
  "6",
  "25000",
  "250",
];

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let offerLetterSchemaChecked = false;

const safeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
};

const formatIndianCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatOfferDisplayDate = (value, locale = "en-IN") => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const mapOfferGenderPrefix = (gender) => {
  const normalizedGender = String(gender || "").trim().toUpperCase();
  if (normalizedGender === "MALE") return "Mr.";
  if (normalizedGender === "FEMALE") return "Ms.";
  return "";
};

const normalizeOfferGender = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  if (["MALE", "FEMALE", "OTHERS"].includes(normalized)) {
    return normalized;
  }
  throw new Error("gender must be MALE, FEMALE, or OTHERS");
};

const normalizeOfferMaritalStatus = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  if (["SINGLE", "MARRIED"].includes(normalized)) {
    return normalized;
  }
  throw new Error("marital_status must be SINGLE or MARRIED");
};

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

const ensureOfferLetterFilePathSchema = async () => {
  if (offerLetterSchemaChecked) return;

  const filePathExists = await hasColumn("offer_letters", "file_path");
  if (!filePathExists) {
    try {
      await db.execute(
        "ALTER TABLE offer_letters ADD COLUMN file_path VARCHAR(255) NULL AFTER gross_pay_words"
      );
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }
  }

  offerLetterSchemaChecked = true;
};

const buildOfferSafeFileName = (documentId) =>
  String(documentId || "").replace(/[\/\\]/g, "_");

const buildOfferRelativePath = (documentId) =>
  `uploads/offer_letters/${buildOfferSafeFileName(documentId)}.pdf`;

const resolveOfferAbsolutePath = (storedPath, documentId) => {
  if (storedPath) {
    const cleanPath = String(storedPath).replace(/^\/+/, "");
    return path.isAbsolute(cleanPath)
      ? cleanPath
      : path.join(backendRootDir, cleanPath);
  }

  return path.join(uploadDir, `${buildOfferSafeFileName(documentId)}.pdf`);
};

const calculateOfferSalary = (grossPayInput, insuranceInput) => {
  const gp = safeNumber(grossPayInput);
  const insurance = safeNumber(insuranceInput);

  const basic = Math.round(gp * 0.6);
  const hra = Math.round(gp * 0.2);
  const other = Math.round(gp - (basic + hra));
  const grossA = basic + hra + other;
  const esi_employee = grossA >= 21000 ? 0 : Math.round((grossA * 0.75) / 100);
  const pfBase = basic + other;
  const pf_employee = pfBase >= 15000 ? 1800 : Math.round((pfBase * 12) / 100);
  const total_deduction_a = esi_employee + pf_employee + insurance;
  const takeHome = grossA - total_deduction_a;
  const esi_employer = grossA >= 21000 ? 0 : Math.round((grossA * 3.25) / 100);
  const pf_employer = pfBase >= 15000 ? 1800 : Math.round((pfBase * 12) / 100);
  const total_deduction_b = esi_employer + pf_employer;
  const monthlyCTC = grossA + total_deduction_b;
  const annualCTC = monthlyCTC * 12;

  return {
    gp,
    insurance,
    basic,
    hra,
    other,
    grossA,
    esi_employee,
    pf_employee,
    total_deduction_a,
    takeHome,
    esi_employer,
    pf_employer,
    total_deduction_b,
    monthlyCTC,
    annualCTC,
    gross_words: numberToWords(gp),
    annual_ctc_words: numberToWords(annualCTC),
  };
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

const csvEscape = (value = "") => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const normalizeKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

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
      Object.entries(rawRow).map(([key, value]) => [normalizeKey(key), value])
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

const getOfferBranchName = async (branchId, conn = db) => {
  if (!branchId) return "";

  const [branchRows] = await conn.execute(
    "SELECT branch_name FROM branches WHERE id = ? LIMIT 1",
    [branchId]
  );

  return branchRows[0]?.branch_name || "";
};

const getOfferLetterRecordById = async (id, conn = db) => {
  const [rows] = await conn.execute(
    "SELECT * FROM offer_letters WHERE id = ? LIMIT 1",
    [id]
  );

  return rows[0] || null;
};

const generateDocumentId = async (conn = db) => {
  const year = new Date().getFullYear();
  const [rows] = await conn.execute(
    `SELECT id
     FROM offer_letters
     WHERE YEAR(generated_date) = ?
     ORDER BY id DESC
     LIMIT 1`,
    [year]
  );

  const next = rows.length ? Number(rows[0].id) + 1 : 1;
  return `Infonet Comm/HR/OL/${year}/${String(next).padStart(3, "0")}`;
};

const launchOfferBrowser = () =>
  puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

const buildOfferTemplateData = async (offerRow, conn = db) => {
  const salary = calculateOfferSalary(offerRow.gross_pay, offerRow.insurance);
  const branchName = offerRow.location || (await getOfferBranchName(offerRow.branch_id, conn));

  return {
    document_id: offerRow.document_id,
    generated_date: formatOfferDisplayDate(
      offerRow.generated_date || new Date(),
      "en-IN"
    ),
    employee_name: offerRow.employee_name || "",
    employee_status: mapOfferGenderPrefix(offerRow.gender),
    phone: offerRow.phone || "",
    email: offerRow.email || "",
    designation: offerRow.designation || "",
    team_name: offerRow.team_name || "",
    location: branchName,
    doj: formatOfferDisplayDate(offerRow.doj, "en-IN"),
    gross_pay: formatIndianCurrency(salary.gp),
    gross_words: salary.gross_words,
    annual_ctc_words: salary.annual_ctc_words,
    basic: formatIndianCurrency(salary.basic),
    hra: formatIndianCurrency(salary.hra),
    other: formatIndianCurrency(salary.other),
    grossA: formatIndianCurrency(salary.grossA),
    esi_employee: formatIndianCurrency(salary.esi_employee),
    pf_employee: formatIndianCurrency(salary.pf_employee),
    insurance: formatIndianCurrency(salary.insurance),
    total_deduction_a: formatIndianCurrency(salary.total_deduction_a),
    takeHome: formatIndianCurrency(salary.takeHome),
    esi_employer: formatIndianCurrency(salary.esi_employer),
    pf_employer: formatIndianCurrency(salary.pf_employer),
    total_deduction_b: formatIndianCurrency(salary.total_deduction_b),
    monthlyCTC: formatIndianCurrency(salary.monthlyCTC),
    annualCTC: formatIndianCurrency(salary.annualCTC),
  };
};

const buildOfferPdfBuffer = async (offerRow, conn = db, browser = null) => {
  const templateData = await buildOfferTemplateData(offerRow, conn);
  const htmlContent = generateHTML(templateData);

  let localBrowser = browser;
  let shouldCloseBrowser = false;

  if (!localBrowser) {
    localBrowser = await launchOfferBrowser();
    shouldCloseBrowser = true;
  }

  try {
    const page = await localBrowser.newPage();
    try {
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      return await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
        margin: {
          top: "0",
          bottom: "0",
          left: "0",
          right: "0",
        },
      });
    } finally {
      await page.close();
    }
  } finally {
    if (shouldCloseBrowser && localBrowser) {
      await localBrowser.close();
    }
  }
};

const ensureOfferLetterPdf = async (offerRow, options = {}) => {
  if (!offerRow) {
    throw new Error("Offer letter row is required for PDF generation");
  }

  const filePath = resolveOfferAbsolutePath(
    offerRow.file_path || buildOfferRelativePath(offerRow.document_id),
    offerRow.document_id
  );

  if (!options.force && fs.existsSync(filePath)) {
    return filePath;
  }

  const pdfBuffer = await buildOfferPdfBuffer(offerRow, db, options.browser);
  await fs.promises.writeFile(filePath, pdfBuffer);
  return filePath;
};

const prepareOfferMutation = async (rawInput, existingDocumentId = null, conn = db) => {
  const employee_name = String(rawInput.employee_name || "").trim();
  const designation = String(rawInput.designation || "").trim();
  const team_name = String(rawInput.team_name || "").trim();
  const email = String(rawInput.email || "").trim();
  const phone = String(rawInput.phone || "").trim();
  const grade = String(rawInput.grade || "").trim();
  const probation_period = rawInput.probation_period === "" || rawInput.probation_period === undefined
    ? null
    : safeNumber(rawInput.probation_period);
  const zone_id = rawInput.zone_id ? Number(rawInput.zone_id) : null;
  const branch_id = rawInput.branch_id ? Number(rawInput.branch_id) : null;
  const doj = normalizeDateInput(rawInput.doj);
  const gender = normalizeOfferGender(rawInput.gender);
  const marital_status = normalizeOfferMaritalStatus(rawInput.marital_status);
  const salary = calculateOfferSalary(
    rawInput.grossPay ?? rawInput.gross_pay,
    rawInput.insurance
  );
  const document_id = existingDocumentId || (await generateDocumentId(conn));
  const file_path = buildOfferRelativePath(document_id);

  if (!employee_name) throw new Error("employee_name is required");
  if (!designation) throw new Error("designation is required");
  if (!team_name) throw new Error("team_name is required");
  if (!doj) throw new Error("doj is required");
  if (!gender) throw new Error("gender is required");
  if (!branch_id) throw new Error("branch_id is required");
  if (!zone_id) throw new Error("zone_id is required");
  if (salary.gp <= 0) throw new Error("gross_pay must be greater than 0");

  const branchName = await getOfferBranchName(branch_id, conn);

  return {
    document_id,
    file_path,
    employee_name,
    email,
    phone,
    zone_id,
    branch_id,
    designation,
    team_name,
    doj,
    gender,
    marital_status,
    grade: grade || null,
    probation_period,
    salary,
    branchName,
  };
};

const insertOfferLetter = async (conn, payload) => {
  const [result] = await conn.execute(
    `INSERT INTO offer_letters
      (document_id, employee_name, email, phone, zone_id, branch_id, designation, team_name,
       doj, gender, marital_status, grade, probation_period,
       gross_pay, insurance,
       basic, hra, other_allowance, gross_salary_a,
       esi_employee, pf_employee, total_deduction_a, take_home,
       esi_employer, pf_employer, total_deduction_b,
       monthly_ctc, annual_ctc, gross_pay_words, file_path)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      payload.document_id,
      payload.employee_name,
      payload.email || null,
      payload.phone || null,
      payload.zone_id,
      payload.branch_id,
      payload.designation,
      payload.team_name,
      payload.doj,
      payload.gender,
      payload.marital_status,
      payload.grade,
      payload.probation_period,
      payload.salary.gp,
      payload.salary.insurance,
      payload.salary.basic,
      payload.salary.hra,
      payload.salary.other,
      payload.salary.grossA,
      payload.salary.esi_employee,
      payload.salary.pf_employee,
      payload.salary.total_deduction_a,
      payload.salary.takeHome,
      payload.salary.esi_employer,
      payload.salary.pf_employer,
      payload.salary.total_deduction_b,
      payload.salary.monthlyCTC,
      payload.salary.annualCTC,
      payload.salary.gross_words,
      payload.file_path,
    ]
  );

  return result.insertId;
};

const updateOfferLetterRecord = async (conn, id, payload) => {
  await conn.execute(
    `UPDATE offer_letters SET
      employee_name=?, email=?, phone=?, zone_id=?, branch_id=?, designation=?, team_name=?,
      doj=?, gender=?, marital_status=?, grade=?, probation_period=?,
      gross_pay=?, insurance=?,
      basic=?, hra=?, other_allowance=?, gross_salary_a=?,
      esi_employee=?, pf_employee=?, total_deduction_a=?, take_home=?,
      esi_employer=?, pf_employer=?, total_deduction_b=?,
      monthly_ctc=?, annual_ctc=?, gross_pay_words=?, file_path=?
     WHERE id=?`,
    [
      payload.employee_name,
      payload.email || null,
      payload.phone || null,
      payload.zone_id,
      payload.branch_id,
      payload.designation,
      payload.team_name,
      payload.doj,
      payload.gender,
      payload.marital_status,
      payload.grade,
      payload.probation_period,
      payload.salary.gp,
      payload.salary.insurance,
      payload.salary.basic,
      payload.salary.hra,
      payload.salary.other,
      payload.salary.grossA,
      payload.salary.esi_employee,
      payload.salary.pf_employee,
      payload.salary.total_deduction_a,
      payload.salary.takeHome,
      payload.salary.esi_employer,
      payload.salary.pf_employer,
      payload.salary.total_deduction_b,
      payload.salary.monthlyCTC,
      payload.salary.annualCTC,
      payload.salary.gross_words,
      payload.file_path,
      id,
    ]
  );
};

const resolveZoneAndBranchLookups = async () => {
  const [zones] = await db.execute("SELECT id, zone_name FROM zones");
  const [branches] = await db.execute(
    "SELECT id, zone_id, branch_name, short_name FROM branches"
  );

  const zoneMap = new Map();
  zones.forEach((zone) => {
    zoneMap.set(String(zone.id), zone);
    zoneMap.set(String(zone.zone_name || "").trim().toUpperCase(), zone);
  });

  const branchMap = new Map();
  branches.forEach((branch) => {
    branchMap.set(String(branch.id), branch);
    branchMap.set(String(branch.branch_name || "").trim().toUpperCase(), branch);
    if (branch.short_name) {
      branchMap.set(String(branch.short_name).trim().toUpperCase(), branch);
    }
  });

  return { zoneMap, branchMap };
};

const resolveZoneReference = (zoneMap, reference) => {
  const raw = String(reference || "").trim();
  if (!raw) return null;
  return zoneMap.get(raw.toUpperCase()) || zoneMap.get(raw) || null;
};

const resolveBranchReference = (branchMap, reference) => {
  const raw = String(reference || "").trim();
  if (!raw) return null;
  return branchMap.get(raw.toUpperCase()) || branchMap.get(raw) || null;
};

exports.getOfferLetters = async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        ol.id,
        ol.document_id,
        ol.employee_name,
        ol.email,
        ol.phone,
        ol.zone_id,
        ol.branch_id,
        z.zone_name,
        b.branch_name,
        ol.designation,
        ol.team_name,
        ol.doj,
        ol.gross_pay,
        ol.generated_date
      FROM offer_letters ol
      LEFT JOIN zones z ON ol.zone_id = z.id
      LEFT JOIN branches b ON ol.branch_id = b.id
      ORDER BY ol.id DESC
    `);

    return res.json(rows);
  } catch (error) {
    console.error("LIST ERROR:", error);
    return res.status(500).json({ error: "Failed to fetch offer letters" });
  }
};

exports.generateOfferLetter = async (req, res) => {
  let conn = null;

  try {
    await ensureOfferLetterFilePathSchema();

    conn = await db.getConnection();
    await conn.beginTransaction();

    const payload = await prepareOfferMutation(req.body, null, conn);
    const insertedId = await insertOfferLetter(conn, payload);
    const offerRow = {
      id: insertedId,
      document_id: payload.document_id,
      employee_name: payload.employee_name,
      email: payload.email,
      phone: payload.phone,
      zone_id: payload.zone_id,
      branch_id: payload.branch_id,
      designation: payload.designation,
      team_name: payload.team_name,
      doj: payload.doj,
      gender: payload.gender,
      marital_status: payload.marital_status,
      grade: payload.grade,
      probation_period: payload.probation_period,
      gross_pay: payload.salary.gp,
      insurance: payload.salary.insurance,
      generated_date: new Date(),
      file_path: payload.file_path,
      location: payload.branchName,
    };

    const pdfBuffer = await buildOfferPdfBuffer(offerRow, conn);
    await fs.promises.writeFile(
      resolveOfferAbsolutePath(payload.file_path, payload.document_id),
      pdfBuffer
    );

    await conn.commit();
    conn.release();
    conn = null;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildOfferSafeFileName(
        payload.document_id
      )}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("GENERATE ERROR:", error);
    return res.status(500).json({
      error: "Failed to generate offer letter",
      details: error.message,
    });
  }
};

exports.downloadOfferLetter = async (req, res) => {
  try {
    await ensureOfferLetterFilePathSchema();

    const offer = await getOfferLetterRecordById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Record not found" });
    }

    const filePath = await ensureOfferLetterPdf(offer, { force: true });
    return res.download(filePath, `${offer.document_id}.pdf`);
  } catch (error) {
    console.error("DOWNLOAD ERROR:", error);
    return res.status(500).json({ error: "Download failed" });
  }
};

exports.sendOfferLetterMail = async (req, res) => {
  try {
    const { email, document_id } = req.body;

    const [offerRows] = await db.execute(
      `SELECT
        ol.*,
        b.branch_name
      FROM offer_letters ol
      LEFT JOIN branches b ON b.id = ol.branch_id
      WHERE ol.document_id = ?
      LIMIT 1`,
      [document_id]
    );

    if (!offerRows.length) {
      return res.status(404).json({
        success: false,
        message: "Offer letter record not found",
      });
    }

    const offer = offerRows[0];
    const candidateName = String(offer.employee_name || "Candidate").trim();
    const candidateEmail = String(email || offer.email || "").trim();
    const designation = String(offer.designation || "").trim();
    const team = String(offer.team_name || "").trim();
    const location = String(offer.branch_name || "").trim();

    if (!candidateEmail) {
      return res.status(400).json({
        success: false,
        message: "Candidate email is missing",
      });
    }

    const filePath = await ensureOfferLetterPdf(
      {
        ...offer,
        file_path: offer.file_path || buildOfferRelativePath(document_id),
      },
      { force: true }
    );

    const roleLine = [designation, team].filter(Boolean).join(" ");
    const roleWithLocation = `${roleLine || "the offered role"}${
      location ? ` (${location})` : ""
    }`;
    const subject = roleLine
      ? `Offer of Employment - ${roleWithLocation}`
      : "Offer of Employment";
    const safeName = escapeHtml(candidateName);
    const safeRoleWithLocation = escapeHtml(roleWithLocation);
    const plainText = `Dear ${candidateName},

Greetings from Infonet Comm Enterprises !!!

Congratulations !!!

We are pleased to inform you that you have been selected for the role of ${roleWithLocation} with our team with your agreed DOJ as Mentioned in Offer Letter. Your Offer will expire automatically in case you couldn't join on the mentioned date.

Please go through the offer letter carefully. Should you have any queries or need further clarifications, feel free to reach out to us. We are happy to assist you.

As a token of acknowledgment, kindly accept the offer and revert back to this email with your confirmation by end of the day.

We are excited to have you on board and look forward to your positive response
`;

    await sendMailWithFallback(
      {
        to: candidateEmail,
        subject,
        text: plainText,
        html: `
          <p><strong>Dear ${safeName}</strong>,</p>
          <p><strong>Greetings from Infonet Comm Enterprises !!!</strong></p>
          <p><strong>Congratulations !!!</strong></p>
          <p>
            We are pleased to inform you that you have been selected for the role of
            <strong>${safeRoleWithLocation}</strong> with our team with your agreed DOJ as Mentioned
            in Offer Letter. Your Offer will expire automatically in case you couldn't join on the
            mentioned date.
          </p>
          <p>
            Please go through the offer letter carefully. Should you have any queries or need
            further clarifications, feel free to reach out to us. We are happy to assist you.
          </p>
          <p>
            As a token of acknowledgment, kindly accept the offer and revert back to this email
            with your confirmation by end of the day.
          </p>
          <p>
            We are excited to have you on board and look forward to your positive response
          </p>
        `,
        attachments: [
          {
            filename: `${document_id}.pdf`,
            path: filePath,
          },
        ],
      },
      "HR Team"
    );

    return res.status(200).json({
      success: true,
      message: "Mail sent successfully",
    });
  } catch (error) {
    console.error("Mail Error:", error);
    const message = getReadableMailError(error);
    const statusCode =
      error.code === "EAUTH" ||
      error.code === "ESOCKET" ||
      error.code === "ECONNRESET" ||
      error.command === "CONN"
        ? 502
        : 500;
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

exports.getOfferLetterById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const offer = await getOfferLetterRecordById(id);
    if (!offer) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json(offer);
  } catch (error) {
    console.error("GET ERROR:", error);
    return res.status(500).json({ error: "Fetch error" });
  }
};

exports.updateOfferLetter = async (req, res) => {
  let conn = null;

  try {
    await ensureOfferLetterFilePathSchema();

    const { id } = req.params;
    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const existing = await getOfferLetterRecordById(id);
    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const payload = await prepareOfferMutation(
      {
        ...existing,
        ...req.body,
        generated_date: existing.generated_date,
      },
      existing.document_id,
      conn
    );

    await updateOfferLetterRecord(conn, id, payload);

    const pdfRow = {
      ...existing,
      ...req.body,
      id: Number(id),
      document_id: existing.document_id,
      employee_name: payload.employee_name,
      email: payload.email,
      phone: payload.phone,
      zone_id: payload.zone_id,
      branch_id: payload.branch_id,
      designation: payload.designation,
      team_name: payload.team_name,
      doj: payload.doj,
      gender: payload.gender,
      marital_status: payload.marital_status,
      grade: payload.grade,
      probation_period: payload.probation_period,
      gross_pay: payload.salary.gp,
      insurance: payload.salary.insurance,
      generated_date: existing.generated_date,
      file_path: payload.file_path,
      location: payload.branchName,
    };

    const pdfBuffer = await buildOfferPdfBuffer(pdfRow, conn);
    await fs.promises.writeFile(
      resolveOfferAbsolutePath(payload.file_path, existing.document_id),
      pdfBuffer
    );

    await conn.commit();
    conn.release();
    conn = null;

    return res.json({ message: "Updated successfully" });
  } catch (error) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("UPDATE ERROR:", error);
    return res.status(500).json({ error: error.message || "Update failed" });
  }
};

exports.previewOfferLetter = async (req, res) => {
  try {
    await ensureOfferLetterFilePathSchema();

    const offer = await getOfferLetterRecordById(req.params.id);
    if (!offer) {
      return res.status(404).send("Not found");
    }

    const filePath = await ensureOfferLetterPdf(offer, { force: true });
    const pdfBuffer = await fs.promises.readFile(filePath);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${offer.document_id}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Preview Error:", error);
    return res.status(500).json({ error: "Failed to preview" });
  }
};

exports.downloadOfferLetterBulkTemplate = async (_req, res) => {
  const csvContent = [OFFER_BULK_TEMPLATE_HEADERS, OFFER_BULK_SAMPLE_ROW]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="offer-letter-bulk-upload-template.csv"'
  );
  return res.send(`\uFEFF${csvContent}`);
};

exports.bulkUploadOfferLetters = async (req, res) => {
  let conn = null;
  let browser = null;

  try {
    await ensureOfferLetterFilePathSchema();

    if (!req.file) {
      return res.status(400).json({ message: "Upload a CSV or Excel file" });
    }

    const rows = readUploadRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ message: "Uploaded file has no data rows" });
    }

    const { zoneMap, branchMap } = await resolveZoneAndBranchLookups();
    const inserted = [];
    const failed = [];
    const createdOfferIds = [];

    conn = await db.getConnection();
    await conn.beginTransaction();

    for (const row of rows) {
      const rowNumber = row.__rowNumber || inserted.length + failed.length + 2;
      const savepointName = `offer_row_${rowNumber}`;
      const employeeName = String(
        getField(row, ["employee_name", "name", "candidate_name"])
      ).trim();
      const branchRef = String(
        getField(row, ["branch", "branch_name", "branch_id", "short_name"])
      ).trim();

      try {
        await conn.query(`SAVEPOINT ${savepointName}`);

        const resolvedBranch = resolveBranchReference(branchMap, branchRef);
        if (!resolvedBranch) {
          throw new Error(`Branch '${branchRef || "-"}' not found`);
        }

        const zoneRef = String(
          getField(row, ["zone", "zone_name", "zone_id"])
        ).trim();
        const resolvedZone = resolveZoneReference(zoneMap, zoneRef);

        if (zoneRef && !resolvedZone) {
          throw new Error(`Zone '${zoneRef}' not found`);
        }

        if (resolvedZone && Number(resolvedZone.id) !== Number(resolvedBranch.zone_id)) {
          throw new Error("Selected branch does not belong to the provided zone");
        }

        const payload = await prepareOfferMutation(
          {
            employee_name: employeeName,
            email: getField(row, ["email", "mail"]),
            phone: getField(row, ["phone", "mobile", "mobile_number"]),
            zone_id: resolvedZone?.id || resolvedBranch.zone_id,
            branch_id: resolvedBranch.id,
            designation: getField(row, ["designation"]),
            team_name: getField(row, ["team_name", "team"]),
            doj: getField(row, ["doj", "joining_date", "date_of_joining"]),
            gender: getField(row, ["gender"]),
            marital_status: getField(row, ["marital_status"]),
            grade: getField(row, ["grade"]),
            probation_period: getField(row, ["probation_period"]),
            gross_pay: getField(row, ["gross_pay", "grosspay", "gross_salary"]),
            insurance: getField(row, ["insurance"]),
          },
          null,
          conn
        );

        const insertedId = await insertOfferLetter(conn, payload);
        createdOfferIds.push(insertedId);
        inserted.push({
          row_number: rowNumber,
          employee_name: payload.employee_name,
          document_id: payload.document_id,
          branch: payload.branchName,
        });

        await conn.query(`RELEASE SAVEPOINT ${savepointName}`);
      } catch (error) {
        await conn.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        failed.push({
          row_number: rowNumber,
          employee_name: employeeName || "-",
          branch: branchRef || "-",
          error: error.message || "Failed to create offer letter",
        });
      }
    }

    await conn.commit();
    conn.release();
    conn = null;

    if (createdOfferIds.length) {
      browser = await launchOfferBrowser();
      await runWithConcurrency(createdOfferIds, 2, async (offerId) => {
        const row = await getOfferLetterRecordById(offerId);
        if (row) {
          await ensureOfferLetterPdf(row, { force: true, browser });
        }
      });
    }

    return res.json(
      buildResponsePayload(
        rows,
        inserted,
        failed,
        "Offer letter bulk upload completed successfully",
        "Offer letter bulk upload completed with some failed rows"
      )
    );
  } catch (error) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error("BULK OFFER LETTER UPLOAD ERROR:", error);
    return res
      .status(error.status || 500)
      .json({ message: error.message || "Offer letter bulk upload failed" });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
