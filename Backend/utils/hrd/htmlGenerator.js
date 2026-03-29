const fs = require("fs");
const path = require("path");

module.exports = function generateHTML(data) {
  try {
    // 📄 HTML TEMPLATE PATH
    const filePath = path.join(
      __dirname,
      "../../uploads/template/offer-letter.html"
    );

    // 🖼 IMAGE PATHS (IMPORTANT)
    const logoPath = path.join(
      __dirname,
      "../../uploads/template/images/image1.png"
    );

    const signPath = path.join(
      __dirname,
      "../../uploads/template/images/image2.png"
    );

    // ✅ 1. READ HTML
    let html = fs.readFileSync(filePath, "utf8");

    // ✅ 2. CHECK FILE EXISTS (VERY IMPORTANT)
    if (!fs.existsSync(logoPath)) {
      throw new Error("Logo image not found: " + logoPath);
    }

    if (!fs.existsSync(signPath)) {
      throw new Error("Signature image not found: " + signPath);
    }

    // ✅ 3. CONVERT TO BASE64
    const logoBase64 = fs.readFileSync(logoPath).toString("base64");
    const signatureBase64 = fs.readFileSync(signPath).toString("base64");

    // ✅ 4. INJECT IMAGES
    html = html.replace(
      /{{logo_base64}}/g,
      `data:image/png;base64,${logoBase64}`
    );

    html = html.replace(
      /{{signature_base64}}/g,
      `data:image/png;base64,${signatureBase64}`
    );

    // ✅ 5. REPLACE DYNAMIC DATA
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, data[key] ?? "");
    });

    return html;

  } catch (error) {
    console.error("🔥 HTML GENERATION ERROR:", error.message);
    throw error;
  }
};