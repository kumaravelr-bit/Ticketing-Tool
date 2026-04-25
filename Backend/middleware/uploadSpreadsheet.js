const multer = require("multer");
const path = require("path");

const allowedExtensions = new Set([".csv", ".xlsx", ".xls"]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (allowedExtensions.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only CSV, XLS, XLSX files are allowed"), false);
};

const uploadSpreadsheet = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = uploadSpreadsheet;
