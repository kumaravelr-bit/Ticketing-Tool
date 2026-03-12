const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.login = (req, res) => {
  const { empId, password } = req.body || {};

  if (!empId || !password) {
    return res.status(400).json({ message: "EmpId & Password required" });
  }

  db.query(
    "SELECT * FROM employees WHERE emp_id = ?",
    [empId],
    async (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!rows.length) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const user = rows[0];

      // 🔒 Block inactive users except Super Admin
      if (user.role !== "SUPER_ADMIN" && user.status !== "ACTIVE") {
        return res.status(403).json({ message: "Account inactive" });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // ✅ Update last login
      db.query(
        "UPDATE employees SET last_login = NOW() WHERE emp_id = ?",
        [empId]
      );

      // ✅ JWT TOKEN (2 HOURS SESSION)
      const token = jwt.sign(
        {
          emp_id: user.emp_id,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "2h" } // ⏰ AUTO LOGOUT AFTER 2 HOURS
      );

      res.json({
        token,
        role: user.role,
        emp_id: user.emp_id,
        expiresIn: 2 * 60 * 60 // seconds (optional for frontend)
      });
    }
  );
};
