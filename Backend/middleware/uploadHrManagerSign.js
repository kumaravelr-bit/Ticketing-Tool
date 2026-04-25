const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "../uploads/template/hr-manager-sign");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedMimeTypes = ["image/png"];
  if (ext !== ".png" || !allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Only PNG allowed"));
  }
  return cb(null, true);
};

const uploadHrManagerSign = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = uploadHrManagerSign;
