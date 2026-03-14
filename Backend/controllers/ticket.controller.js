const db = require("../config/db");

/* =============================
   GET TICKET TYPES
============================= */

exports.getTicketTypes = (req, res) => {

  const sql = `
    SELECT type_id, type_name
    FROM ticket_types
    ORDER BY type_name
  `;

  db.query(sql, (err, rows) => {

    if (err)
      return res.status(500).json({ message: "Failed to load ticket types" });

    res.json(rows);

  });

};


/* =============================
   CREATE TICKET
============================= */

exports.createTicket = (req, res) => {

  const data = req.body;
  if (!data.type_of_ticket) {
    return res.status(400).json({ message: "Ticket type required" });
  }

  if (!data.branch_id) {
    return res.status(400).json({ message: "Branch required" });
  }

  if (!data.assign_team) {
    return res.status(400).json({ message: "Team required" });
  }

  if (!data.assigned_to) {
    return res.status(400).json({ message: "Employee required" });
  }

  /* -------- GET BRANCH SHORT CODE -------- */

  const branchSql = `
    SELECT short_name
    FROM branches
    WHERE id = ?
  `;

  db.query(branchSql, [data.branch_id], (err, branchRows) => {
    if (err)
      return res.status(500).json({ message: "Branch lookup failed" });

    if (!branchRows.length)
      return res.status(404).json({ message: "Branch not found" });

    const branchShort = branchRows[0].short_name;

    const prefix = "ICE" + branchShort;

    /* -------- GET LAST TICKET -------- */

const lastSql = `
  SELECT ticket_id
  FROM tickets
  WHERE ticket_id LIKE ?
  ORDER BY ticket_id DESC
  LIMIT 1
`;

    db.query(lastSql, [`${prefix}%`], (err, lastRows) => {

      if (err)
        return res.status(500).json({ message: "Ticket lookup failed" });

      let number = 1;

      if (lastRows.length) {

        const lastId = lastRows[0].ticket_id;

        const lastNumber = parseInt(lastId.replace(prefix, "")) || 0;

        number = lastNumber + 1;

      }

      const ticketId = prefix + number.toString().padStart(4, "0");


      /* -------- INSERT TICKET -------- */

      const insertSql = `
        INSERT INTO tickets
        (
          ticket_id,
          type_of_ticket,
          priority,
          due_date,
          branch_id,
          assign_team,
          assigned_to,
          customer_name,
          reporter_name,
          landmark,
          address,
          contact_number1,
          contact_number2,
          more_details,
          status
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;

      const values = [
        ticketId,
        data.type_of_ticket,
        data.priority || "Low",
        data.due_date,
        data.branch_id,
        data.assign_team,
        data.assigned_to,
        data.customer_name,
        data.reporter_name,
        data.landmark,
        data.address,
        data.contact_number1,
        data.contact_number2,
        data.more_details,
        data.status || "Opened"
      ];

db.query(insertSql, values, (err, result) => {

  if (err) {

    console.error("Ticket insert error:", err.sqlMessage || err);
    return res.status(500).json({
      message: err.sqlMessage || "Ticket creation failed"
    });

  }
        res.json({
          message: "Ticket created successfully",
          ticket_id: ticketId
        });
      });
    });
  });
};

/* =============================
   SEARCH OPENED TICKETS
============================= */

exports.searchOpenedTickets = (req, res) => {

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

  db.query(countSql, params, (err, countRows) => {

    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Count failed" });
    }

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
  t.reporter_name,
  tm.team_name,
  e.name AS assigned_to,
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

    db.query(
      sql,
      [...params, limit, offset],
      (err, rows) => {

        if (err) {
          console.error(err);
          return res.status(500).json({
            message: "Failed to fetch tickets"
          });
        }

        res.json({
          tickets: rows,
          totalPages,
          total
        });

      }
    );

  });

};