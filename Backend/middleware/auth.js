const jwt = require("jsonwebtoken");
const db = require("../config/db");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Token missing"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* 🔥 GET FULL USER DATA (VERY IMPORTANT) */
    const [[user]] = await db.query(
      `SELECT 
        e.emp_id,
        e.role,
        e.branch_id,
        e.zone_id,
        e.team_id,
        e.designation_id,
        t.team_name,
        d.designation_name
      FROM employees e
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN designations d ON e.designation_id = d.id
      WHERE e.emp_id = ?`,
      [decoded.emp_id]
    );

    if (!user) {
      return res.status(401).json({
        message: "User not found"
      });
    }

    req.user = user; // ✅ FULL DATA AVAILABLE

    next();

  } catch (err) {
    res.status(401).json({
      message: "Invalid token"
    });
  }
};