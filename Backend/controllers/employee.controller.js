const db = require("../config/db");
const bcrypt = require("bcrypt");

/* ===================== MANAGERS ===================== */
exports.getManagers = (req, res) => {
  const { zone_id, branch_id, team_id, designation_id } = req.query;

  if (!designation_id || !branch_id) {
    return res.status(400).json({ message: "Required parameters missing" });
  }

  // Step 1: Regular managers in branch & team
  const sqlPrimary = `
    SELECT e.id, e.name
    FROM employees e
    JOIN designations d ON e.designation_id = d.id
    WHERE d.level < (SELECT level FROM designations WHERE id = ?)
      AND e.branch_id = ?
      AND e.team_id = ?
      AND e.status = 'ACTIVE'
  `;

  db.query(sqlPrimary, [designation_id, branch_id, team_id], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (rows.length > 0) return res.json(rows);

    // Step 2: Branch-level managers (is_manager = 1)
    const sqlBranchManagers = `
      SELECT e.id, e.name
      FROM employees e
      JOIN designations d ON e.designation_id = d.id
      WHERE e.branch_id = ?
        AND d.is_manager = 1
        AND e.status = 'ACTIVE'
    `;
    db.query(sqlBranchManagers, [branch_id], (err2, branchRows) => {
      if (err2) return res.status(500).json(err2);
      if (branchRows.length > 0) return res.json(branchRows);

      // Step 3: Global leadership fallback (SUPER_ADMIN/ADMIN + CMO/CTO/CEO/MD)
      const sqlGlobal = `
        SELECT e.id, e.name
        FROM employees e
        JOIN designations d ON e.designation_id = d.id
        WHERE e.role IN ('SUPER_ADMIN', 'ADMIN')
          AND d.designation_name IN ('CMO', 'CTO', 'CEO', 'MD')
          AND e.status = 'ACTIVE'
      `;
      db.query(sqlGlobal, (err3, globalRows) => {
        if (err3) return res.status(500).json(err3);
        return res.json(globalRows);
      });
    });
  });
};

/* ===================== EMPLOYEES ===================== */
exports.createEmployee = async (req, res) => {
  try {
    const {
      emp_id,
      name,
      email,
      password,
      dob,
      phone,
      team_id,
      designation_id,
      manager_id,
      branch_id,
      zone_id,
      role
    } = req.body;

    console.log("Form Data Received:", req.body); // DEBUG

    if (!emp_id || !name || !email || !password) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Only Super Admin can assign ADMIN or SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN" && role !== "USER_ACCOUNT") {
      return res.status(403).json({
        message: "Only Super Admin can assign Admin or Super Admin role"
      });
    }

    // ✅ Check duplicate emp_id or email
    const checkSql = "SELECT emp_id, email FROM employees WHERE emp_id=? OR email=?";
    db.query(checkSql, [emp_id, email], async (err, rows) => {
      if (err) {
        console.error("DB error on duplicate check:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (rows.length) {
        // Determine which field is duplicate
        const duplicateField = rows.some(r => r.emp_id === emp_id) ? "Employee ID" : "Email";
        return res.status(400).json({ message: `${duplicateField} already exists` });
      }

      // Hash password
      const hash = await bcrypt.hash(password, 10);

      const sql = `
        INSERT INTO employees
        (emp_id, name, email, password, role, dob, phone,
         team_id, designation_id, manager_id, branch_id, zone_id, profile_photo)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;

      const values = [
        emp_id,
        name,
        email,
        hash,
        role || "USER_ACCOUNT",
        dob || null,
        phone || null,
        team_id || null,
        designation_id || null,
        manager_id || null,
        branch_id || null,
        zone_id || null,
        req.file?.filename || null
      ];

      db.query(sql, values, (err, result) => {
        if (err) {
          console.error("Database Insert Error:", err);
          return res.status(400).json({ message: "Error creating employee", error: err });
        }
        console.log("Employee Created Successfully:", result);
        res.json({ message: "Employee created successfully", result });
      });
    });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
};

exports.getEmployees = (req, res) => {
  const sql = `
    SELECT e.emp_id, e.name, e.email, e.status,
           z.zone_name, b.branch_name,
           t.team_name, d.designation_name
    FROM employees e
    JOIN zones z ON e.zone_id=z.id
    JOIN branches b ON e.branch_id=b.id
    JOIN teams t ON e.team_id=t.id
    JOIN designations d ON e.designation_id=d.id
  `;

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};

exports.getActiveEmployees = (req, res) => {
  const sql = `
    SELECT 
      e.emp_id,
      e.name,
      e.email,
      e.phone,
      e.role,
      e.status,
      z.zone_name,
      b.branch_name,
      t.team_name,
      d.designation_name
    FROM employees e
    LEFT JOIN zones z ON e.zone_id = z.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN designations d ON e.designation_id = d.id
    WHERE e.status = 'ACTIVE'
    ORDER BY e.created_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to load active employees" });
    }
    res.json(rows);
  });
};

exports.updateEmployee = (req, res) => {
  db.query(
    "UPDATE employees SET ? WHERE emp_id=?",
    [req.body, req.params.empId],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Employee updated" });
    }
  );
};

exports.deleteEmployee = (req, res) => {
  db.query(
    "DELETE FROM employees WHERE emp_id=?",
    [req.params.empId],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Employee deleted" });
    }
  );
};
