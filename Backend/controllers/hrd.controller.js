const db = require("../config/db");
const numberToWords = require("../utils/hrd/numberToWords");
const generateHTML = require("../utils/hrd/htmlGenerator");

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
require("dotenv").config();


// 📁 Ensure Upload Folder Exists
const uploadDir = path.join(__dirname, "../uploads/offer_letters");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 🔥 FAST DOC ID (Optimized)
const generateDocumentId = async () => {
  const year = new Date().getFullYear();

  const [rows] = await db.execute(
    `SELECT id FROM offer_letters 
     WHERE YEAR(generated_date)=? 
     ORDER BY id DESC LIMIT 1`,
    [year]
  );

  const next = rows.length ? rows[0].id + 1 : 1;

  return `Infonet Comm/HR/OL/${year}/${String(next).padStart(3, "0")}`;
};

// 📄 GET ALL (FAST FETCH)
exports.getOfferLetters = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        id,
        document_id,
        employee_name,
        email,
        phone,
        location,
        designation,
        team_name,
        doj,
        gross_pay,
        generated_date
      FROM offer_letters
      ORDER BY id DESC
    `);

    res.json(rows);

  } catch (err) {
    console.error("LIST ERROR:", err);
    res.status(500).json({ error: "Failed to fetch offer letters" });
  }
};

// 🚀 GENERATE + SAVE FILE (HTML → PDF)
exports.generateOfferLetter = async (req, res) => {
  let browser;

  try {
    const d = req.body;

    const gp = Math.max(0, Number(d.grossPay || 0));
    const insurance = Math.max(0, Number(d.insurance || 0));

    const round = (v) => Math.round(v);

    // 💰 SALARY CALCULATION
    const basic = round(gp * 0.6);
    const hra = round(gp * 0.2);
    const other = round(gp - (basic + hra));
    const grossA = basic + hra + other;

    const esi_employee = grossA >= 21000 ? 0 : round((grossA * 0.75) / 100);

    const pfBase = basic + other;
    const pf_employee = pfBase >= 15000 ? 1800 : round((pfBase * 12) / 100);

    const total_deduction_a = esi_employee + pf_employee + insurance;
    const takeHome = grossA - total_deduction_a;

    const esi_employer = grossA >= 21000 ? 0 : round((grossA * 3.25) / 100);
    const pf_employer = pfBase >= 15000 ? 1800 : round((pfBase * 12) / 100);

    const total_deduction_b = esi_employer + pf_employer;
    const monthlyCTC = grossA + total_deduction_b;
    const annualCTC = monthlyCTC * 12;

    const gross_words = numberToWords(gp) + " Rupees Only";

    // 🔥 DOCUMENT ID
    const document_id = await generateDocumentId();

    // 🔐 SAFE FILE NAME
    const safeFileName = document_id.replace(/[\/\\]/g, "_");

    // 📁 FILE PATHS
    const fileName = `${safeFileName}.pdf`;
    const absolutePath = path.join(uploadDir, fileName);
    const relativePath = `uploads/offer_letters/${fileName}`;

    // 📄 GENERATE HTML
    const htmlContent = generateHTML({
      document_id,
      generated_date: new Date().toLocaleDateString(),

      employee_name: d.employee_name,
      employee_status: d.gender === "MALE" ? "Mr." : "Ms.",
      phone: d.phone,
      email: d.email,
      designation: d.designation,
      location: d.location,
      doj: d.doj,

      gross_pay: gp,
      gross_words,

      basic,
      hra,
      other,
      grossA,

      esi_employee,
      pf_employee,
      insurance,
      total_deduction_a,
      takeHome,

      esi_employer,
      pf_employer,
      total_deduction_b,

      monthlyCTC,
      annualCTC
    });

    // 🚀 LAUNCH PUPPETEER
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    // 🔥 LOAD HTML
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0"
    });

    // 📄 GENERATE PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm"
      }
    });

    await browser.close();

    // 💾 SAVE FILE
    await fs.promises.writeFile(absolutePath, pdfBuffer);
    const dojValue = d.doj ? d.doj : null;
    // ✅ SAVE DB
    await db.execute(
  `INSERT INTO offer_letters 
  (document_id, employee_name, email, phone, location, designation, team_name,
  doj, gender, marital_status, grade, probation_period,
  gross_pay, insurance,
  basic, hra, other_allowance, gross_salary_a,
  esi_employee, pf_employee, total_deduction_a, take_home,
  esi_employer, pf_employer, total_deduction_b,
  monthly_ctc, annual_ctc, gross_pay_words, file_path)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [
    document_id,
    d.employee_name,
    d.email,
    d.phone,
    d.location,
    d.designation,
    d.team_name,
    dojValue, // ✅ use null if empty
    d.gender,
    d.marital_status,
    d.grade,
    d.probation_period,
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
    gross_words,
    relativePath
  ]
);

res.set({
  "Content-Type": "application/pdf",
  "Content-Disposition": `attachment; filename="${safeFileName}.pdf"`,
  "Content-Length": pdfBuffer.length,
});

return res.send(pdfBuffer);

  } catch (err) {
    if (browser) await browser.close();

    console.error("🔥 GENERATE ERROR:", err);

    res.status(500).json({
      error: "Failed to generate offer letter",
      details: err.message
    });
  }
};

// 📥 DOWNLOAD
exports.downloadOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(
      `SELECT document_id FROM offer_letters WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Record not found" });
    }

    const document_id = rows[0].document_id;

    const safeFileName = document_id.replace(/[\/\\]/g, "_");
    const filePath = path.join(uploadDir, `${safeFileName}.pdf`);

    if (!fs.existsSync(filePath)) {
      console.log("❌ FILE NOT FOUND:", filePath);
      return res.status(404).json({ error: "File not found" });
    }

    // ✅ SEND FILE
    res.download(filePath, `${document_id}.pdf`);

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    res.status(500).json({ error: "Download failed" });
  }
};

// 📧 SEND OFFER LETTER MAIL
exports.sendOfferLetterMail = async (req, res) => {
  try {
    const { email, document_id } = req.body;

    // ✅ Safe filename (prevent path issues)
    const safeFileName = document_id.replace(/[\/\\]/g, "_");
    const filePath = path.join(uploadDir, `${safeFileName}.pdf`);

    // ✅ Check file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    // ✅ Use ENV (NO HARD CODE)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    // ✅ Send Mail
    await transporter.sendMail({
      from: `"HR Team" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Offer Letter",
      text: "Please find your offer letter attached.",
      html: `
        <p>Dear Candidate,</p>
        <p>Please find your <b>Offer Letter</b> attached.</p>
        <p>Regards,<br/>HR Team</p>
      `,
      attachments: [
        {
          filename: `${document_id}.pdf`,
          path: filePath
        }
      ]
    });

    return res.status(200).json({
      success: true,
      message: "Mail sent successfully"
    });

  } catch (err) {
    console.error("Mail Error:", err);
    return res.status(500).json({
      success: false,
      message: "Mail error"
    });
  }
};

exports.getOfferLetterById = async (req, res) => {
  try {
    const { id } = req.params;

    // 🚫 Prevent undefined calls
    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const [rows] = await db.execute(
      `SELECT * FROM offer_letters WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error("GET ERROR:", err);
    res.status(500).json({ error: "Fetch error" });
  }
};

exports.updateOfferLetter = async (req, res) => {
  let browser;

  try {
    const { id } = req.params;
    const d = req.body;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid ID" });
    }

    // 🔍 GET EXISTING RECORD
    const [existing] = await db.execute(
      `SELECT document_id FROM offer_letters WHERE id = ?`,
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({ error: "Not found" });
    }

    const document_id = existing[0].document_id;

    // 📄 SAFE FILE NAME
    const safeFileName = document_id.replace(/[\/\\]/g, "_");
    const fileName = `${safeFileName}.pdf`;
    const absolutePath = path.join(uploadDir, fileName);

    // 🧹 DELETE OLD FILE FIRST ✅ (FIXED ORDER)
    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
    }

    // 💰 CALCULATIONS
    const gp = Math.max(0, Number(d.grossPay || 0));
    const insurance = Math.max(0, Number(d.insurance || 0));

    const round = (v) => Math.round(v);

    const basic = round(gp * 0.6);
    const hra = round(gp * 0.2);
    const other = round(gp - (basic + hra));
    const grossA = basic + hra + other;

    const esi_employee = grossA >= 21000 ? 0 : round((grossA * 0.75) / 100);

    const pfBase = basic + other;
    const pf_employee = pfBase >= 15000 ? 1800 : round((pfBase * 12) / 100);

    const total_deduction_a = esi_employee + pf_employee + insurance;
    const takeHome = grossA - total_deduction_a;

    const esi_employer = grossA >= 21000 ? 0 : round((grossA * 3.25) / 100);
    const pf_employer = pfBase >= 15000 ? 1800 : round((pfBase * 12) / 100);

    const total_deduction_b = esi_employer + pf_employer;
    const monthlyCTC = grossA + total_deduction_b;
    const annualCTC = monthlyCTC * 12;

    const gross_words = numberToWords(gp) + " Rupees Only";

    // 📄 GENERATE HTML
const htmlContent = generateHTML({
  ...d,

  // ✅ ADD THIS (MAIN FIX)
  employee_status: d.gender === "MALE"
    ? "Mr."
    : d.gender === "FEMALE"
    ? "Ms."
    : "",

  // ✅ ADD THIS (DATE FIX)
  doj: d.doj
    ? new Date(d.doj).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      })
    : "",

  document_id,

  // ✅ IMPORTANT (MATCH GENERATE FUNCTION FORMAT)
  generated_date: new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }),

  gross_pay: gp,
  gross_words,

  basic,
  hra,
  other,
  grossA,

  esi_employee,
  pf_employee,
  insurance,
  total_deduction_a,
  takeHome,

  esi_employer,
  pf_employer,
  total_deduction_b,

  monthlyCTC,
  annualCTC
});

    // 🚀 GENERATE PDF
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    // 💾 SAVE NEW FILE
    await fs.promises.writeFile(absolutePath, pdfBuffer);

    // 📅 FORMAT DATE
    const formatDate = (date) => {
      if (!date) return null;
      return new Date(date).toISOString().split("T")[0];
    };

    const formattedDOJ = formatDate(d.doj);

    // 🗄️ UPDATE DB (FIXED COMMA)
    await db.execute(
      `UPDATE offer_letters SET 
        employee_name=?, email=?, phone=?, location=?, designation=?, team_name=?,
        doj=?, gender=?, marital_status=?, grade=?, probation_period=?,
        gross_pay=?, insurance=?,
        basic=?, hra=?, other_allowance=?, gross_salary_a=?,
        esi_employee=?, pf_employee=?, total_deduction_a=?, take_home=?,
        esi_employer=?, pf_employer=?, total_deduction_b=?,
        monthly_ctc=?, annual_ctc=?, gross_pay_words=?,
        file_path=?
       WHERE id=?`,
      [
        d.employee_name,
        d.email,
        d.phone,
        d.location,
        d.designation,
        d.team_name,
        formattedDOJ, // ✅ FIXED
        d.gender,
        d.marital_status,
        d.grade,
        d.probation_period,
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
        gross_words,
        absolutePath,
        id
      ]
    );

    res.json({ message: "Updated successfully" });

  } catch (err) {
    if (browser) await browser.close();
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: "Update failed" });
  }
};

// 👁️ PREVIEW OFFER LETTER (INLINE VIEW)
exports.previewOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(
      `SELECT document_id, file_path FROM offer_letters WHERE id = ?`,
      [id]
    );

    if (!rows.length) return res.status(404).send("Not found");

    const filePath = rows[0].file_path;

    if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

    const pdfBuffer = await fs.promises.readFile(filePath);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${rows[0].document_id}.pdf"`,
      "Content-Length": pdfBuffer.length
    });

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Preview Error:", err);
    res.status(500).json({ error: "Failed to preview" });
  }
};