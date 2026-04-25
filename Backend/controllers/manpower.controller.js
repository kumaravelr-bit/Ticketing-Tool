const db = require("../config/db");
const {
  canRaiseManpowerRequest,
  getManpowerVisibilityScope,
  canApproveStage,
  canAccessRecord,
  canUseRequestBranch,
} = require("../middleware/access");

/* ── alias for stage check ── */
const canApproveManpowerStage = canApproveStage;
const canViewOwnOrScopedRequest = canAccessRecord;

const normalizeValue = (value = "") => String(value).trim().toUpperCase();
const HO_DEPARTMENTS = new Set([
  "ACCOUNTS", "IT", "HRD", "CUSTOMER CARE", "STORE",
  "DESIGNER", "NOC", "TECH & OPS", "SERVICE VENDOR", "RETENSION",
  "PURCHASE", "VAS", "ONM", "PROJECT", "MARKETING", "OPERATIONS",
  "SUPPORT", "ADMIN", "COLLECTION", "PROCUREMENT",
  "FEASIBILITY", "QUALITY", "TRAINING", "COMPLIANCE", "FINANCE",
]);
const TECH_RANK = {
  "ASST BRANCH INCHARGE": 1,
  "BRANCH INCHARGE": 2,
  "ASST TECH LEAD": 3,
  "TECH LEAD": 4,
  "CTO": 5,
};
const HO_RANK = {
  "ASST MANAGER": 1,
  "MANAGER": 2,
};
const SALES_RANK = {
  "MIS": 1,
  "MIS EXECUTIVE": 1,
  "VENDOR COORDINATOR": 1,
  "VENDOR SALES": 1,
  "SERVICE SUPPORT": 1,
  "ASM": 2,
  "CMO": 3,
  "SALES HEAD": 3,
};

const getUserOrgProfile = (user = {}) => ({
  role: normalizeValue(user.role),
  team: normalizeValue(user.team_name || user.team),
  designation: normalizeValue(user.designation_name || user.designation),
  empId: String(user.emp_id || ""),
  branchId: Number(user.branch_id) || null,
  zoneId: Number(user.zone_id) || null,
  branchIds: [...new Set([Number(user.branch_id) || null, ...((user.crm_branch_ids || []).map(Number))].filter(Boolean))],
  zoneIds: [...new Set([Number(user.zone_id) || null, ...((user.crm_zone_ids || []).map(Number))].filter(Boolean))],
});

const getRequesterProfile = (row = {}) => ({
  empId: String(row.requester_emp_id || ""),
  team: normalizeValue(row.requester_team_name || row.requester_team || row.department),
  designation: normalizeValue(row.requester_designation_name || row.requester_designation),
  branchId: Number(row.requester_branch_id || row.branch_id) || null,
  zoneId: Number(row.requester_zone_id || row.zone_id) || null,
});

const isWithinViewerScope = (viewer, requester, mode) => {
  if (mode === "branch") {
    return viewer.branchId && requester.branchId && viewer.branchId === requester.branchId;
  }
  return (
    (requester.branchId && viewer.branchIds.includes(requester.branchId)) ||
    (requester.zoneId && viewer.zoneIds.includes(requester.zoneId))
  );
};

const canViewManpowerRequestByHierarchy = (user, row) => {
  const viewer = getUserOrgProfile(user);
  const requester = getRequesterProfile(row);

  if (["SUPER_ADMIN", "ADMIN"].includes(viewer.role)) return true;
  if (["MD", "CEO"].includes(viewer.designation) || viewer.team === "HRD") return true;
  if (viewer.empId && requester.empId && viewer.empId === requester.empId) return true;

  if (requester.team === "TECHNICAL") {
    const requesterRank = TECH_RANK[requester.designation] || 0;

    if (viewer.designation === "CTO") return true;

    const viewerRank = TECH_RANK[viewer.designation] || 0;
    if (!viewerRank || !requesterRank || requesterRank > viewerRank) return false;

    const scopeMode = viewerRank <= 2 ? "branch" : "zone";
    return isWithinViewerScope(viewer, requester, scopeMode);
  }

  if (HO_DEPARTMENTS.has(requester.team)) {
    const requesterRank = HO_RANK[requester.designation] || 0;

    if (viewer.designation === "CTO") return requesterRank > 0;

    const viewerRank = HO_RANK[viewer.designation] || 0;
    if (!viewerRank || !requesterRank || requester.team !== viewer.team || requesterRank > viewerRank) return false;
    return true;
  }

  if (requester.team === "SALES") {
    const requesterRank = SALES_RANK[requester.designation] || 0;

    if (["CMO", "SALES HEAD"].includes(viewer.designation)) return requesterRank > 0;
    if (viewer.designation === "CEO") {
      return ["CMO", "SALES HEAD", "CTO"].includes(requester.designation);
    }

    const viewerRank = SALES_RANK[viewer.designation] || 0;
    if (!viewerRank || !requesterRank || requesterRank > viewerRank) return false;

    if (viewer.designation === "ASM") {
      return isWithinViewerScope(viewer, requester, "zone");
    }

    return viewer.empId === requester.empId;
  }

  if (viewer.designation === "CEO") {
    return ["CTO", "CMO", "SALES HEAD"].includes(requester.designation);
  }

  return false;
};

const requestSelectSql = `
  SELECT mr.*,
         req.team_id AS requester_team_id,
         req.designation_id AS requester_designation_id,
         req.branch_id AS requester_branch_id,
         req.zone_id AS requester_zone_id,
         req_team.team_name AS requester_team_name,
         req_des.designation_name AS requester_designation_name
  FROM manpower_requests mr
  LEFT JOIN employees req ON req.emp_id = mr.requester_emp_id
  LEFT JOIN teams req_team ON req_team.id = req.team_id
  LEFT JOIN designations req_des ON req_des.id = req.designation_id
`;

/* ─── Schema cache ─── */
let manpowerColumnsCache = null;

const getManpowerColumns = async (connection = db) => {
  if (manpowerColumnsCache) return manpowerColumnsCache;
  const [rows] = await connection.query("SHOW COLUMNS FROM manpower_requests");
  manpowerColumnsCache = new Set(rows.map(r => r.Field));
  return manpowerColumnsCache;
};

const pickExistingColumns = async (payload, connection = db) => {
  const columns = await getManpowerColumns(connection);
  return Object.entries(payload).filter(([key, value]) => columns.has(key) && value !== undefined);
};

/* ─── Lookup helpers ─── */
const findIdByName = async (table, idColumn, nameColumn, value) => {
  if (!value) return null;
  const [[row]] = await db.query(
    `SELECT ${idColumn} AS id FROM ${table} WHERE UPPER(TRIM(${nameColumn})) = ? LIMIT 1`,
    [normalizeValue(value)]
  );
  return row?.id ?? null;
};

const hydrateRequestIds = async (request) => {
  if (!request.zone_id)
    request.zone_id = await findIdByName("zones", "id", "zone_name", request.zone);
  if (!request.branch_id)
    request.branch_id = await findIdByName("branches", "id", "branch_name", request.branch);
  if (!request.team_id)
    request.team_id = await findIdByName("teams", "id", "team_name", request.department);
  if (!request.designation_id)
    request.designation_id = await findIdByName("designations", "id", "designation_name", request.designation);
  if (!request.reporting_manager && request.manager_emp_id) {
    request.reporting_manager = request.manager_emp_id;
  }
  return request;
};

/* ══════════════════════════════════════════════════════════════════
   VISIBILITY CLAUSE BUILDER
   Uses getManpowerVisibilityScope() from centralized access.js.

   The manpower_requests table stores zone/branch/department as TEXT,
   so we look up names from IDs before filtering.
══════════════════════════════════════════════════════════════════ */
const getVisibilityClause = async (user, params) => {
  const scope = getManpowerVisibilityScope(user);

  if (scope.fullAccess) return "";

  if (scope.selfOnly) {
    params.push(user.emp_id);
    return "mr.requester_emp_id = ?";
  }

  const parts = [];

  /* Always include own requests */
  parts.push("mr.requester_emp_id = ?");
  params.push(user.emp_id);

  /* Department filter */
  if (scope.departmentNames?.length) {
    const normalised = scope.departmentNames.map(normalizeValue);
    parts.push(`UPPER(TRIM(mr.department)) IN (${normalised.map(() => "?").join(",")})`);
    params.push(...normalised);
  }

  /* Zone filter → look up names */
  if (scope.zoneIds?.length) {
    const ids = scope.zoneIds.map(Number).filter(Boolean);
    if (ids.length) {
      const [zRows] = await db.query(
        `SELECT zone_name FROM zones WHERE id IN (${ids.map(() => "?").join(",")})`, ids
      );
      const names = zRows.map(r => normalizeValue(r.zone_name));
      if (names.length) {
        parts.push(`UPPER(TRIM(mr.zone)) IN (${names.map(() => "?").join(",")})`);
        params.push(...names);
      }
    }
  }

  /* Branch filter → look up names.
     CRITICAL: For Branch Incharge, scope.branchIds = [primary_branch_id] + crm_branch_ids.
     Namakkal BI (branch_id=4) only sees Namakkal unless they have explicit CRM grants. */
  if (scope.branchIds?.length) {
    const ids = scope.branchIds.map(Number).filter(Boolean);
    if (ids.length) {
      const [bRows] = await db.query(
        `SELECT branch_name FROM branches WHERE id IN (${ids.map(() => "?").join(",")})`, ids
      );
      const names = bRows.map(r => normalizeValue(r.branch_name));
      if (names.length) {
        parts.push(`UPPER(TRIM(mr.branch)) IN (${names.map(() => "?").join(",")})`);
        params.push(...names);
      }
    }
  }

  return parts.length ? `(${parts.join(" OR ")})` : "1=0";
};

const getPaginationOptions = (query = {}, defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), maxLimit);
  const offset = (page - 1) * limit;
  const paginate = "page" in query || "limit" in query;
  return { page, limit, offset, paginate };
};

const buildListClauses = ({ search = "", status = "", department = "", zone = "", branch = "" }, params) => {
  const clauses = [];

  if (search) {
    clauses.push(
      "(mr.request_number LIKE ? OR mr.employee_emp_id LIKE ? OR mr.employee_name LIKE ? OR mr.designation LIKE ?)"
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (zone) {
    clauses.push("mr.zone = ?");
    params.push(zone);
  }

  if (branch) {
    clauses.push("mr.branch = ?");
    params.push(branch);
  }

  if (department) {
    clauses.push("mr.department = ?");
    params.push(department);
  }

  if (status) {
    clauses.push("mr.final_status = ?");
    params.push(status);
  }

  return clauses;
};

const buildManpowerWhereSql = async (user, query, params) => {
  const clauses = buildListClauses(query, params);
  const visibilityClause = await getVisibilityClause(user, params);

  if (visibilityClause) {
    clauses.push(visibilityClause);
  }

  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
};

/* ══════════════════════════════════════════════════════════════════
   ALLOWED ACTIONS  (which approval buttons show on detail page)
══════════════════════════════════════════════════════════════════ */
const canOperateManpowerStage = (user, request, stage) =>
  canApproveManpowerStage(user, { ...request, final_status: "Submitted" }, stage);

const getAllowedActions = async (user, request) => ({
  manager:
    canOperateManpowerStage(user, request, "manager") &&
    request.manager_status === "Pending",
  hr:
    canOperateManpowerStage(user, request, "hr") &&
    request.manager_status === "Approved" &&
    request.hr_status === "Pending",
  cto:
    canOperateManpowerStage(user, request, "cto") &&
    request.hr_status === "Approved" &&
    request.cto_status === "Pending",
});

const getEditableActions = async (user, request) => ({
  manager:
    canOperateManpowerStage(user, request, "manager") &&
    ["Approved", "Rejected"].includes(String(request.manager_status || "").trim()),
  hr:
    canOperateManpowerStage(user, request, "hr") &&
    request.manager_status === "Approved" &&
    ["Approved", "Rejected"].includes(String(request.hr_status || "").trim()),
  cto:
    canOperateManpowerStage(user, request, "cto") &&
    request.hr_status === "Approved" &&
    ["Approved", "Rejected"].includes(String(request.cto_status || "").trim()),
});

/* ══════════════════════════════════════════════════════════════════
   CREATE REQUEST
══════════════════════════════════════════════════════════════════ */
exports.createRequest = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const user = req.user;

    if (!canRaiseManpowerRequest(user)) {
      await conn.rollback();
      return res.status(403).json({ message: "Not authorized to raise manpower requests" });
    }

    const [[emp]] = await conn.query(
      "SELECT emp_id, name FROM employees WHERE emp_id = ?", [user.emp_id]
    );
    if (!emp) throw new Error("Employee not found");

    const {
      zone_id, branch_id, team_id, designation_id,
      request_type, reporting_manager, openings,
      experience_required, salary_range, key_skills,
      preferred_education, additional_skills,
      replaced_emp_id, replaced_emp_name,
      reason_for_requirement, priority_level, required_joining_date,
    } = req.body;

    if (!zone_id || !branch_id || !team_id || !designation_id) {
      await conn.rollback();
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!canUseRequestBranch(user, branch_id)) {
      await conn.rollback();
      return res.status(403).json({ message: "You do not have access to raise a request for this branch" });
    }

    const [[zone]]        = await conn.query("SELECT zone_name AS name FROM zones WHERE id=?", [zone_id]);
    const [[branch]]      = await conn.query("SELECT branch_name AS name FROM branches WHERE id=?", [branch_id]);
    const [[team]]        = await conn.query("SELECT team_name AS name FROM teams WHERE id=?", [team_id]);
    const [[designation]] = await conn.query("SELECT designation_name AS name FROM designations WHERE id=?", [designation_id]);

    if (!zone || !branch || !team || !designation) throw new Error("Invalid master data");

    const [[last]] = await conn.query("SELECT id FROM manpower_requests ORDER BY id DESC LIMIT 1");
    const nextId   = last ? last.id + 1 : 1;
    const request_number = `MR-${new Date().getFullYear()}-${String(nextId).padStart(4, "0")}`;

    const insertPayload = {
      request_number,
      employee_emp_id:          emp.emp_id,
      employee_name:            emp.name,
      zone:                     zone.name,
      branch:                   branch.name,
      department:               team.name,
      designation:              designation.name,
      request_type,
      requester_emp_id:         emp.emp_id,
      manager_emp_id:           reporting_manager || null,
      reporting_manager_emp_id: reporting_manager || null,
      openings:                 Number(openings || 1),
      experience_required:      experience_required || null,
      salary_range:             Number(salary_range || 0),
      priority_level:           priority_level || "Medium",
      key_skills:               key_skills || null,
      preferred_education:      preferred_education || null,
      additional_skills:        additional_skills || null,
      replaced_emp_id:          replaced_emp_id || null,
      replaced_emp_name:        replaced_emp_name || null,
      reason_for_requirement:   reason_for_requirement || null,
      required_joining_date:    required_joining_date || null,
      manager_status:           "Pending",
      hr_status:                "Pending",
      cto_status:               "Pending",
      final_status:             "Submitted",
    };

    const insertEntries = await pickExistingColumns(insertPayload, conn);
    const [result] = await conn.query(
      `INSERT INTO manpower_requests (${insertEntries.map(([k]) => k).join(",")})
       VALUES (${insertEntries.map(() => "?").join(",")})`,
      insertEntries.map(([, v]) => v)
    );

    await conn.query(
      `INSERT INTO manpower_logs (request_id, stage, action_taken, actor_emp_id, actor_name, comments)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [result.insertId, "Request Created", "Submitted", user.emp_id, user.name, "Manpower request created"]
    );

    await conn.commit();
    res.status(201).json({ message: "Request created successfully", request_id: result.insertId, request_number });
  } catch (err) {
    await conn.rollback();
    console.error("CREATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to create request" });
  } finally {
    conn.release();
  }
};

/* ══════════════════════════════════════════════════════════════════
   SUMMARY
══════════════════════════════════════════════════════════════════ */
exports.getSummary = async (req, res) => {
  try {
    const params = [];
    const visibilityClause = await getVisibilityClause(req.user, params);
    const whereSql = visibilityClause ? `WHERE ${visibilityClause}` : "";

    const [rows] = await db.query(
      `${requestSelectSql}
       ${whereSql}
       ORDER BY mr.id DESC`,
      params
    );

    const visibleRows = rows.filter((row) => canViewManpowerRequestByHierarchy(req.user, row));
    const count = (predicate) => visibleRows.filter(predicate).length;

    res.json({
      total:               visibleRows.length,
      pending_my_approval: count((row) => row.final_status === "Submitted"),
      approved_flow:       count((row) => String(row.final_status || "").includes("Approved")),
      rejected:            count((row) => String(row.final_status || "").includes("Rejected")),
      recruitment:         count((row) => ["Received", "In Progress"].includes(row.recruiter_status)),
      closed:              count((row) => row.recruiter_status === "Closed"),
    });
  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ message: "Failed to load summary" });
  }
};

/* ══════════════════════════════════════════════════════════════════
   LIST
══════════════════════════════════════════════════════════════════ */
exports.getRequests = async (req, res) => {
  try {
    const params = [];
    const whereSql = await buildManpowerWhereSql(req.user, req.query, params);
    const { page, limit, offset, paginate } = getPaginationOptions(req.query);

    const [rows] = await db.query(
      `${requestSelectSql}
       ${whereSql}
       ORDER BY mr.id DESC`,
      params
    );

    const visibleRows = rows
      .filter((row) => canViewManpowerRequestByHierarchy(req.user, row))
      .map((row) => ({
        id: row.id,
        request_number: row.request_number,
        employee_emp_id: row.employee_emp_id,
        employee_name: row.employee_name,
        zone: row.zone,
        branch: row.branch,
        department: row.department,
        designation: row.designation,
        final_status: row.final_status,
      }));

    if (!paginate) {
      return res.json(visibleRows);
    }

    const pagedRows = visibleRows.slice(offset, offset + limit);

    res.json({
      rows: pagedRows,
      meta: {
        page,
        limit,
        total: visibleRows.length,
        totalPages: Math.max(Math.ceil(visibleRows.length / limit), 1),
        hasNextPage: offset + pagedRows.length < visibleRows.length,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error("List Error:", err);
    res.status(500).json({ message: "Failed to load requests" });
  }
};

/* ══════════════════════════════════════════════════════════════════
   DETAIL
══════════════════════════════════════════════════════════════════ */
exports.getRequestById = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const [rows] = await db.query(
      `${requestSelectSql} WHERE mr.id = ? LIMIT 1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Request not found" });

    const request = await hydrateRequestIds(rows[0]);

    if (!canViewManpowerRequestByHierarchy(req.user, request)) {
      return res.status(403).json({ message: "You are not allowed to view this request" });
    }

    const [logs] = await db.query(
      "SELECT * FROM manpower_logs WHERE request_id = ? ORDER BY id DESC", [req.params.id]
    );

    let actions = { manager: false, hr: false, cto: false };
    let editActions = { manager: false, hr: false, cto: false };
    try {
      actions = await getAllowedActions(req.user, request);
      editActions = await getEditableActions(req.user, request);
    } catch {}

    res.json({ request, logs, actions, editActions });
  } catch (err) {
    console.error("Detail Error:", err);
    res.status(500).json({ message: err.message || "Failed to load request detail" });
  }
};

/* ══════════════════════════════════════════════════════════════════
   APPROVAL ACTION
══════════════════════════════════════════════════════════════════ */
exports.updateManpowerAction = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id, type } = req.params;
    const { action, comments } = req.body;
    const user = req.user;

    const normalizedAction = ["Approved", "Rejected"].includes(action) ? action : null;
    if (!normalizedAction) {
      await conn.rollback();
      return res.status(400).json({ message: "Invalid action" });
    }

    if (normalizedAction === "Rejected" && !String(comments || "").trim()) {
      await conn.rollback();
      return res.status(400).json({ message: "Comments required for rejection" });
    }

    const [[requestRow]] = await conn.query(`${requestSelectSql} WHERE mr.id=? LIMIT 1`, [id]);
    if (!requestRow) throw new Error("Request not found");

    const request = await hydrateRequestIds(requestRow);
    if (!canViewManpowerRequestByHierarchy(user, request)) {
      await conn.rollback();
      return res.status(403).json({ message: "You are not allowed to access this request" });
    }
    const allowed = await getAllowedActions(user, request);
    const editable = await getEditableActions(user, request);

    if (!allowed[type] && !editable[type]) {
      await conn.rollback();
      return res.status(403).json({ message: "Not allowed to perform this action" });
    }

    let stage = "";
    let finalStatus = request.final_status;
    const updates = {};
    const currentStageStatus = String(
      type === "manager"
        ? request.manager_status
        : type === "hr"
          ? request.hr_status
          : request.cto_status
    ).trim();

    if (currentStageStatus === normalizedAction) {
      await conn.rollback();
      return res.status(400).json({ message: `${type} stage is already ${normalizedAction}` });
    }

    if (type === "manager") {
      stage       = "Manager";
      finalStatus = normalizedAction === "Approved" ? "Manager Approved" : "Manager Rejected";
      updates.manager_status = normalizedAction;
      updates.hr_status = "Pending";
      updates.cto_status = "Pending";
      updates.final_status = finalStatus;
    }
    if (type === "hr") {
      stage       = "HRD";
      finalStatus = normalizedAction === "Approved" ? "HRD Approved" : "HRD Rejected";
      updates.hr_status = normalizedAction;
      updates.cto_status = "Pending";
      updates.final_status = finalStatus;
    }
    if (type === "cto") {
      stage       = "Management";
      finalStatus = normalizedAction === "Approved" ? "Management Approved" : "Management Rejected";
      updates.cto_status = normalizedAction;
      updates.final_status = finalStatus;
    }

    const updateEntries = await pickExistingColumns(updates, conn);
    if (!updateEntries.length) {
      await conn.rollback();
      return res.status(400).json({ message: "No valid stage update found" });
    }

    await conn.query(
      `UPDATE manpower_requests
       SET ${updateEntries.map(([key]) => `${key}=?`).join(",")}
       WHERE id=?`,
      [...updateEntries.map(([, value]) => value), id]
    );

    await conn.query(
      `INSERT INTO manpower_logs (request_id, stage, action_taken, actor_emp_id, actor_name, comments)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, stage, normalizedAction, user.emp_id, user.name, comments]
    );

    await conn.commit();
    res.json({ message: `${type} ${normalizedAction} successfully` });
  } catch (err) {
    await conn.rollback();
    console.error("UPDATE ACTION ERROR:", err);
    res.status(500).json({ message: err.sqlMessage || err.message || "Action failed" });
  } finally {
    conn.release();
  }
};

/* ══════════════════════════════════════════════════════════════════
   UPDATE REQUEST  (edit before approval starts)
══════════════════════════════════════════════════════════════════ */
exports.updateManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      zone_id, branch_id, team_id, designation_id,
      reporting_manager, openings, experience_required,
      salary_range, key_skills, priority_level, reason_for_requirement,
    } = req.body;

    const [[requestRow]] = await db.query(`${requestSelectSql} WHERE mr.id=? LIMIT 1`, [id]);
    if (!requestRow) return res.status(404).json({ message: "Request not found" });

    const request = await hydrateRequestIds(requestRow);

    if (!canViewManpowerRequestByHierarchy(req.user, request)) {
      return res.status(403).json({ message: "You are not allowed to edit this request" });
    }

    if (request.final_status !== "Submitted") {
      return res.status(400).json({ message: "Cannot edit after approval has started" });
    }

    if (branch_id && !canUseRequestBranch(req.user, branch_id)) {
      return res.status(403).json({ message: "You do not have access to this branch" });
    }

    let zoneName = null, branchName = null, teamName = null, designationName = null;
    if (zone_id) {
      const [[r]] = await db.query("SELECT zone_name AS name FROM zones WHERE id=?", [zone_id]);
      zoneName = r?.name || null;
    }
    if (branch_id) {
      const [[r]] = await db.query("SELECT branch_name AS name FROM branches WHERE id=?", [branch_id]);
      branchName = r?.name || null;
    }
    if (team_id) {
      const [[r]] = await db.query("SELECT team_name AS name FROM teams WHERE id=?", [team_id]);
      teamName = r?.name || null;
    }
    if (designation_id) {
      const [[r]] = await db.query("SELECT designation_name AS name FROM designations WHERE id=?", [designation_id]);
      designationName = r?.name || null;
    }

    const updatePayload = {
      zone_id:                  zone_id        || null,
      branch_id:                branch_id      || null,
      team_id:                  team_id        || null,
      designation_id:           designation_id || null,
      zone:                     zoneName,
      branch:                   branchName,
      department:               teamName,
      designation:              designationName,
      manager_emp_id:           reporting_manager || null,
      reporting_manager_emp_id: reporting_manager || null,
      reporting_manager:        reporting_manager || null,
      openings:                 Number(openings || 0),
      experience_required:      experience_required || null,
      salary_range:             Number(salary_range || 0),
      key_skills:               key_skills || null,
      priority_level:           priority_level || null,
      reason_for_requirement:   reason_for_requirement || null,
    };

    const updateEntries = await pickExistingColumns(updatePayload);
    if (!updateEntries.length) return res.status(400).json({ message: "No valid fields to update" });

    const values = [...updateEntries.map(([, v]) => v), id];
    await db.query(
      `UPDATE manpower_requests SET ${updateEntries.map(([k]) => `${k}=?`).join(",")} WHERE id=?`,
      values
    );

    res.json({ message: "Request updated successfully" });
  } catch (err) {
    console.error("UPDATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
};

