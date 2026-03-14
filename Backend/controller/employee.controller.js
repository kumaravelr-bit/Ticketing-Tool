const db = require("../config/db");
const bcrypt = require("bcrypt");

/* =====================================================
   HELPERS
===================================================== */
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "IT_ADMIN", "CRM_ADMIN"];

const isAdmin = role => ADMIN_ROLES.includes(role);

/* ===================== ZONES ===================== */
exports.getZones = (req, res) => {
  db.query("SELECT id, zone_name FROM zones", (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};

exports.createZone = (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  const { zone_name } = req.body;
  if (!zone_name)
    return res.status(400).json({ message: "Zone name required" });

  db.query(
    "INSERT INTO zones (zone_name) VALUES (?)",
    [zone_name],
    err => {
      if (err)
        return res.status(400).json({ message: "Zone already exists" });
      res.json({ message: "Zone created successfully" });
    }
  );
};

/* ===================== BRANCHES ===================== */
exports.getBranchesByZone = (req, res) => {
  db.query(
    "SELECT id, branch_name FROM branches WHERE zone_id=?",
    [req.params.zoneId],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

exports.createBranch = (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  const { branch_name, zone_id } = req.body;
  if (!branch_name || !zone_id)
    return res.status(400).json({ message: "Branch & Zone required" });

  db.query(
    "INSERT INTO branches (branch_name, zone_id) VALUES (?,?)",
    [branch_name, zone_id],
    err => {
      if (err)
        return res.status(400).json({ message: "Branch exists" });
      res.json({ message: "Branch created successfully" });
    }
  );
};

/* ===================== TEAMS ===================== */
exports.getTeams = (req, res) => {
  db.query("SELECT id, team_name FROM teams", (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};

exports.createTeam = (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  if (!req.body.team_name)
    return res.status(400).json({ message: "Team name required" });

  db.query(
    "INSERT INTO teams (team_name) VALUES (?)",
    [req.body.team_name],
    err => {
      if (err)
        return res.status(400).json({ message: "Team exists" });
      res.json({ message: "Team created successfully" });
    }
  );
};

/* ===================== DESIGNATIONS ===================== */
exports.getDesignationsByTeam = (req, res) => {
  db.query(
    "SELECT id, designation_name, level FROM designations WHERE team_id=?",
    [req.params.teamId],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};

exports.createDesignation = (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  const { designation_name, team_id, level } = req.body;
  if (!designation_name || !team_id || !level)
    return res.status(400).json({ message: "All fields required" });

  db.query(
    "INSERT INTO designations (designation_name, team_id, level) VALUES (?,?,?)",
    [designation_name, team_id, level],
    err => {
      if (err)
        return res.status(400).json({ message: "Designation exists" });
      res.json({ message: "Designation created successfully" });
    }
  );
};

/* ===================== EMPLOYEES ===================== */
exports.createEmployee = async (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  let conn;

  try {
    let {
      emp_id,
      name,
      email,
      password,
      phone,
      team_id,
      designation_id,
      manager_id,
      branch_ids,
      zone_id,
      role
    } = req.body;

    if (typeof branch_ids === "string")
      branch_ids = JSON.parse(branch_ids);

    if (!Array.isArray(branch_ids) || !branch_ids.length)
      return res.status(400).json({ message: "Branch required" });

    const hash = await bcrypt.hash(password, 10);
    const primaryBranch = branch_ids[0];

    db.getConnection((err, connection) => {
      if (err) return res.status(500).json({ message: "DB error" });
      conn = connection;

      conn.beginTransaction(err => {
        if (err) return res.status(500).json({ message: "TX failed" });

        conn.query(
          `INSERT INTO employees
           (emp_id,name,email,password,role,phone,team_id,designation_id,manager_id,branch_id,zone_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            emp_id,
            name,
            email,
            hash,
            role || "USER_ACCOUNT",
            phone,
            team_id,
            designation_id,
            manager_id,
            primaryBranch,
            zone_id
          ],
          err => {
            if (err)
              return conn.rollback(() =>
                res.status(500).json({ message: "Insert failed" })
              );

            const values = branch_ids.map(b => [emp_id, b]);

            conn.query(
              "INSERT INTO employee_branches (emp_id,branch_id) VALUES ?",
              [values],
              err2 => {
                if (err2)
                  return conn.rollback(() =>
                    res.status(500).json({ message: "Branch mapping failed" })
                  );

                conn.commit(() => {
                  conn.release();
                  res.json({ message: "Employee created successfully" });
                });
              }
            );
          }
        );
      });
    });
  } catch (e) {
    if (conn) conn.release();
    res.status(500).json({ message: "Server error" });
  }
};

/* ===================== ACTIVE ===================== */
exports.getActiveEmployees = (req, res) => {
  db.query(
    `SELECT e.emp_id,e.name,e.email,e.phone,e.role,e.status,
            z.zone_name,b.branch_name,t.team_name
     FROM employees e
     LEFT JOIN zones z ON e.zone_id=z.id
     LEFT JOIN branches b ON e.branch_id=b.id
     LEFT JOIN teams t ON e.team_id=t.id
     WHERE e.status='ACTIVE'
     ORDER BY e.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Load failed" });
      res.json(rows);
    }
  );
};

/* ===================== RELIEVED ===================== */
exports.getRelievedEmployees = (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  db.query(
    `SELECT e.emp_id,e.name,e.email,e.status,
            z.zone_name,b.branch_name,t.team_name
     FROM employees e
     LEFT JOIN zones z ON e.zone_id=z.id
     LEFT JOIN branches b ON e.branch_id=b.id
     LEFT JOIN teams t ON e.team_id=t.id
     WHERE e.status IN ('RELIEVED','DEACTIVE')
     ORDER BY e.updated_at DESC`,
    (err, rows) => {
      if (err)
        return res.status(500).json({ message: "Load failed" });
      res.json(rows);
    }
  );
};

/* ===================== UPDATE ===================== */
exports.updateEmployee = (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  const empId = req.params.empId;
  let { name, email, phone, zone_id, branch_ids, team_id, designation_id, manager_id, status } = req.body;

  if (typeof branch_ids === "string")
    branch_ids = JSON.parse(branch_ids);

  const primaryBranch = branch_ids[0];

  db.query(
    `UPDATE employees SET
      name=?,email=?,phone=?,zone_id=?,branch_id=?,
      team_id=?,designation_id=?,manager_id=?,status=?
     WHERE emp_id=?`,
    [
      name,
      email,
      phone,
      zone_id,
      primaryBranch,
      team_id,
      designation_id,
      manager_id,
      status,
      empId
    ],
    err => {
      if (err)
        return res.status(500).json({ message: "Update failed" });

      db.query(
        "DELETE FROM employee_branches WHERE emp_id=?",
        [empId],
        () => {
          const values = branch_ids.map(b => [empId, b]);
          db.query(
            "INSERT INTO employee_branches (emp_id,branch_id) VALUES ?",
            [values],
            () => res.json({ message: "Employee updated" })
          );
        }
      );
    }
  );
};

/* ===================== DELETE ===================== */
exports.deleteEmployee = (req, res) => {
  if (!isAdmin(req.user.role))
    return res.status(403).json({ message: "Access denied" });

  db.query(
    "DELETE FROM employees WHERE emp_id=?",
    [req.params.empId],
    err => {
      if (err)
        return res.status(500).json({ message: "Delete failed" });
      res.json({ message: "Employee deleted" });
    }
  );
};