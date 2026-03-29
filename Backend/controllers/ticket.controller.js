const db = require("../config/db");

// GET ALL
exports.getTicketTypes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT type_id, type_name AS name FROM ticket_types ORDER BY type_name`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to load ticket types" });
  }
};

// CREATE
exports.createTicketType = async (req, res) => {
  try {
    const { type_name } = req.body;

    if (!type_name) {
      return res.status(400).json({ message: "Type name required" });
    }

    await db.query(
      `INSERT INTO ticket_types (type_name) VALUES (?)`,
      [type_name]
    );

    res.json({ message: "Ticket type created" });

  } catch (err) {
    res.status(500).json({ message: "Already exists / Error" });
  }
};

// UPDATE
exports.updateTicketType = async (req, res) => {
  try {
    const { type_name } = req.body;

    await db.query(
      `UPDATE ticket_types SET type_name=? WHERE type_id=?`,
      [type_name, req.params.id]
    );

    res.json({ message: "Updated" });

  } catch {
    res.status(500).json({ message: "Update failed" });
  }
};

// DELETE
exports.deleteTicketType = async (req, res) => {
  try {
    await db.query(
      `DELETE FROM ticket_types WHERE type_id=?`,
      [req.params.id]
    );

    res.json({ message: "Deleted" });

  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
};

// GET BY TYPE
exports.getSubtypesByType = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        subtype_id,
        subtype_name AS name,
        type_id
       FROM ticket_subtypes
       WHERE type_id=?
       ORDER BY subtype_name`,
      [req.params.typeId]
    );

    res.json(rows);

  } catch {
    res.status(500).json({ message: "Failed to load subtypes" });
  }
};

// CREATE
exports.createSubtype = async (req, res) => {
  try {
    const { subtype_name, type_id } = req.body;

    if (!subtype_name || !type_id) {
      return res.status(400).json({ message: "All fields required" });
    }

    await db.query(
      `INSERT INTO ticket_subtypes (subtype_name, type_id)
       VALUES (?, ?)`,
      [subtype_name, type_id]
    );

    res.json({ message: "Subtype created" });

  } catch {
    res.status(500).json({ message: "Error / Exists" });
  }
};

// UPDATE
exports.updateSubtype = async (req, res) => {
  try {
    const { subtype_name, type_id } = req.body;

    await db.query(
      `UPDATE ticket_subtypes
       SET subtype_name=?, type_id=?
       WHERE subtype_id=?`,
      [subtype_name, type_id, req.params.id]
    );

    res.json({ message: "Updated" });

  } catch {
    res.status(500).json({ message: "Update failed" });
  }
};

// DELETE
exports.deleteSubtype = async (req, res) => {
  try {
    await db.query(
      `DELETE FROM ticket_subtypes WHERE subtype_id=?`,
      [req.params.id]
    );

    res.json({ message: "Deleted" });

  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
};

/* =============================
   CREATE TICKET
============================= */

exports.createTicket = async (req, res) => {
  try {
    const data = req.body;

    if (!data.type_of_ticket)
      return res.status(400).json({ message: "Ticket type required" });

    if (!data.branch_id)
      return res.status(400).json({ message: "Branch required" });

    if (!data.assign_team)
      return res.status(400).json({ message: "Team required" });

    if (!data.assigned_to)
      return res.status(400).json({ message: "Employee required" });

    /* 🔥 CONVERT ID → EMP_ID */
    let assignedEmpId = data.assigned_to;

    const [[emp]] = await db.query(
      `SELECT emp_id FROM employees WHERE id = ?`,
      [data.assigned_to]
    );

    if (!emp) {
      return res.status(400).json({ message: "Invalid employee" });
    }

    assignedEmpId = emp.emp_id;

    /* -------- GET BRANCH SHORT CODE -------- */

    const [branchRows] = await db.query(
      `SELECT short_name FROM branches WHERE id = ?`,
      [data.branch_id]
    );

    if (!branchRows.length)
      return res.status(404).json({ message: "Branch not found" });

    const prefix = "ICE" + branchRows[0].short_name;

    /* -------- GET LAST TICKET -------- */

    const [lastRows] = await db.query(
      `SELECT ticket_id FROM tickets WHERE ticket_id LIKE ? ORDER BY ticket_id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let number = 1;

    if (lastRows.length) {
      const lastId = lastRows[0].ticket_id;
      const lastNumber = parseInt(lastId.replace(prefix, "")) || 0;
      number = lastNumber + 1;
    }

    const ticketId = prefix + number.toString().padStart(4, "0");

    /* -------- INSERT -------- */

    await db.query(
      `INSERT INTO tickets
      (
        ticket_id,
        type_of_ticket,
        subtype_of_ticket,
        priority,
        due_date,
        branch_id,
        assign_team,
        assigned_to,
        customer_id,
        customer_name,
        reporter_name,
        landmark,
        address,
        contact_number1,
        contact_number2,
        more_details,
        status,
        created_by
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ticketId,
        data.type_of_ticket,
        data.subtype_of_ticket || null,
        data.priority || "Low",
        data.due_date,
        data.branch_id,
        data.assign_team,
        assignedEmpId,   // ✅ FIXED
        data.customer_id || null,
        data.customer_name,
        data.reporter_name,
        data.landmark,
        data.address,
        data.contact_number1,
        data.contact_number2,
        data.more_details,
        data.status || "Opened",
        req.user?.emp_id || null
      ]
    );

    res.json({
      message: "Ticket created successfully",
      ticket_id: ticketId
    });

  } catch (err) {
    console.error("Ticket insert error:", err.sqlMessage || err);
    res.status(500).json({
      message: err.sqlMessage || "Ticket creation failed"
    });
  }
};

/* =============================
   SEARCH OPENED TICKETS
============================= */

exports.searchOpenedTickets = async (req, res) => {

  try {

    const user = req.user;
    const filters = req.body || {};

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const offset = (page - 1) * limit;

    const allowedSortFields = [
      "ticket_id",
      "customer_id",
      "created_date"
    ];

    const sortField = allowedSortFields.includes(filters.sortField)
      ? filters.sortField
      : "created_date";

    const sortOrder = filters.sortOrder === "asc" ? "ASC" : "DESC";

    let where = `WHERE t.status='Opened'`;
    let params = [];

    /* -----------------------
       SEARCH FILTERS
    ----------------------- */

    if (filters.ticket_no) {
      where += ` AND t.ticket_id=?`;
      params.push(filters.ticket_no);
    }

    if (filters.customer_id) {
      where += ` AND t.customer_id LIKE ?`;
      params.push(`%${filters.customer_id}%`);
    }

    if (filters.customer_name) {
      where += ` AND t.customer_name LIKE ?`;
      params.push(`%${filters.customer_name}%`);
    }

    if (filters.name) {
      where += ` AND t.reporter_name LIKE ?`;
      params.push(`%${filters.name}%`);
    }

    if (filters.branch) {
      where += ` AND t.branch_id=?`;
      params.push(filters.branch);
    }

    if (filters.assigned_team) {
      where += ` AND t.assign_team=?`;
      params.push(filters.assigned_team);
    }

    if (filters.type_of_ticket) {
      where += ` AND t.type_of_ticket=?`;
      params.push(filters.type_of_ticket);
    }

    if (filters.subtype_of_ticket) {
      where += ` AND t.subtype_of_ticket=?`;
      params.push(filters.subtype_of_ticket);
    }

    if (filters.from_date && filters.to_date) {
      where += ` AND DATE(t.created_date) BETWEEN ? AND ?`;
      params.push(filters.from_date, filters.to_date);
    }

    /* -----------------------
       HIERARCHY FILTER
    ----------------------- */

    if (user.role === "ZONE_MANAGER") {

      where += ` AND t.branch_id IN (
        SELECT id FROM branches WHERE zone_id=?
      )`;

      params.push(user.zone_id);

    } else if (user.role === "BRANCH_MANAGER") {

      where += ` AND t.branch_id=?`;
      params.push(user.branch_id);

    } else if (user.role === "TEAM_LEAD") {

      where += ` AND t.assign_team=?`;
      params.push(user.team_id);

    } else if (user.role === "EMPLOYEE") {

      where += ` AND t.assigned_to=?`;
      params.push(user.emp_id);

    }

    /* -----------------------
       COUNT QUERY
    ----------------------- */

    const countSql = `
      SELECT COUNT(*) as total
      FROM tickets t
      ${where}
    `;

    const [countRows] = await db.query(countSql, params);

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    /* -----------------------
       MAIN QUERY
    ----------------------- */

    const sql = `
      SELECT
        t.ticket_id,
        t.customer_id,
        t.customer_name,
        t.created_date,
        t.branch_id,
        t.reporter_name,
        tm.team_name,
        e.name AS assigned_to_name,
        t.status
      FROM tickets t
      LEFT JOIN teams tm
        ON t.assign_team = tm.id
      LEFT JOIN employees e
        ON t.assigned_to = e.emp_id
      ${where}
      ORDER BY t.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(
      sql,
      [...params, limit, offset]
    );

    res.json({
      tickets: rows,
      totalPages,
      total
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to fetch tickets"
    });

  }

};

/* =============================
   SEARCH CLOSED TICKETS
============================= */

exports.searchClosedTickets = async (req, res) => {

  try {

    const user = req.user;
    const filters = req.body || {};

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const offset = (page - 1) * limit;

    const allowedSortFields = [
      "ticket_id",
      "customer_id",
      "created_date",
      "updated_at"
    ];

    const sortField = allowedSortFields.includes(filters.sortField)
      ? filters.sortField
      : "updated_at";

    const sortOrder = filters.sortOrder === "asc" ? "ASC" : "DESC";

    let where = `WHERE t.status='Closed'`;
    let params = [];

    /* -----------------------
       SEARCH FILTERS
    ----------------------- */

    if (filters.ticket_no) {
      where += ` AND t.ticket_id=?`;
      params.push(filters.ticket_no);
    }

    if (filters.customer_id) {
      where += ` AND t.customer_id LIKE ?`;
      params.push(`%${filters.customer_id}%`);
    }

    if (filters.customer_name) {
      where += ` AND t.customer_name LIKE ?`;
      params.push(`%${filters.customer_name}%`);
    }

    if (filters.name) {
      where += ` AND t.reporter_name LIKE ?`;
      params.push(`%${filters.name}%`);
    }

    if (filters.branch) {
      where += ` AND t.branch_id=?`;
      params.push(filters.branch);
    }

    if (filters.assigned_team) {
      where += ` AND t.assign_team=?`;
      params.push(filters.assigned_team);
    }

    if (filters.type_of_ticket) {
      where += ` AND t.type_of_ticket=?`;
      params.push(filters.type_of_ticket);
    }

    if (filters.subtype_of_ticket) {
      where += ` AND t.subtype_of_ticket=?`;
      params.push(filters.subtype_of_ticket);
    }

    // 🔥 Closed date filter (important)
    if (filters.from_date && filters.to_date) {
      where += ` AND DATE(t.updated_at) BETWEEN ? AND ?`;
      params.push(filters.from_date, filters.to_date);
    }

    /* -----------------------
       HIERARCHY FILTER
    ----------------------- */

    if (user.role === "ZONE_MANAGER") {

      where += ` AND t.branch_id IN (
        SELECT id FROM branches WHERE zone_id=?
      )`;

      params.push(user.zone_id);

    } else if (user.role === "BRANCH_MANAGER") {

      where += ` AND t.branch_id=?`;
      params.push(user.branch_id);

    } else if (user.role === "TEAM_LEAD") {

      where += ` AND t.assign_team=?`;
      params.push(user.team_id);

    } else if (user.role === "EMPLOYEE") {

      where += ` AND t.assigned_to=?`;
      params.push(user.emp_id);

    }

    /* -----------------------
       COUNT QUERY
    ----------------------- */

    const countSql = `
      SELECT COUNT(*) as total
      FROM tickets t
      ${where}
    `;

    const [countRows] = await db.query(countSql, params);

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    /* -----------------------
       MAIN QUERY
    ----------------------- */

    const sql = `
      SELECT
        t.ticket_id,
        t.customer_id,
        t.customer_name,
        t.created_date,
        t.updated_at,
        t.branch_id,
        t.reporter_name,
        tm.team_name,
        e.name AS assigned_to_name,
        t.status
      FROM tickets t
      LEFT JOIN teams tm
        ON t.assign_team = tm.id
      LEFT JOIN employees e
        ON t.assigned_to = e.emp_id
      ${where}
      ORDER BY t.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(
      sql,
      [...params, limit, offset]
    );

    res.json({
      tickets: rows,
      totalPages,
      total
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to fetch closed tickets"
    });

  }

};

exports.moveTicket = async (req, res) => {
  try {

    console.log("===== MOVE TICKET START =====");

    const user = req.user;
    const { ticketId } = req.params;
    const { new_assigned_team, new_assigned_to } = req.body;

    console.log("REQ PARAMS:", { ticketId });
    console.log("REQ BODY:", { new_assigned_team, new_assigned_to });
    console.log("LOGGED USER:", user);

    // ✅ VALIDATIONS
    if (!ticketId) {
      console.log("❌ Missing ticketId");
      return res.status(400).json({ message: "Ticket ID missing" });
    }

    if (!new_assigned_team) {
      console.log("❌ Missing team");
      return res.status(400).json({ message: "Team is required" });
    }

    // ✅ FETCH CURRENT TICKET
    const [[current]] = await db.query(
      `SELECT assign_team, assigned_to FROM tickets WHERE ticket_id = ?`,
      [ticketId]
    );

    console.log("CURRENT TICKET:", current);

    if (!current) {
      console.log("❌ Ticket not found");
      return res.status(404).json({ message: "Ticket not found" });
    }

    // ✅ VALIDATE NEW EMPLOYEE
    if (new_assigned_to) {
      console.log("Checking NEW employee:", new_assigned_to);

      const [[emp]] = await db.query(
        `SELECT emp_id, name FROM employees WHERE emp_id = ?`,
        [new_assigned_to]
      );

      console.log("NEW EMP RESULT:", emp);

      if (!emp) {
        console.log("❌ Invalid NEW employee");
        return res.status(400).json({ message: "Invalid employee ID" });
      }
    }

    // ✅ VALIDATE OLD EMPLOYEE (IMPORTANT)
    let fromEmp = current.assigned_to;

    if (fromEmp) {
      console.log("Checking OLD employee:", fromEmp);

      const [[oldEmp]] = await db.query(
        `SELECT emp_id FROM employees WHERE emp_id = ?`,
        [fromEmp]
      );

      console.log("OLD EMP RESULT:", oldEmp);

      if (!oldEmp) {
        console.log("⚠️ Old employee invalid → setting NULL");
        fromEmp = null;
      }
    }

    // ✅ UPDATE TICKET
    console.log("Updating ticket...");

    const [updateResult] = await db.query(
      `UPDATE tickets 
       SET assign_team = ?, assigned_to = ? 
       WHERE ticket_id = ?`,
      [
        new_assigned_team,
        new_assigned_to || null,
        ticketId
      ]
    );

    console.log("UPDATE RESULT:", updateResult);

    // ✅ INSERT HISTORY
    console.log("Inserting into ticket_assignments...");

    const [insertResult] = await db.query(
      `INSERT INTO ticket_assignments
       (ticket_id, from_team, to_team, from_employee, to_employee, assigned_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ticketId,
        current.assign_team,
        new_assigned_team,
        fromEmp,
        new_assigned_to || null,
        user.emp_id
      ]
    );

    console.log("INSERT RESULT:", insertResult);

    console.log("===== MOVE SUCCESS =====");

    res.json({ message: "Ticket moved successfully" });

  } catch (err) {

    console.error("===== MOVE ERROR =====");
    console.error(err);
    console.error("STACK:", err.stack);

    res.status(500).json({
      message: "Failed to move ticket",
      error: err.message
    });
  }
};

exports.getEmployeesByBranchTeam = async (req, res) => {
  try {
    console.log("===== LOAD EMPLOYEES START =====");

    const { branch_id, team_id } = req.query;

    console.log("REQ QUERY:", { branch_id, team_id });

    if (!branch_id || !team_id) {
      return res.status(400).json({ message: "Missing branch or team" });
    }

    const [rows] = await db.query(
      `
      SELECT 
        e.emp_id,
        e.name
      FROM employees e
      INNER JOIN employee_branches eb
        ON eb.emp_id = e.emp_id
      WHERE 
        e.status = 'ACTIVE'
        AND e.team_id = ?
        AND eb.branch_id = ?
        AND e.emp_id IS NOT NULL
      ORDER BY e.name
      `,
      [team_id, branch_id]
    );

    console.log("EMPLOYEE DATA FINAL:", rows);

    res.json(rows);

  } catch (err) {
    console.error("LOAD EMP ERROR:", err);
    res.status(500).json({ message: "Failed to load employees" });
  }
};

exports.updateTicket = async (req, res) => {
  try {

    console.log("===== UPDATE TICKET START =====");

    const user = req.user;
    const { ticketId } = req.params;
    const { comments } = req.body;

    console.log("REQ PARAMS:", { ticketId });
    console.log("REQ BODY:", { comments });
    console.log("LOGGED USER:", user);

    // ================= VALIDATION =================
    if (!ticketId) {
      console.log("❌ Missing ticketId");
      return res.status(400).json({ message: "Ticket ID is required" });
    }

    if (!comments || comments.trim() === "") {
      console.log("❌ Comments missing");
      return res.status(400).json({ message: "Comments required" });
    }

    // ================= CHECK TICKET =================
    const [[ticketExists]] = await db.query(
      `SELECT ticket_id FROM tickets WHERE ticket_id = ?`,
      [ticketId]
    );

    console.log("TICKET CHECK:", ticketExists);

    if (!ticketExists) {
      console.log("❌ Ticket not found");
      return res.status(404).json({ message: "Ticket not found" });
    }

    // ================= INSERT ACTION =================
    console.log("Inserting ticket action...");

    const [result] = await db.query(
      `
      INSERT INTO ticket_actions
      (ticket_id, action_type, comments, action_by)
      VALUES (?, ?, ?, ?)
      `,
      [
        ticketId,
        "UPDATED",
        comments.trim(),
        user.emp_id
      ]
    );

    console.log("INSERT RESULT:", result);

    console.log("===== UPDATE SUCCESS =====");

    res.json({
      message: "Ticket updated successfully",
      action_id: result.insertId
    });

  } catch (err) {

    console.error("===== UPDATE ERROR =====");
    console.error(err);
    console.error("STACK:", err.stack);

    res.status(500).json({
      message: "Update failed",
      error: err.message
    });
  }
};

exports.getTicketHistory = async (req, res) => {
  try {

    const { ticketId } = req.params;

    console.log("===== TICKET HISTORY START =====", ticketId);

    // ✅ 1. GET TICKET DETAILS
    const [[ticket]] = await db.query(
      `
SELECT 
  t.*,
  tt.type_name,
  st.subtype_name,
  b.branch_name,
  tm.team_name,
  e.name AS assigned_name,
  cb.name AS created_by_name
FROM tickets t
LEFT JOIN ticket_types tt 
  ON t.type_of_ticket = tt.type_id
LEFT JOIN ticket_subtypes st 
  ON t.subtype_of_ticket = st.subtype_id
LEFT JOIN branches b 
  ON t.branch_id = b.id
LEFT JOIN teams tm 
  ON t.assign_team = tm.id
LEFT JOIN employees e 
  ON t.assigned_to = e.id  
LEFT JOIN employees cb 
  ON t.created_by = cb.emp_id
WHERE t.ticket_id = ?;
      `,
      [ticketId]
    );

    // ✅ 2. GET ACTIONS
    const [actions] = await db.query(
      `
      SELECT 
        ta.*,
        e.name AS action_by_name
      FROM ticket_actions ta
      LEFT JOIN employees e 
        ON ta.action_by = e.emp_id
      WHERE ta.ticket_id = ?
      ORDER BY ta.created_at ASC
      `,
      [ticketId]
    );

    res.json({
      ticket,
      actions
    });

  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ message: "Failed to load history" });
  }
};

exports.closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const {
      action_type,
      resolved_by,
      handled_by,
      issue_type,
      issue_sub_type,
      comments
    } = req.body;

    console.log("CLOSE REQUEST:", req.body);

    // ✅ 1. UPDATE TICKET
    await db.query(
      `
      UPDATE tickets
      SET 
        status = 'Closed',
        type_of_ticket = ?,
        subtype_of_ticket = ?,
        updated_at = NOW()
      WHERE ticket_id = ?
      `,
      [issue_type, issue_sub_type, ticketId]
    );

    // ✅ 2. INSERT ACTION
    await db.query(
      `
      INSERT INTO ticket_actions
      (
        ticket_id,
        action_type,
        action_by,
        comments,
        created_at
      )
      VALUES (?, ?, ?, ?, NOW())
      `,
      [
        ticketId,
        action_type, // "Closed"
        req.user?.emp_id || null,
        `
Resolved By: ${resolved_by}
Handled By: ${handled_by}
${comments}
        `
      ]
    );

    res.json({ message: "Ticket Closed Successfully" });

  } catch (err) {
    console.error("CLOSE ERROR:", err);
    res.status(500).json({ message: "Close failed" });
  }
};