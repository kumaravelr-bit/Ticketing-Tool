const fs = require("fs");
const path = require("path");

const toDataUri = (filePath, mimeType) =>
  `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;

const normalizeProtectedEmails = (html) =>
  html
    .replace(
      /<a[^>]*class="__cf_email__"[^>]*>.*?<\/a>/gis,
      "info@infonetcomm.com"
    )
    .replace(/\[email(?:&#160;|\s)?protected\]/gi, "info@infonetcomm.com");

module.exports = function generateHTML(data) {
  try {
    const templatePath = path.join(
      __dirname,
      "../../uploads/template/offer-letter.html"
    );
    const logoPath = path.join(
      __dirname,
      "../../uploads/template/images/image1.png"
    );
    const signaturePath = path.join(
      __dirname,
      "../../uploads/template/images/image2.png"
    );
    const watermarkPath = path.join(
      __dirname,
      "../../uploads/template/images/AppointmentLetterBGLogo.jpg"
    );

    const requiredAssets = [
      [logoPath, "Logo"],
      [signaturePath, "Signature"],
      [watermarkPath, "Watermark"],
    ];

    requiredAssets.forEach(([assetPath, label]) => {
      if (!fs.existsSync(assetPath)) {
        throw new Error(`${label} image not found: ${assetPath}`);
      }
    });

    let html = fs.readFileSync(templatePath, "utf8");
    html = normalizeProtectedEmails(html);

    html = html.replace(/{{logo_base64}}/g, toDataUri(logoPath, "image/png"));
    html = html.replace(
      /{{signature_base64}}/g,
      toDataUri(signaturePath, "image/png")
    );
    html = html.replace(
      /{{watermark_base64}}/g,
      toDataUri(watermarkPath, "image/jpeg")
    );

    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, data[key] ?? "");
    });

    return html;
  } catch (error) {
    console.error("HTML GENERATION ERROR:", error.message);
    throw error;
  }
};
