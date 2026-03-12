const db = require("../config/db");

module.exports = permission => {
  return (req, res, next) => {
    if (req.user.role === "SUPER_ADMIN") return next();

    const sql = `
      SELECT p.permission_key
      FROM employee_permissions ep
      JOIN permissions p ON ep.permission_id=p.id
      WHERE ep.emp_id=?
    `;

    db.query(sql, [req.user.emp_id], (err, rows) => {
      if (err) return res.status(500).json(err);

      const perms = rows.map(p => p.permission_key);
      if (!perms.includes(permission))
        return res.status(403).json({ message: "Permission denied" });

      next();
    });
  };
};
