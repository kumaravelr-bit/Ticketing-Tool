const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../utils/mailer");

/* ================= LOGIN ================= */
exports.login = async (req, res) => {
  try {
    const { empId, password } = req.body || {};

    if (!empId || !password) {
      return res.status(400).json({ message: "EmpId & Password required" });
    }

    const [rows] = await db.query(
      `SELECT emp_id, password, role, status 
       FROM employees WHERE emp_id = ? LIMIT 1`,
      [empId]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    if (user.role !== "SUPER_ADMIN" && user.status !== "ACTIVE") {
      return res.status(403).json({ message: "Account inactive" });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    db.query(
      "UPDATE employees SET last_login = NOW() WHERE emp_id = ?",
      [empId]
    ).catch(() => {});

    const token = jwt.sign(
      { emp_id: user.emp_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      token,
      role: user.role,
      emp_id: user.emp_id,
      expiresIn: 7200
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= SEND OTP ================= */
exports.sendResetOTP = async (req, res) => {
  try {
    const { empId, email } = req.body;

    if (!empId || !email) {
      return res.status(400).json({ message: "Emp ID & Email required" });
    }

    const [rows] = await db.query(
      `SELECT id, email, otp_last_sent 
       FROM employees 
       WHERE emp_id = ?`,
      [empId]
    );

    // 🔒 DO NOT REVEAL USER EXISTENCE
    if (!rows.length || rows[0].email !== email) {
      return res.json({
        message: "If details are correct, OTP sent"
      });
    }

    const user = rows[0];

    // ⛔ RESEND BLOCK (60 sec)
    if (user.otp_last_sent) {
      const diff = (new Date() - new Date(user.otp_last_sent)) / 1000;
      if (diff < 60) {
        return res.status(429).json({
          message: `Wait ${Math.ceil(60 - diff)} sec`
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      `UPDATE employees 
       SET reset_otp = ?, 
           otp_expiry = DATE_ADD(NOW(), INTERVAL 2 MINUTE),
           otp_attempts = 0,
           otp_last_sent = NOW()
       WHERE emp_id = ?`,
      [otp, empId]
    );

    await sendOTP(email, otp);

    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending OTP" });
  }
};

/* ================= VERIFY OTP ================= */
exports.verifyOTP = async (req, res) => {
  try {
    const { empId, email, otp } = req.body;

    const [rows] = await db.query(
      `SELECT reset_otp, otp_expiry, otp_attempts 
       FROM employees 
       WHERE emp_id = ? AND email = ?`,
      [empId, email]
    );

    if (!rows.length) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const user = rows[0];

    if (user.otp_attempts >= 3) {
      return res.status(429).json({
        message: "Too many attempts"
      });
    }

    if (user.reset_otp !== otp) {
      await db.query(
        `UPDATE employees 
         SET otp_attempts = otp_attempts + 1 
         WHERE emp_id = ?`,
        [empId]
      );

      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: "OTP expired" });
    }

    res.json({ message: "OTP verified" });

  } catch (err) {
    res.status(500).json({ message: "Error verifying OTP" });
  }
};

/* ================= RESET PASSWORD ================= */
exports.resetPassword = async (req, res) => {
  try {
    const { empId, email, password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `UPDATE employees 
       SET password = ?, 
           reset_otp = NULL, 
           otp_expiry = NULL,
           otp_attempts = 0
       WHERE emp_id = ? AND email = ?`,
      [hashedPassword, empId, email]
    );

    res.json({ message: "Password reset successful" });

  } catch (err) {
    res.status(500).json({ message: "Error resetting password" });
  }
};