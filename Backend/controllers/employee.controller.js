const db = require("../config/db");
const bcrypt = require("bcrypt");

/* ===================== MANAGERS ===================== */
exports.getManagers = async (req, res) => {
  try {

    const { team_id, zone_id, designation_id } = req.query;

    if (!designation_id) {
      return res.json([]);
    }

    /* =========================
       GET CURRENT LEVEL
    ========================= */
    const [[current]] = await db.query(
      "SELECT level FROM designations WHERE id=?",
      [designation_id]
    );

    if (!current) return res.json([]);

    /* =========================
       GET MANAGERS (FIXED LOGIC)
    ========================= */
    const [rows] = await db.query(`
      SELECT 
        e.id,
        e.name,
        e.role,
        d.level,
        t.team_name,
        z.zone_name
      FROM employees e
      LEFT JOIN designations d ON e.designation_id = d.id
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN zones z ON e.zone_id = z.id
      WHERE 
        e.status = 'ACTIVE'
        AND (
          e.role IN ('SUPER_ADMIN','ADMIN')
          OR d.level < ?
        )
      ORDER BY 
        CASE 
          WHEN e.role = 'SUPER_ADMIN' THEN 0
          WHEN e.role = 'ADMIN' THEN 1
          ELSE 2
        END,
        d.level ASC
    `, [current.level]);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load managers" });
  }
};

/* ===================== CREATE EMPLOYEE ===================== */
 exports.createEmployee = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    let {
      joining_status,
      name,
      father_name,
      gender,
      email,
      dob,
      joining_date,
      phone,
      emergency_contact,
      marital_status,
      experience,
      qualification,
      permanent_address,
      temporary_address,
      team_id,
      designation_id,
      manager_id,
      zone_id,
      role,

      primary_branch_id,
      crm_branch_ids = [],
      ticket_branch_ids = [],
      area_ids = []
    } = req.body;

    /* ================= NORMALIZE ARRAYS ================= */

    if (typeof crm_branch_ids === "string")
      crm_branch_ids = JSON.parse(crm_branch_ids);

    if (typeof ticket_branch_ids === "string")
      ticket_branch_ids = JSON.parse(ticket_branch_ids);

    if (typeof area_ids === "string")
      area_ids = JSON.parse(area_ids);

    /* ================= VALIDATION ================= */

    if (!name || !email || !dob || !primary_branch_id) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    /* ================= EMP ID ================= */

    const prefix = joining_status === "TRAINEE" ? "T" : "ICEEMP";

    const [last] = await conn.query(
      `SELECT emp_id FROM employees 
       WHERE emp_id LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    const next = last.length
      ? parseInt(last[0].emp_id.replace(prefix, "")) + 1
      : 1;

    const padded = String(next).padStart(4, "0");
    const emp_id = `${prefix}${padded}`;

    /* ================= PASSWORD ================= */

    const rawPassword = `Info@${padded}`;
    const hash = await bcrypt.hash(rawPassword, 10);

    /* ================= INSERT EMPLOYEE ================= */

    const [result] = await conn.query(
      `INSERT INTO employees (
        emp_id, joining_status, name, father_name, gender,
        email, password, dob, joining_date,
        phone, emergency_contact, marital_status, experience,
        qualification, permanent_address, temporary_address,
        role, team_id, designation_id, manager_id,
        branch_id, zone_id
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        emp_id,
        joining_status || "TRAINEE",
        name,
        father_name || null,
        gender || null,
        email,
        hash,
        dob,
        joining_date || null,
        phone || null,
        emergency_contact || null,
        marital_status || null,
        experience || null,
        qualification || null,
        permanent_address || null,
        temporary_address || null,
        role || "USER_ACCOUNT",
        team_id,
        designation_id,
        manager_id || null,
        primary_branch_id,
        zone_id
      ]
    );

    const empId = emp_id;

    /* ================= AREA MAPPING ================= */

    if (Array.isArray(area_ids) && area_ids.length > 0) {
      const values = area_ids.map(a => [empId, a]);

      await conn.query(
        `INSERT INTO employee_areas (emp_id, area_id) VALUES ?`,
        [values]
      );
    }

    /* ================= PRIMARY ================= */

    await conn.query(
      `INSERT INTO employee_branches 
       (emp_id, branch_id, access_type, module)
       VALUES (?, ?, 'PRIMARY', 'ALL')`,
      [emp_id, primary_branch_id]
    );

    /* ================= CRM ================= */

    for (let b of crm_branch_ids) {
      await conn.query(
        `INSERT IGNORE INTO employee_branches 
         (emp_id, branch_id, access_type, module)
         VALUES (?, ?, 'CRM', 'CRM')`,
        [emp_id, b]
      );
    }

    /* ================= TICKETING ================= */

    for (let b of ticket_branch_ids) {
      await conn.query(
        `INSERT IGNORE INTO employee_branches 
         (emp_id, branch_id, access_type, module)
         VALUES (?, ?, 'SUPPORT', 'TICKETING')`,
        [emp_id, b]
      );
    }

    await conn.commit();

    res.json({
      message: "Employee created successfully",
      emp_id,
      password: rawPassword
    });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    conn.release();
  }
};

exports.getEmployees = async (req, res) => {

  try {

    const sql = `
      SELECT 
        e.emp_id,
        e.name,
        e.email,
        e.status,
        z.zone_name,
        b.branch_name,
        t.team_name,
        d.designation_name
      FROM employees e
      JOIN zones z ON e.zone_id=z.id
      JOIN branches b ON e.branch_id=b.id
      JOIN teams t ON e.team_id=t.id
      JOIN designations d ON e.designation_id=d.id
      ORDER BY e.created_at DESC
    `;

    const [rows] = await db.query(sql);

    res.json(rows);

  } catch (err) {

    res.status(500).json(err);

  }

};

exports.getEmployeeById = async (req, res) => {
  try {

    const [[emp]] = await db.query(
      `SELECT * FROM employees WHERE emp_id=?`,
      [req.params.empId]
    );

    if (!emp) {
      return res.status(404).json({ message: "Not found" });
    }

    /* 🔥 REMOVE PASSWORD BEFORE SENDING */
    delete emp.password;

    /* ✅ GET BRANCH ACCESS */
    const [branches] = await db.query(
      `SELECT branch_id, access_type 
       FROM employee_branches 
       WHERE emp_id=?`,
      [req.params.empId]
    );

    const primary = branches.find(b => b.access_type === "PRIMARY");
    const crm = branches
      .filter(b => b.access_type === "CRM")
      .map(b => b.branch_id);

    const support = branches
      .filter(b => b.access_type === "SUPPORT")
      .map(b => b.branch_id);

    /* ✅ GET AREAS */
    const [areas] = await db.query(
      `SELECT area_id FROM employee_areas WHERE emp_id=?`,
      [req.params.empId]
    );

    res.json({
      ...emp,
      primary_branch_id: primary?.branch_id || emp.branch_id,
      crm_branch_ids: crm,
      ticket_branch_ids: support,
      area_ids: areas.map(a => a.area_id)
    });

  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
};

exports.getActiveEmployees = async (req, res) => {
  try {

    const user = req.user;

    const {
      emp_id,
      name,
      team,
      zone,
      branch
    } = req.query;

    let sql = `
      SELECT 
        e.emp_id,
        e.name,
        e.email,
        e.phone,
        e.role,
        e.status,
        e.dob,
        e.zone_id,
        e.branch_id,
        e.team_id,

        z.zone_name,
        b.branch_name,
        t.team_name,
        d.designation_name

      FROM employees e

      LEFT JOIN zones z ON e.zone_id=z.id
      LEFT JOIN branches b ON e.branch_id=b.id
      LEFT JOIN teams t ON e.team_id=t.id
      LEFT JOIN designations d ON e.designation_id=d.id

      WHERE e.status='ACTIVE'
    `;

    const params = [];

    /* =============================
       🔥 ACCESS CONTROL
    ============================== */

    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
      // ✅ FULL ACCESS
    }

    else {

      const designation = user.designation_name;
      const teamName = user.team_name;

      const mgmtRoles = ["MD", "CEO", "CTO"];

      /* =============================
         MANAGEMENT
      ============================== */
      if (mgmtRoles.includes(designation)) {
        sql += ` AND e.role NOT IN ('ADMIN','SUPER_ADMIN')`;
      }

      /* =============================
         HRD TEAM
      ============================== */
      else if (teamName === "HRD") {
        sql += ` AND e.role NOT IN ('ADMIN','SUPER_ADMIN')`;
      }

      /* =============================
         SALES HEAD / CMO
      ============================== */
      else if (
        teamName === "SALES" &&
        ["CMO", "SALES HEAD"].includes(designation)
      ) {
        sql += ` AND t.team_name='SALES'`;
      }

      /* =============================
         🔥 ZONAL MANAGER / TECH LEAD
      ============================== */

      else if (
        ["ZONAL MANAGER", "TECH LEAD"].includes(designation)
      ) {
        // ✅ FORCE ZONE LEVEL ACCESS
        sql += ` AND e.zone_id=?`;
        params.push(user.zone_id);
      }

      /* =============================
         NORMAL USER
      ============================== */

      else {

        // 🔥 DEFAULT → BRANCH LEVEL
        if (user.branch_id) {
          sql += ` AND e.branch_id=?`;
          params.push(user.branch_id);
        }

        else if (user.zone_id) {
          sql += ` AND e.zone_id=?`;
          params.push(user.zone_id);
        }

      }
    }

    /* =============================
       🔥 FILTERS
    ============================== */

    if (emp_id) {
      sql += " AND e.emp_id LIKE ?";
      params.push(`%${emp_id}%`);
    }

    if (name) {
      sql += " AND e.name LIKE ?";
      params.push(`%${name}%`);
    }

    if (team && team !== "0") {
      sql += " AND e.team_id=?";
      params.push(Number(team));
    }

    if (zone && zone !== "0") {
      sql += " AND e.zone_id=?";
      params.push(Number(zone));
    }

    if (branch && branch !== "0") {
      sql += " AND e.branch_id=?";
      params.push(Number(branch));
    }

    sql += " ORDER BY e.created_at DESC LIMIT 200";

    const [rows] = await db.query(sql, params);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load active employees"
    });
  }
};

exports.getRelievedEmployees = async (req, res) => {
  try {

    const user = req.user;

    const {
      emp_id,
      name,
      team,
      zone,
      branch
    } = req.query;

    let sql = `
      SELECT 
        e.emp_id,
        e.name,
        e.email,
        e.phone,
        e.role,
        e.status,
        e.dob,
        e.zone_id,
        e.branch_id,
        e.team_id,

        z.zone_name,
        b.branch_name,
        t.team_name,
        d.designation_name

      FROM employees e
      LEFT JOIN zones z ON e.zone_id = z.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN designations d ON e.designation_id = d.id

      WHERE e.status IN ('RELIEVED','DEACTIVATED')
    `;

    const params = [];

    /* =============================
       🔥 ACCESS CONTROL (SAME AS ACTIVE)
    ============================== */

    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
      // ✅ FULL ACCESS
    }

    else {

      const designation = user.designation_name;
      const teamName = user.team_name;

      /* =============================
         MANAGEMENT (MD / CEO / CTO)
      ============================== */

      const mgmtRoles = ["MD", "CEO", "CTO"];

      if (mgmtRoles.includes(designation)) {
        sql += ` AND e.role NOT IN ('ADMIN','SUPER_ADMIN')`;
      }

      /* =============================
         HRD → FULL ACCESS (EXCEPT ADMIN)
      ============================== */

      else if (teamName === "HRD") {
        sql += ` AND e.role NOT IN ('ADMIN','SUPER_ADMIN')`;
      }

      /* =============================
         SALES HEAD / CMO
      ============================== */

      else if (
        teamName === "SALES" &&
        ["CMO", "SALES HEAD"].includes(designation)
      ) {
        sql += ` AND t.team_name = 'SALES'`;
      }

      /* =============================
         🔥 ZONAL TECH LEAD / MANAGER
         (HANDLE ALL BRANCHES IN ZONE)
      ============================== */

      else if (
        ["TECH LEAD", "ZONAL MANAGER"].includes(designation)
      ) {
        sql += ` AND e.zone_id = ?`;
        params.push(user.zone_id);
      }

      /* =============================
         NORMAL USER
      ============================== */

      else {

        if (user.branch_id) {
          sql += ` AND e.branch_id = ?`;
          params.push(user.branch_id);
        }

        else if (user.zone_id) {
          sql += ` AND e.zone_id = ?`;
          params.push(user.zone_id);
        }

      }
    }

    /* =============================
       🔥 FILTERS
    ============================== */

    if (emp_id) {
      sql += " AND e.emp_id LIKE ?";
      params.push(`%${emp_id}%`);
    }

    if (name) {
      sql += " AND e.name LIKE ?";
      params.push(`%${name}%`);
    }

    if (team && team !== "0") {
      sql += " AND e.team_id = ?";
      params.push(Number(team));
    }

    if (zone && zone !== "0") {
      sql += " AND e.zone_id = ?";
      params.push(Number(zone));
    }

    if (branch && branch !== "0") {
      sql += " AND e.branch_id = ?";
      params.push(Number(branch));
    }

    sql += " ORDER BY e.created_at DESC LIMIT 200";

    const [rows] = await db.query(sql, params);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to load relieved employees"
    });
  }
};

exports.reactivateEmployee = async (req, res) => {
  try {

    const { empId } = req.params;
    const user = req.user; // from auth middleware

    // 🔐 ROLE CHECK
    if (!["ADMIN","SUPER_ADMIN","HRD"].includes(user.role)) {
      return res.status(403).json({ message: "No permission" });
    }

    await db.query(
      `UPDATE employees 
       SET status='ACTIVE', updated_at=NOW()
       WHERE emp_id=?`,
      [empId]
    );

    res.json({ message: "Employee Activated Successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to activate employee" });
  }
};

exports.updateEmployee = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const userRole = req.user?.role;
    const oldEmpId = req.params.empId;

    let {
      emp_id,
      name,
      father_name,
      gender,
      email,
      password, // 🔥 NEW FIELD
      phone,
      emergency_contact,
      marital_status,
      qualification,
      permanent_address,
      temporary_address,
      team_id,
      designation_id,
      manager_id,
      zone_id,
      status,
      joining_date,
      joining_status,
      role,
      primary_branch_id,
      crm_branch_ids = [],
      ticket_branch_ids = [],
      area_ids = []
    } = req.body;

    /* ================= NORMALIZE ================= */

    if (typeof crm_branch_ids === "string")
      crm_branch_ids = JSON.parse(crm_branch_ids);

    if (typeof ticket_branch_ids === "string")
      ticket_branch_ids = JSON.parse(ticket_branch_ids);

    if (typeof area_ids === "string")
      area_ids = JSON.parse(area_ids);

    /* ================= EXPERIENCE ================= */

    const experience = `${req.body.exp_year || 0}.${req.body.exp_month || 0}`;

    /* ================= PASSWORD HASH ================= */

    let hashedPassword = null;

if (password && password.trim() !== "") {

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  hashedPassword = await bcrypt.hash(password, 10);
}

    /* ================= EMP ID SECURITY ================= */

    let finalEmpId = oldEmpId;

    if (emp_id && emp_id !== oldEmpId) {
      if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
        throw new Error("Not allowed to change Employee ID");
      }

      const [exists] = await conn.query(
        `SELECT emp_id FROM employees WHERE emp_id=?`,
        [emp_id]
      );

      if (exists.length) {
        throw new Error("Employee ID already exists");
      }

      finalEmpId = emp_id;

      /* ✅ UPDATE CHILD TABLES FIRST */

      await conn.query(
        `UPDATE employee_branches SET emp_id=? WHERE emp_id=?`,
        [finalEmpId, oldEmpId]
      );

      await conn.query(
        `UPDATE employee_areas SET emp_id=? WHERE emp_id=?`,
        [finalEmpId, oldEmpId]
      );
    }

    /* ================= UPDATE EMPLOYEE ================= */

    if (hashedPassword) {
      // 🔥 WITH PASSWORD UPDATE
      await conn.query(
        `UPDATE employees SET
          emp_id=?,
          name=?, father_name=?, gender=?, email=?, password=?,
          phone=?, emergency_contact=?, marital_status=?,
          experience=?, qualification=?,
          permanent_address=?, temporary_address=?,
          team_id=?, designation_id=?, manager_id=?,
          branch_id=?, zone_id=?, status=?,
          joining_date=?, joining_status=?, role=?
        WHERE emp_id=?`,
        [
          finalEmpId,
          name,
          father_name,
          gender,
          email,
          hashedPassword,
          phone,
          emergency_contact,
          marital_status,
          experience,
          qualification,
          permanent_address,
          temporary_address,
          team_id,
          designation_id,
          manager_id || null,
          primary_branch_id,
          zone_id,
          status,
          joining_date,
          joining_status,
          role,
          oldEmpId
        ]
      );
    } else {
      // 🔥 WITHOUT PASSWORD UPDATE
      await conn.query(
        `UPDATE employees SET
          emp_id=?,
          name=?, father_name=?, gender=?, email=?,
          phone=?, emergency_contact=?, marital_status=?,
          experience=?, qualification=?,
          permanent_address=?, temporary_address=?,
          team_id=?, designation_id=?, manager_id=?,
          branch_id=?, zone_id=?, status=?,
          joining_date=?, joining_status=?, role=?
        WHERE emp_id=?`,
        [
          finalEmpId,
          name,
          father_name,
          gender,
          email,
          phone,
          emergency_contact,
          marital_status,
          experience,
          qualification,
          permanent_address,
          temporary_address,
          team_id,
          designation_id,
          manager_id || null,
          primary_branch_id,
          zone_id,
          status,
          joining_date,
          joining_status,
          role,
          oldEmpId
        ]
      );
    }

    /* ================= SYNC CHILD TABLES ================= */

    if (finalEmpId !== oldEmpId) {
      await conn.query(
        `UPDATE employee_branches SET emp_id=? WHERE emp_id=?`,
        [finalEmpId, oldEmpId]
      );

      await conn.query(
        `UPDATE employee_areas SET emp_id=? WHERE emp_id=?`,
        [finalEmpId, oldEmpId]
      );
    }

    /* ================= CLEAR OLD ================= */

    await conn.query(
      `DELETE FROM employee_areas WHERE emp_id=?`,
      [finalEmpId]
    );

    await conn.query(
      `DELETE FROM employee_branches WHERE emp_id=?`,
      [finalEmpId]
    );

    /* ================= PRIMARY ================= */

    await conn.query(
      `INSERT INTO employee_branches 
       (emp_id, branch_id, access_type, module)
       VALUES (?, ?, 'PRIMARY', 'ALL')`,
      [finalEmpId, primary_branch_id] // ✅ FIXED
    );

    /* ================= CRM ================= */

    if (Array.isArray(crm_branch_ids)) {
      for (let b of crm_branch_ids) {
        if (Number(b) === Number(primary_branch_id)) continue;

        await conn.query(
          `INSERT IGNORE INTO employee_branches 
           (emp_id, branch_id, access_type, module)
           VALUES (?, ?, 'CRM', 'CRM')`,
          [finalEmpId, b] // ✅ FIXED
        );
      }
    }

    /* ================= TICKETING SUPPORT ================= */

    if (Array.isArray(ticket_branch_ids)) {
      for (let b of ticket_branch_ids) {
        if (Number(b) === Number(primary_branch_id)) continue;

        await conn.query(
          `INSERT IGNORE INTO employee_branches 
           (emp_id, branch_id, access_type, module)
           VALUES (?, ?, 'SUPPORT', 'TICKETING')`,
          [finalEmpId, b] // ✅ FIXED
        );
      }
    }

    /* ================= LEAD SUPPORT ================= */

    if (Array.isArray(ticket_branch_ids)) {
      for (let b of ticket_branch_ids) {
        if (Number(b) === Number(primary_branch_id)) continue;

        await conn.query(
          `INSERT IGNORE INTO employee_branches 
           (emp_id, branch_id, access_type, module)
           VALUES (?, ?, 'SUPPORT', 'LEAD')`,
          [finalEmpId, b] // ✅ FIXED
        );
      }
    }

    /* ================= AREA ================= */

    if (Array.isArray(area_ids) && area_ids.length > 0) {
      const values = area_ids.map(a => [finalEmpId, a]);

      await conn.query(
        `INSERT INTO employee_areas (emp_id, area_id) VALUES ?`,
        [values]
      );
    }

    await conn.commit();

    res.json({
      message: "Employee updated successfully",
      emp_id: finalEmpId
    });

  } catch (err) {
    await conn.rollback();

    console.error("UPDATE ERROR:", err);

    res.status(500).json({
      message: err.message || "Update failed"
    });

  } finally {
    conn.release();
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    await db.query(
      "DELETE FROM employees WHERE emp_id=?",
      [req.params.empId]
    );
    res.json({ message: "Employee deleted" });
  } catch (err) {
    res.status(500).json(err);
  }
};