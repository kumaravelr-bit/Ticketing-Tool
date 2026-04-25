const db = require("../config/db");
const {
  canRaiseUniformRequest,
  canUseRequestBranch,
} = require("../middleware/access");
const normalizeValue = (value = "") => String(value).trim().toUpperCase();
const LOW_TECH_UNIFORM_DESIG = new Set([
  "TRAINEE TECHNICAL",
  "JR EXECUTIVE TECHNICAL",
  "EXECUTIVE TECHNICAL",
  "SR EXECUTIVE TECHNICAL",
]);
const BRANCH_TECH_DESIG = new Set(["ASST BRANCH INCHARGE", "BRANCH INCHARGE"]);
const ZONE_TECH_DESIG = new Set(["ASST TECH LEAD", "TECH LEAD"]);
const LOW_SALES_UNIFORM_DESIG = new Set(["BDO", "BDE", "BDM"]);
const DIRECT_CMO_SALES_DESIG = new Set([
  "MIS",
  "MIS EXECUTIVE",
  "VENDOR SALES",
  "VENDOR COORDINATOR",
  "SERVICE SUPPORT",
  "SALES SUPPORT",
]);
const HO_MANAGER_DESIG = new Set(["ASST MANAGER", "MANAGER"]);
const HO_DEPARTMENTS = new Set([
  "ACCOUNTS", "IT", "HRD", "CUSTOMER CARE", "STORE",
  "DESIGNER", "NOC", "TECH & OPS", "SERVICE VENDOR", "RETENSION",
  "PURCHASE", "VAS", "ONM", "PROJECT", "MARKETING", "OPERATIONS",
  "SUPPORT", "ADMIN", "COLLECTION", "PROCUREMENT",
  "FEASIBILITY", "QUALITY", "TRAINING", "COMPLIANCE", "FINANCE",
]);

const getViewerProfile = (user = {}) => ({
  role: normalizeValue(user.role),
  team: normalizeValue(user.team_name || user.team),
  designation: normalizeValue(user.designation_name || user.designation),
  empId: String(user.emp_id || ""),
  branchId: Number(user.branch_id) || null,
  zoneId: Number(user.zone_id) || null,
  branchIds: [...new Set([Number(user.branch_id) || null, ...((user.crm_branch_ids || []).map(Number))].filter(Boolean))],
  zoneIds: [...new Set([Number(user.zone_id) || null, ...((user.crm_zone_ids || []).map(Number))].filter(Boolean))],
});

const getRequestOwnerProfile = (row = {}) => ({
  empId: String(row.employee_id || ""),
  team: normalizeValue(row.requester_team_name || row.department),
  designation: normalizeValue(row.requester_designation_name || row.designation),
  branchId: Number(row.requester_branch_id || row.branch_id) || null,
  zoneId: Number(row.requester_zone_id || row.zone_id) || null,
});

const isSamePrimaryBranch = (viewer, requester) =>
  Boolean(viewer.branchId && requester.branchId && viewer.branchId === requester.branchId);

const isWithinScopedZone = (viewer, requester) =>
  Boolean(
    (requester.branchId && viewer.branchIds.includes(requester.branchId)) ||
    (requester.zoneId && viewer.zoneIds.includes(requester.zoneId))
  );

const canViewUniformByHierarchy = (user, row) => {
  const viewer = getViewerProfile(user);
  const requester = getRequestOwnerProfile(row);

  if (["SUPER_ADMIN", "ADMIN"].includes(viewer.role)) return true;
  if (viewer.team === "HRD") return true;
  if (["MD", "CEO"].includes(viewer.designation)) return true;
  if (viewer.empId && requester.empId && viewer.empId === requester.empId) return true;

  if (requester.team === "TECHNICAL") {
    if (viewer.designation === "CTO") return true;

    if (LOW_TECH_UNIFORM_DESIG.has(requester.designation)) {
      if (BRANCH_TECH_DESIG.has(viewer.designation)) return isSamePrimaryBranch(viewer, requester);
      if (ZONE_TECH_DESIG.has(viewer.designation)) return isWithinScopedZone(viewer, requester);
      return false;
    }

    if (requester.designation === "ASST BRANCH INCHARGE") {
      if (viewer.designation === "BRANCH INCHARGE") return isSamePrimaryBranch(viewer, requester);
      if (ZONE_TECH_DESIG.has(viewer.designation)) return isWithinScopedZone(viewer, requester);
      return false;
    }

    if (requester.designation === "BRANCH INCHARGE") {
      if (ZONE_TECH_DESIG.has(viewer.designation)) return isWithinScopedZone(viewer, requester);
      return false;
    }

    if (requester.designation === "ASST TECH LEAD") {
      return viewer.designation === "TECH LEAD" && isWithinScopedZone(viewer, requester);
    }

    if (requester.designation === "TECH LEAD") {
      return viewer.designation === "TECH LEAD" && isWithinScopedZone(viewer, requester);
    }

    if (requester.designation === "CTO") {
      return ["CEO", "MD"].includes(viewer.designation);
    }

    return false;
  }

  if (requester.team === "SALES") {
    if (viewer.designation === "CMO" || viewer.designation === "SALES HEAD") return true;

    if (LOW_SALES_UNIFORM_DESIG.has(requester.designation)) {
      if (viewer.designation === "ASM") return isWithinScopedZone(viewer, requester);
      return false;
    }

    if (requester.designation === "ASM") {
      return viewer.designation === "CMO" || viewer.designation === "SALES HEAD";
    }

    if (DIRECT_CMO_SALES_DESIG.has(requester.designation)) {
      return viewer.designation === "CMO" || viewer.designation === "SALES HEAD";
    }

    if (requester.designation === "CMO" || requester.designation === "SALES HEAD") {
      return ["CEO", "MD"].includes(viewer.designation);
    }

    return false;
  }

  if (HO_DEPARTMENTS.has(requester.team)) {
    if (viewer.designation === "CTO") return true;

    const requesterIsLow = !HO_MANAGER_DESIG.has(requester.designation);
    if (requesterIsLow) {
      if (viewer.team === requester.team && HO_MANAGER_DESIG.has(viewer.designation)) return true;
      return false;
    }

    if (requester.designation === "ASST MANAGER") {
      return viewer.team === requester.team && viewer.designation === "MANAGER";
    }

    if (requester.designation === "MANAGER") {
      return ["CTO", "CEO", "MD"].includes(viewer.designation);
    }
  }

  return false;
};

const canReviewUniformByHierarchy = (user, row) => {
  const viewer = getViewerProfile(user);
  if (["SUPER_ADMIN", "ADMIN"].includes(viewer.role)) return true;
  return viewer.team === "HRD";
};

const applyUniformQueryFilters = (rows, query = {}) => {
  const search = String(query.search || "").trim().toLowerCase();
  const zoneId = String(query.zone_id || "").trim();
  const branchId = String(query.branch_id || "").trim();
  const requestType = String(query.request_type || "").trim().toUpperCase();
  const status = String(query.status || "").trim().toUpperCase();

  return rows.filter((row) => {
    if (zoneId && String(row.zone_id) !== zoneId) return false;
    if (branchId && String(row.branch_id) !== branchId) return false;
    if (requestType && String(row.request_type || "").trim().toUpperCase() !== requestType) return false;
    if (status && String(row.status || "PENDING").trim().toUpperCase() !== status) return false;

    if (search) {
      const haystack = [
        row.request_code,
        row.employee_id,
        row.employee_name,
        row.request_type,
        row.branch_name,
        row.zone_name,
        row.designation,
        row.department,
        row.status,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
};

const REQUEST_PREFIX = {
  UNIFORM:       "UNIF",
  BUSINESS_CARD: "BSCARD",
  ID_CARD:       "ID",
};

exports.healthCheck = async (_req, res) => res.json({ message: "Uniform API working" });

/* ─── Request code generator (locked per branch+type) ─── */
const generateRequestCode = async (connection, requestType, branchId) => {
  const prefix = REQUEST_PREFIX[requestType];
  if (!prefix) throw new Error("Invalid request type");

  const lockName = `request_entries:${requestType}:${branchId}`;
  let lockAcquired = false;
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK(?, 10) AS s", [lockName]);
    if (Number(lock?.s) !== 1) throw new Error("Unable to generate request code. Retry.");
    lockAcquired = true;

    const [[branchRow]] = await connection.query(
      "SELECT short_name FROM branches WHERE id=? LIMIT 1", [branchId]
    );
    const short = String(branchRow?.short_name || "").trim().toUpperCase();
    if (!short) throw new Error("Branch short name required for request code");

    const [[seq]] = await connection.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(request_code,'-',-1) AS UNSIGNED)),0) AS last
       FROM request_entries WHERE request_type=? AND branch_id=?`,
      [requestType, branchId]
    );
    return `${prefix}-${short}-${Number(seq?.last || 0) + 1}`;
  } finally {
    if (lockAcquired) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
  }
};

/* ─── Visibility WHERE clause builder ───────────────────────────────────
   Uses getUniformVisibilityScope() from centralized access.js.
   Branch Incharge: scope.branchIds = [primary_branch_id] + crm_branch_ids.
   Namakkal BI only sees Namakkal. No other branches.
─────────────────────────────────────────────────────────────────────── */
const buildVisibilityWhere = (user, params = []) => {
  const scope = getUniformVisibilityScope(user);

  if (scope.fullAccess) return "";

  const clauses = [];

  /* Always include own requests */
  clauses.push("r.employee_id = ?");
  params.push(user.emp_id);

  if (!scope.selfOnly) {
    if (Array.isArray(scope.branchIds) && scope.branchIds.length) {
      clauses.push(`r.branch_id IN (${scope.branchIds.map(() => "?").join(",")})`);
      params.push(...scope.branchIds);
    }
    if (Array.isArray(scope.zoneIds) && scope.zoneIds.length) {
      clauses.push(`r.zone_id IN (${scope.zoneIds.map(() => "?").join(",")})`);
      params.push(...scope.zoneIds);
    }
    if (Array.isArray(scope.teamNames) && scope.teamNames.length) {
      const names = [...new Set(scope.teamNames.map(normalizeValue))];
      clauses.push(`UPPER(TRIM(COALESCE(r.department,''))) IN (${names.map(() => "?").join(",")})`);
      params.push(...names);
    }
  }

  return clauses.length ? `(${clauses.join(" OR ")})` : "1=0";
};

/* ─── Filter builder ─── */
const buildRequestFilters = (query = {}, user) => {
  const clauses = [];
  const params  = [];
  const { zone_id, branch_id, request_type, status, search } = query;

  const visClause = buildVisibilityWhere(user, params);
  if (visClause) clauses.push(visClause);

  if (zone_id)      { clauses.push("r.zone_id=?");      params.push(Number(zone_id));   }
  if (branch_id)    { clauses.push("r.branch_id=?");    params.push(Number(branch_id)); }
  if (request_type) { clauses.push("r.request_type=?"); params.push(request_type);      }
  if (status)       { clauses.push("r.status=?");       params.push(status);            }

  if (search) {
    clauses.push(`(r.request_code LIKE ? OR r.employee_id LIKE ? OR r.employee_name LIKE ?
                   OR r.request_type LIKE ? OR b.branch_name LIKE ? OR z.zone_name LIKE ?
                   OR COALESCE(r.designation,'') LIKE ? OR COALESCE(r.department,'') LIKE ?
                   OR COALESCE(r.status,'PENDING') LIKE ?)`);
    const q = `%${String(search).trim()}%`;
    params.push(q, q, q, q, q, q, q, q, q);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
};

/* ─── Common SELECT fields ─── */
const SELECT_FIELDS = `
  r.id, r.request_code, r.request_type,
  r.zone_id, z.zone_name,
  r.branch_id, b.branch_name,
  r.employee_id, r.employee_name,
  r.designation, r.department, r.mobile_no,
  r.shirt_size, r.pant_size, r.tshirt_size, r.blazer_size, r.shoe_size,
  r.quantity, r.remarks,
  r.review_comment, r.reviewed_by_role, r.reviewed_by_name, r.reviewed_at,
  r.status, r.created_at
`;
const SELECT_FIELDS_WITH_REQUESTER = `
  ${SELECT_FIELDS},
  req.branch_id AS requester_branch_id,
  req.zone_id AS requester_zone_id,
  req_team.team_name AS requester_team_name,
  req_des.designation_name AS requester_designation_name
`;

/* ══════════════════════════════════════════════════════════════
   LIST
══════════════════════════════════════════════════════════════ */
exports.getRequests = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${SELECT_FIELDS_WITH_REQUESTER}
       FROM request_entries r
       INNER JOIN zones z ON z.id = r.zone_id
       INNER JOIN branches b ON b.id = r.branch_id
       LEFT JOIN employees req ON req.emp_id = r.employee_id
       LEFT JOIN teams req_team ON req_team.id = req.team_id
       LEFT JOIN designations req_des ON req_des.id = req.designation_id
       ORDER BY r.id DESC`
    );
    const visibleRows = applyUniformQueryFilters(
      rows.filter((row) => canViewUniformByHierarchy(req.user, row)),
      req.query
    ).map((row) => ({
      ...row,
      can_review: canReviewUniformByHierarchy(req.user, row) && String(row.status || "PENDING").trim().toUpperCase() === "PENDING",
    }));
    return res.json(visibleRows);
  } catch (err) {
    console.error("getRequests error:", err);
    return res.status(500).json({ message: "Failed to fetch requests" });
  }
};

/* ══════════════════════════════════════════════════════════════
   EXPORT (streams CSV)
══════════════════════════════════════════════════════════════ */
exports.exportRequests = async (req, res) => {
  try {
    const exportColumns = [
      "Request Code", "Request Type", "Zone", "Branch",
      "Employee ID", "Employee Name", "Designation", "Department", "Mobile No",
      "Shirt Size", "Pant Size", "T-Shirt Size", "Blazer Size", "Shoe Size",
      "Quantity", "Remarks", "Status", "Review Comment",
      "Reviewed By Name", "Reviewed At", "Created At",
    ];

    const [rows] = await db.query(
      `SELECT
        r.request_code     AS "Request Code",  r.request_type     AS "Request Type",
        z.zone_name        AS "Zone",           b.branch_name      AS "Branch",
        r.employee_id      AS "Employee ID",    r.employee_name    AS "Employee Name",
        r.designation      AS "Designation",    r.department       AS "Department",
        r.mobile_no        AS "Mobile No",      r.shirt_size       AS "Shirt Size",
        r.pant_size        AS "Pant Size",      r.tshirt_size      AS "T-Shirt Size",
        r.blazer_size      AS "Blazer Size",    r.shoe_size        AS "Shoe Size",
        r.quantity         AS "Quantity",       r.remarks          AS "Remarks",
        r.status           AS "Status",         r.review_comment   AS "Review Comment",
        r.reviewed_by_name AS "Reviewed By Name",
        DATE_FORMAT(r.reviewed_at,'%d-%m-%Y %h:%i %p') AS "Reviewed At",
        DATE_FORMAT(r.created_at,'%d-%m-%Y %h:%i %p')  AS "Created At",
        req.branch_id AS requester_branch_id,
        req.zone_id AS requester_zone_id,
        req_team.team_name AS requester_team_name,
        req_des.designation_name AS requester_designation_name
       FROM request_entries r
       INNER JOIN zones z ON z.id = r.zone_id
       INNER JOIN branches b ON b.id = r.branch_id
       LEFT JOIN employees req ON req.emp_id = r.employee_id
       LEFT JOIN teams req_team ON req_team.id = req.team_id
       LEFT JOIN designations req_des ON req_des.id = req.designation_id
       ORDER BY r.id DESC`
    );
    const visibleRows = applyUniformQueryFilters(
      rows.filter((row) => canViewUniformByHierarchy(req.user, row)),
      req.query
    );

    if (!visibleRows.length) return res.status(404).json({ message: "No records found for export" });

    const esc      = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const fileName = `uniform-requests-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type",        "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control",       "no-store");
    res.write("\uFEFF");
    res.write(`${exportColumns.map(esc).join(",")}\n`);
    for (const row of visibleRows) {
      res.write(`${exportColumns.map(col => esc(row[col])).join(",")}\n`);
    }
    return res.end();
  } catch (err) {
    console.error("exportRequests error:", err);
    return res.status(500).json({ message: "Failed to export requests" });
  }
};

/* ══════════════════════════════════════════════════════════════
   DETAIL BY ID
══════════════════════════════════════════════════════════════ */
exports.getRequestById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${SELECT_FIELDS_WITH_REQUESTER}
       FROM request_entries r
       INNER JOIN zones z ON z.id = r.zone_id
       INNER JOIN branches b ON b.id = r.branch_id
       LEFT JOIN employees req ON req.emp_id = r.employee_id
       LEFT JOIN teams req_team ON req_team.id = req.team_id
       LEFT JOIN designations req_des ON req_des.id = req.designation_id
       WHERE r.id=? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Request not found" });

    if (!canViewUniformByHierarchy(req.user, rows[0])) {
      return res.status(403).json({ message: "You are not allowed to view this request" });
    }

    return res.json({
      ...rows[0],
      can_review: canReviewUniformByHierarchy(req.user, rows[0]) && String(rows[0].status || "PENDING").trim().toUpperCase() === "PENDING",
    });
  } catch (err) {
    console.error("getRequestById error:", err);
    return res.status(500).json({ message: "Failed to fetch request details" });
  }
};

/* ══════════════════════════════════════════════════════════════
   CREATE REQUEST
══════════════════════════════════════════════════════════════ */
exports.createRequest = async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    if (!canRaiseUniformRequest(req.user)) {
      await conn.rollback();
      return res.status(403).json({ message: "Not authorized to raise requests" });
    }

    const {
      request_type, zone_id, branch_id,
      employee_id, employee_name, designation, department, mobile_no,
      shirt_size, pant_size, tshirt_size, blazer_size, shoe_size,
      quantity, remarks,
    } = req.body;

    const allowedTypes = ["UNIFORM", "BUSINESS_CARD", "ID_CARD"];
    if (!request_type || !allowedTypes.includes(request_type)) {
      await conn.rollback();
      return res.status(400).json({ message: "Valid request_type is required" });
    }
    if (!zone_id)       { await conn.rollback(); return res.status(400).json({ message: "zone_id is required" }); }
    if (!branch_id)     { await conn.rollback(); return res.status(400).json({ message: "branch_id is required" }); }
    if (!employee_id)   { await conn.rollback(); return res.status(400).json({ message: "employee_id is required" }); }
    if (!employee_name) { await conn.rollback(); return res.status(400).json({ message: "employee_name is required" }); }

    if (!canUseRequestBranch(req.user, branch_id)) {
      await conn.rollback();
      return res.status(403).json({ message: "You do not have access to raise a request for this branch" });
    }

    if (request_type === "UNIFORM") {
      if (!shirt_size) { await conn.rollback(); return res.status(400).json({ message: "shirt_size is required" }); }
      if (!pant_size)  { await conn.rollback(); return res.status(400).json({ message: "pant_size is required" }); }
    }

    const finalQty = Number(quantity || 1);
    if (isNaN(finalQty) || finalQty < 1) {
      await conn.rollback();
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const numBranchId = Number(branch_id);
    const numZoneId   = Number(zone_id);
    const requestCode = await generateRequestCode(conn, request_type, numBranchId);

    const [result] = await conn.query(
      `INSERT INTO request_entries (
        request_code, request_type, zone_id, branch_id,
        employee_id, employee_name, designation, department, mobile_no,
        shirt_size, pant_size, tshirt_size, blazer_size, shoe_size,
        quantity, remarks, status
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        requestCode, request_type, numZoneId, numBranchId,
        employee_id, employee_name, designation || null, department || null, mobile_no || null,
        request_type === "UNIFORM" ? shirt_size  || null : null,
        request_type === "UNIFORM" ? pant_size   || null : null,
        request_type === "UNIFORM" ? tshirt_size || null : null,
        request_type === "UNIFORM" ? blazer_size || null : null,
        request_type === "UNIFORM" ? shoe_size   || null : null,
        finalQty, remarks || null, "PENDING",
      ]
    );

    await conn.commit();
    return res.status(201).json({
      message:      "Request saved successfully",
      id:           result.insertId,
      request_code: requestCode,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("createRequest error:", err);
    return res.status(500).json({ message: "Failed to save request" });
  } finally {
    if (conn) conn.release();
  }
};

/* ══════════════════════════════════════════════════════════════
   REVIEW (approve / reject)
══════════════════════════════════════════════════════════════ */
exports.reviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_comment, reviewed_by_name } = req.body;
    const userRole = String(req.user?.role || "").trim().toUpperCase();

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const [existing] = await db.query(
      `SELECT id, zone_id, branch_id, employee_id, employee_name, department, status
       FROM request_entries WHERE id=? LIMIT 1`,
      [id]
    );
    if (!existing.length) return res.status(404).json({ message: "Request not found" });

    const request = existing[0];

    if (!canReviewUniformByHierarchy(req.user, request)) {
      return res.status(403).json({ message: "You are not allowed to review this request" });
    }

    const currentStatus = String(request.status || "PENDING").trim().toUpperCase();
    if (["APPROVED", "REJECTED"].includes(currentStatus)) {
      return res.status(400).json({ message: "Request already reviewed" });
    }

    await db.query(
      `UPDATE request_entries
       SET status=?, review_comment=?, reviewed_by_role=?, reviewed_by_name=?, reviewed_at=NOW()
       WHERE id=?`,
      [status, review_comment || null, userRole, reviewed_by_name || req.user?.emp_id || null, id]
    );

    return res.json({ message: `Request ${status.toLowerCase()} successfully` });
  } catch (err) {
    console.error("reviewRequest error:", err);
    return res.status(500).json({ message: "Failed to update review" });
  }
};
