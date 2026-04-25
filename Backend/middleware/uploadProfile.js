const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ENSURE FOLDER EXISTS */
const uploadDir = path.join(__dirname, "../uploads/profile");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* STORAGE */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

/* FILE FILTER */
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, PNG allowed"), false);
  }
};

/* FINAL UPLOAD CONFIG */
const uploadProfile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // ✅ STRICT 2MB
  }
});

module.exports = uploadProfile;
