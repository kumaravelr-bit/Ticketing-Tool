require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const defaultUploadsDir = path.join(__dirname, "uploads");
const legacyUploadsDir = path.resolve(process.cwd(), "uploads");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(defaultUploadsDir));
if (legacyUploadsDir !== defaultUploadsDir && fs.existsSync(legacyUploadsDir)) {
  app.use("/uploads", express.static(legacyUploadsDir));
}
app.use("/api/employee", require("./routes/employee.routes"));
app.use("/api/others", require("./routes/others.routes"));
app.use("/api/tickets", require("./routes/ticket.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/offer-letter", require("./routes/hrd.routes"));
app.use("/api/manpower", require("./routes/manpower.routes"));
app.use("/api/uniform", require("./routes/uniform.routes"));
app.use("/api/payslip", require("./routes/payslip.routes"));
app.use("/api/relieving", require("./routes/relieving.routes"));
app.use("/api/new-connections", require("./routes/newConnection.routes"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({ message: "API Running" });
});

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File exceeds allowed size limit",
      });
    }
  }

  if (
    err.message === "Only JPG, JPEG, PNG allowed" ||
    err.message === "Only JPG, JPEG, PNG, WEBP allowed" ||
    err.message === "Only PNG allowed"
  ) {
    return res.status(400).json({ message: err.message });
  }

  return res.status(500).json({
    message: err.message || "Something went wrong",
  });
});

module.exports = app;
