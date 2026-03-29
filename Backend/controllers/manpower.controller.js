const db = require("../config/db");

/* ================= CREATE REQUEST ================= */
exports.createRequest = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const user = req.user; // from auth middleware

    const {
      zone_id,
      branch_id,
      team_id,
      designation_id,
      request_type,
      reporting_manager,
      openings,
      experience_required,
      salary_range,
      key_skills,
      preferred_education,
      additional_skills,
      replaced_emp_id,
      replaced_emp_name,
      reason_for_requirement,
      priority_level,
      required_joining_date
    } = req.body;

    /* ================= VALIDATION ================= */
    if (!zone_id || !branch_id || !team_id || !designation_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ================= FETCH MASTER DATA ================= */
/* ================= FETCH MASTER DATA ================= */
const [[zone]] = await conn.query(
  `SELECT zone_name AS name FROM zones WHERE id = ?`,
  [zone_id]
);

const [[branch]] = await conn.query(
  `SELECT branch_name AS name FROM branches WHERE id = ?`,
  [branch_id]
);

const [[team]] = await conn.query(
  `SELECT team_name AS name FROM teams WHERE id = ?`,
  [team_id]
);

const [[designation]] = await conn.query(
  `SELECT designation_name AS name FROM designations WHERE id = ?`,
  [designation_id]
);

    if (!zone || !branch || !team || !designation) {
      throw new Error("Invalid master data");
    }

    /* ================= GENERATE REQUEST NUMBER ================= */
    const [[last]] = await conn.query(
      `SELECT id FROM manpower_requests ORDER BY id DESC LIMIT 1`
    );

    const nextId = last ? last.id + 1 : 1;
    const request_number = `MR-${new Date().getFullYear()}-${String(nextId).padStart(4, "0")}`;

    /* ================= INSERT REQUEST ================= */
    const [result] = await conn.query(
      `INSERT INTO manpower_requests (
        request_number,
        employee_emp_id,
        employee_name,
        zone,
        branch,
        department,
        designation,
        request_type,
        requester_emp_id,
        manager_emp_id,
        openings,
        salary_range,
        priority_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request_number,
        user.emp_id,
        user.name,
        zone.name,
        branch.name,
        team.name,
        designation.name,
        request_type,
        user.emp_id,
        reporting_manager || null,
        openings || 1,
        salary_range || 0,
        priority_level || "Medium"
      ]
    );

    const requestId = result.insertId;

    /* ================= INSERT LOG ================= */
    await conn.query(
      `INSERT INTO manpower_logs (
        request_id,
        stage,
        action_taken,
        actor_emp_id,
        actor_name,
        comments
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        "Request Created",
        "Submitted",
        user.emp_id,
        user.name,
        "Manpower request created"
      ]
    );

    await conn.commit();

    res.status(201).json({
      message: "Request created successfully",
      request_id: requestId,
      request_number
    });

  } catch (err) {
    await conn.rollback();
    console.error("CREATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to create request" });
  } finally {
    conn.release();
  }
};

const getVisibilityClause = (user, params) => {
  if (user.role === "Admin") return "";

  const map = {
    Requester: "mr.requester_emp_id",
    Manager: "mr.manager_emp_id",
    CTO: "mr.cto_emp_id",
    HR: "mr.hr_emp_id",
    Recruiter: "mr.recruiter_emp_id",
  };

  if (map[user.role]) {
    params.push(user.emp_id);
    return `${map[user.role]} = ?`;
  }

  return "1=0";
};

/* ================= SUMMARY ================= */
exports.getSummary = async (req, res) => {
  try {
    const params = [];
    const clauses = [];

    const visibility = getVisibilityClause(req.user, params);
    if (visibility) clauses.push(visibility);

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const [[total]] = await db.query(
      `SELECT COUNT(*) AS total FROM manpower_requests mr ${where}`,
      params
    );

    const [[pending]] = await db.query(
      `SELECT COUNT(*) AS pending_my_approval
       FROM manpower_requests mr
       WHERE mr.final_status = 'Submitted'`
    );

    const [[approved]] = await db.query(
      `SELECT COUNT(*) AS approved_flow
       FROM manpower_requests mr
       WHERE mr.final_status LIKE '%Approved%'`
    );

    const [[rejected]] = await db.query(
      `SELECT COUNT(*) AS rejected
       FROM manpower_requests mr
       WHERE mr.final_status LIKE '%Rejected%'`
    );

    const [[recruitment]] = await db.query(
      `SELECT COUNT(*) AS recruitment
       FROM manpower_requests mr
       WHERE mr.recruiter_status IN ('Received','In Progress')`
    );

    const [[closed]] = await db.query(
      `SELECT COUNT(*) AS closed
       FROM manpower_requests mr
       WHERE mr.recruiter_status = 'Closed'`
    );

    res.json({
      total: total.total,
      pending_my_approval: pending.pending_my_approval,
      approved_flow: approved.approved_flow,
      rejected: rejected.rejected,
      recruitment: recruitment.recruitment,
      closed: closed.closed,
    });

  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ message: "Failed to load summary" });
  }
};

/* ================= LIST ================= */
exports.getRequests = async (req, res) => {
  try {
    const { search = "", status = "", department = "" } = req.query;

    const params = [];
    const clauses = [];

    const visibility = getVisibilityClause(req.user, params);
    if (visibility) clauses.push(visibility);

    if (search) {
      clauses.push(`(
        mr.request_number LIKE ?
        OR mr.employee_emp_id LIKE ?
        OR mr.employee_name LIKE ?
        OR mr.designation LIKE ?
      )`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      clauses.push("mr.final_status = ?");
      params.push(status);
    }

    if (department) {
      clauses.push("mr.department LIKE ?");
      params.push(`%${department}%`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT 
        mr.id,
        mr.request_number,
        mr.employee_emp_id,
        mr.employee_name,
        mr.branch,
        mr.department,
        mr.designation,
        mr.final_status
      FROM manpower_requests mr
      ${where}
      ORDER BY mr.id DESC`,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error("List Error:", err);
    res.status(500).json({ message: "Failed to load requests" });
  }
};

/* ================= DETAIL ================= */
exports.getRequestById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM manpower_requests WHERE id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Request not found" });
    }

    const [logs] = await db.query(
      `SELECT * FROM manpower_logs WHERE request_id = ? ORDER BY id DESC`,
      [req.params.id]
    );

    res.json({
      request: rows[0],
      logs,
    });

  } catch (err) {
    console.error("Detail Error:", err);
    res.status(500).json({ message: "Failed to load request detail" });
  }
};