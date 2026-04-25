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
      `SELECT
        e.emp_id,
        e.name,
        e.password,
        e.role,
        e.status,
        e.profile_photo,
        t.team_name,
        d.designation_name
      FROM employees e
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN designations d ON e.designation_id = d.id
      WHERE e.emp_id = ?
      LIMIT 1`,
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
      name: user.name || "",
      team: user.team_name || "",
      team_name: user.team_name || "",
      designation: user.designation_name || "",
      designation_name: user.designation_name || "",
      profile_photo: user.profile_photo || null,
      expiresIn: 7200,
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

    if (!rows.length || rows[0].email !== email) {
      return res.json({
        message: "If details are correct, OTP sent"
      });
    }

    const user = rows[0];

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

/* ================= CHANGE PASSWORD ================= */
exports.changePassword = async (req, res) => {
  try {
    const { emp_id } = req.user || {};
    const { currentPassword, password } = req.body || {};

    if (!emp_id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const [rows] = await db.query(
      `SELECT password
       FROM employees
       WHERE emp_id = ?
       LIMIT 1`,
      [emp_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      rows[0].password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        message:
          "Incorrect current password. Use the forgot password option from login if needed.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `UPDATE employees
       SET password = ?,
           reset_otp = NULL,
           otp_expiry = NULL,
           otp_attempts = 0
       WHERE emp_id = ?`,
      [hashedPassword, emp_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ message: "Error changing password" });
  }
};

/* ================= VERIFY CURRENT PASSWORD ================= */
exports.verifyCurrentPassword = async (req, res) => {
  try {
    const { emp_id } = req.user || {};
    const { currentPassword } = req.body || {};

    if (!emp_id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    const [rows] = await db.query(
      `SELECT password
       FROM employees
       WHERE emp_id = ?
       LIMIT 1`,
      [emp_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      rows[0].password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        message:
          "Incorrect current password. Use the forgot password option from login if needed.",
      });
    }

    res.json({ message: "Current password verified" });
  } catch (err) {
    console.error("Verify Current Password Error:", err);
    res.status(500).json({ message: "Error verifying current password" });
  }
};
