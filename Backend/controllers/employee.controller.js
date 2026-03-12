const db = require("../config/db");
const bcrypt = require("bcrypt");

/* ===================== ZONES ===================== */
exports.getZones = (req, res) => {
  db.query("SELECT id, zone_name FROM zones", (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
};

exports.createZone = (req, res) => {
  const { zone_name } = req.body;
  if (!zone_name) return res.status(400).json({ message: "Zone name required" });

  db.query(
    "INSERT INTO zones (zone_name) VALUES (?)",
    [zone_name],
    err => {
      if (err) return res.status(400).json({ message: "Zone already exists" });
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
  const { branch_name, zone_id } = req.body;
  if (!branch_name || !zone_id)
    return res.status(400).json({ message: "Branch & Zone required" });

  db.query(
    "INSERT INTO branches (branch_name, zone_id) VALUES (?,?)",
    [branch_name, zone_id],
    err => {
      if (err) return res.status(400).json({ message: "Branch exists" });
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
  if (!req.body.team_name)
    return res.status(400).json({ message: "Team name required" });

  db.query(
    "INSERT INTO teams (team_name) VALUES (?)",
    [req.body.team_name],
    err => {
      if (err) return res.status(400).json({ message: "Team exists" });
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
  const { designation_name, team_id, level } = req.body;
  if (!designation_name || !team_id || !level)
    return res.status(400).json({ message: "All fields required" });

  db.query(
    "INSERT INTO designations (designation_name, team_id, level) VALUES (?,?,?)",
    [designation_name, team_id, level],
    err => {
      if (err) return res.status(400).json({ message: "Designation exists" });
      res.json({ message: "Designation created successfully" });
    }
  );
};

/* ===================== MANAGERS ===================== */
exports.getManagers = (req, res) => {
  const { team_id, designation_id, branch_id } = req.query;

  if (!team_id || !designation_id || !branch_id) {
    return res.status(400).json({
      message: "team_id, designation_id and branch_id are required"
    });
  }

  const sql = `
    SELECT DISTINCT
      e.id,
      e.emp_id,
      e.name,
      e.role,
      d.designation_name
    FROM employees e
    JOIN designations d ON e.designation_id = d.id
    LEFT JOIN employee_branches eb ON e.emp_id = eb.emp_id
    WHERE e.status = 'ACTIVE'
      AND (
        /* 🔥 Admin & Super Admin – always visible */
        e.role IN ('ADMIN','SUPER_ADMIN')

        /* 🔥 Team-based Managers */
        OR (
          d.is_manager = 1
          AND e.team_id = ?
          AND d.level < (
            SELECT level FROM designations WHERE id = ?
          )
          AND (
            e.branch_id = ?
            OR eb.branch_id = ?
          )
        )
      )
    ORDER BY e.name
  `;

  db.query(
    sql,
    [team_id, designation_id, branch_id, branch_id],
    (err, rows) => {
      if (err) {
        console.error("Manager fetch failed:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.json(rows);
    }
  );
};

/* ===================== EMPLOYEES ===================== */
exports.createEmployee = async (req, res) => {
  let conn;

  try {
    let {
      emp_id,
      name,
      email,
      password,
      dob,
      phone,
      team_id,
      designation_id,
      manager_id,
      branch_ids,
      zone_id,
      role
    } = req.body;

    // ✅ Parse branch_ids (FormData safe)
    if (typeof branch_ids === "string") {
      branch_ids = JSON.parse(branch_ids);
    }

    if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
      return res.status(400).json({ message: "At least one branch is required" });
    }

    // 🔑 PRIMARY BRANCH
    const primaryBranch = branch_ids[0];

    // 🔐 Password hash
    const hash = await bcrypt.hash(password, 10);

    // ✅ GET CONNECTION FROM POOL
    db.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "DB connection failed" });
      }

      conn = connection;

      conn.beginTransaction(async err => {
        if (err) {
          conn.release();
          return res.status(500).json({ message: "Transaction start failed" });
        }

        // 1️⃣ INSERT EMPLOYEE
        const empSql = `
          INSERT INTO employees
          (emp_id, name, email, password, role, dob, phone,
           team_id, designation_id, manager_id, branch_id, zone_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        conn.query(
          empSql,
          [
            emp_id,
            name,
            email,
            hash,
            role || "USER_ACCOUNT",
            dob || null,
            phone || null,
            team_id,
            designation_id,
            manager_id,
            primaryBranch,
            zone_id
          ],
          (err) => {
            if (err) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ message: "Employee insert failed" });
              });
            }

            // 2️⃣ INSERT MULTIPLE BRANCHES
            const branchValues = branch_ids.map(bid => [emp_id, bid]);

            conn.query(
              "INSERT INTO employee_branches (emp_id, branch_id) VALUES ?",
              [branchValues],
              err2 => {
                if (err2) {
                  return conn.rollback(() => {
                    conn.release();
                    res.status(500).json({ message: "Branch mapping failed" });
                  });
                }

                // ✅ COMMIT
                conn.commit(err3 => {
                  if (err3) {
                    return conn.rollback(() => {
                      conn.release();
                      res.status(500).json({ message: "Commit failed" });
                    });
                  }

                  conn.release();
                  res.json({
                    message: "Employee created with multiple branches"
                  });
                });
              }
            );
          }
        );
      });
    });

  } catch (err) {
    console.error(err);
    if (conn) conn.release();
    res.status(500).json({ message: "Server error" });
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
      t.team_name
    FROM employees e
    LEFT JOIN zones z ON e.zone_id = z.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.status = 'ACTIVE'
    ORDER BY e.created_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err)
      return res.status(500).json({ message: "Failed to load employees" });
    res.json(rows);
  });
};

exports.getRelievedEmployees = (req, res) => {
  const sql = `
    SELECT 
      e.emp_id,
      e.name,
      e.email,
      e.status,
      z.zone_name,
      b.branch_name,
      t.team_name
    FROM employees e
    LEFT JOIN zones z ON e.zone_id = z.id
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.status IN ('RELIEVED', 'DEACTIVE')
    ORDER BY e.updated_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to load relieved employees" });
    }
    res.json(rows);
  });
};

exports.updateEmployee = (req, res) => {
  const empId = req.params.empId;
  let conn;

  try {
    let {
      name,
      email,
      phone,
      zone_id,
      branch_ids,
      team_id,
      designation_id,
      manager_id,
      status
    } = req.body;

    /* ✅ Parse branch_ids safely */
    if (typeof branch_ids === "string") {
      branch_ids = JSON.parse(branch_ids);
    }

    if (!Array.isArray(branch_ids) || branch_ids.length === 0) {
      return res.status(400).json({ message: "At least one branch is required" });
    }

    const primaryBranch = branch_ids[0];

    /* ✅ Get DB connection */
    db.getConnection((err, connection) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "DB connection failed" });
      }

      conn = connection;

      conn.beginTransaction(err => {
        if (err) {
          conn.release();
          return res.status(500).json({ message: "Transaction failed" });
        }

        /* =============================
           1️⃣ UPDATE EMPLOYEE (FIXED)
        ============================== */

        const empSql = `
          UPDATE employees SET
            name = ?,
            email = ?,
            phone = ?,
            zone_id = ?,
            branch_id = ?,
            team_id = ?,
            designation_id = ?,
            manager_id = ?,
            status = ?
          WHERE emp_id = ?
        `;

        console.log("✅ UPDATE PAYLOAD:", {
          name,
          email,
          phone,
          zone_id,
          team_id,
          designation_id,
          manager_id,
          status
        });

        conn.query(
          empSql,
          [
            name || null,
            email || null,
            phone || null,
            zone_id || null,
            primaryBranch || null,
            team_id || null,
            designation_id || null,
            manager_id || null,
            status,          // 🔥 STATUS WILL UPDATE NOW
            empId
          ],
          err1 => {
            if (err1) {
              console.error("UPDATE ERROR:", err1);
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ message: "Employee update failed" });
              });
            }

            /* =============================
               2️⃣ DELETE OLD BRANCH MAPPING
            ============================== */

            conn.query(
              "DELETE FROM employee_branches WHERE emp_id = ?",
              [empId],
              err2 => {
                if (err2) {
                  return conn.rollback(() => {
                    conn.release();
                    res.status(500).json({ message: "Branch cleanup failed" });
                  });
                }

                /* =============================
                   3️⃣ INSERT NEW BRANCHES
                ============================== */

                const values = branch_ids.map(bid => [empId, bid]);

                conn.query(
                  "INSERT INTO employee_branches (emp_id, branch_id) VALUES ?",
                  [values],
                  err3 => {
                    if (err3) {
                      return conn.rollback(() => {
                        conn.release();
                        res.status(500).json({ message: "Branch update failed" });
                      });
                    }

                    /* =============================
                       ✅ COMMIT TRANSACTION
                    ============================== */

                    conn.commit(err4 => {
                      if (err4) {
                        return conn.rollback(() => {
                          conn.release();
                          res.status(500).json({ message: "Commit failed" });
                        });
                      }

                      conn.release();
                      res.json({
                        success: true,
                        message: "Employee updated successfully"
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });

  } catch (err) {
    console.error(err);
    if (conn) conn.release();
    res.status(500).json({ message: "Server error" });
  }
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

exports.getEmployeeByEmpId = (req, res) => {
  const { empId } = req.params;

  const sql = `
    SELECT 
      e.emp_id,
      e.name,
      e.email,
      e.phone,
      e.role,
      e.status,
      e.zone_id,
      e.team_id,
      e.designation_id,
      e.manager_id,
      z.zone_name,
      t.team_name,
      d.designation_name,
      GROUP_CONCAT(eb.branch_id) AS branch_ids
    FROM employees e
    LEFT JOIN employee_branches eb ON e.emp_id = eb.emp_id
    LEFT JOIN zones z ON e.zone_id = z.id
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN designations d ON e.designation_id = d.id
    WHERE e.emp_id = ?
    GROUP BY e.emp_id
    LIMIT 1
  `;

  db.query(sql, [empId], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!rows.length)
      return res.status(404).json({ message: "Employee not found" });

    const emp = rows[0];
    emp.branch_ids = emp.branch_ids
      ? emp.branch_ids.split(",").map(id => String(id))
      : [];

    res.json(emp);
  });
};

