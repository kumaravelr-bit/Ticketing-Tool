const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const RESOLVE_ACTION_TYPES = ["ISSUE RESOLVED", "ESCALATE", "CANNOT REPRODUCE"];
const RESOLVE_AND_UPDATE_ACTION_TYPES = [...RESOLVE_ACTION_TYPES, "UPDATED"];

let autoCloseSweepPromise = null;
let lastAutoCloseSweepAt = 0;

const normalizeActionType = (value) => String(value || "").trim().toUpperCase();

const autoCloseResolvedTickets = async () => {
  const now = Date.now();
  if (autoCloseSweepPromise) {
    return autoCloseSweepPromise;
  }
  if (now - lastAutoCloseSweepAt < 60000) {
    return;
  }

  autoCloseSweepPromise = (async () => {
    try {
      const resolvePlaceholders = RESOLVE_ACTION_TYPES.map(() => "?").join(",");
      const resetPlaceholders = RESOLVE_AND_UPDATE_ACTION_TYPES.map(() => "?").join(",");

      const [dueRows] = await db.query(
        `
        SELECT t.ticket_id
        FROM tickets t
        INNER JOIN (
          SELECT ra.ticket_id, MAX(a.created_at) AS last_activity_at
          FROM (
            SELECT ticket_id, MAX(created_at) AS last_resolve_at
            FROM ticket_actions
            WHERE UPPER(action_type) IN (${resolvePlaceholders})
            GROUP BY ticket_id
          ) ra
          INNER JOIN ticket_actions a
            ON a.ticket_id = ra.ticket_id
           AND a.created_at >= ra.last_resolve_at
           AND UPPER(a.action_type) IN (${resetPlaceholders})
          GROUP BY ra.ticket_id
        ) activity
          ON activity.ticket_id = t.ticket_id
        WHERE t.status <> 'Closed'
          AND activity.last_activity_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `,
        [...RESOLVE_ACTION_TYPES, ...RESOLVE_AND_UPDATE_ACTION_TYPES]
      );

      const ticketIds = dueRows.map((row) => row.ticket_id).filter(Boolean);
      if (!ticketIds.length) {
        lastAutoCloseSweepAt = Date.now();
        return;
      }

      const ticketPlaceholders = ticketIds.map(() => "?").join(",");

      await db.query(
        `UPDATE tickets
         SET status = 'Closed',
             updated_at = NOW()
         WHERE ticket_id IN (${ticketPlaceholders})`,
        ticketIds
      );

      const actionValues = ticketIds.map((ticketId) => [
        ticketId,
        "AUTO CLOSED",
        null,
        "Ticket auto-closed after 24 hours without any further resolve/update activity.",
        new Date()
      ]);

      await db.query(
        `INSERT INTO ticket_actions
         (ticket_id, action_type, action_by, comments, created_at)
         VALUES ?`,
        [actionValues]
      );

      lastAutoCloseSweepAt = Date.now();
    } catch (err) {
      console.error("AUTO CLOSE SWEEP ERROR:", err);
    } finally {
      autoCloseSweepPromise = null;
    }
  })();

  return autoCloseSweepPromise;
};

const getTicketLeadBranchIds = async (empId) => {
  if (!empId) return [];

  const [rows] = await db.query(
    `SELECT DISTINCT branch_id
     FROM employee_branches
     WHERE emp_id = ?
       AND UPPER(module) IN ('TICKETING', 'LEAD')`,
    [empId]
  );

  return rows.map((row) => Number(row.branch_id)).filter(Boolean);
};

const getAssignableEmployeesForBranchTeam = async ({
  branchId,
  teamId,
  requester,
  enforceRequesterBranchAccess = true
}) => {
  const normalizedRole = normalizeText(requester?.role);
  const ticketLeadBranchIds = await getTicketLeadBranchIds(requester?.emp_id);
  const requesterBranchIds = [
    Number(requester?.branch_id) || null,
    ...((requester?.all_branch_ids || []).map(Number))
  ].filter(Boolean);
  const allowedBranchIds = [...new Set([...ticketLeadBranchIds, ...requesterBranchIds])];

  if (
    enforceRequesterBranchAccess &&
    !FULL_ACCESS_ROLES.includes(normalizedRole) &&
    !allowedBranchIds.includes(Number(branchId))
  ) {
    return { forbidden: true, rows: [] };
  }

  const [rows] = await db.query(
    `
    SELECT DISTINCT
      e.emp_id,
      e.name,
      e.team_id,
      t.team_name,
      e.designation_id,
      d.designation_name,
      d.level AS designation_level
    FROM employees e
    INNER JOIN employee_branches eb
      ON eb.emp_id = e.emp_id
    INNER JOIN teams t
      ON e.team_id = t.id
    LEFT JOIN designations d
      ON e.designation_id = d.id
    WHERE e.status = 'ACTIVE'
      AND e.team_id = ?
      AND eb.branch_id = ?
      AND UPPER(eb.module) IN ('TICKETING', 'LEAD')
      AND e.emp_id IS NOT NULL
    ORDER BY d.level DESC, e.name ASC
    `,
    [teamId, branchId]
  );

  return { forbidden: false, rows };
};

const FULL_ACCESS_ROLES = ["SUPER_ADMIN", "ADMIN"];

const normalizeText = (value) => String(value || "").trim().toUpperCase();

const TECHNICAL_DESIGNATION_HINTS = [
  "TECH LEAD",
  "TECHNICAL",
  "BRANCH INCHARGE",
  "ASST BRANCH INCHARGE",
  "TECHOPS",
  "NOC",
  "ONM",
  "PROJECT",
  "FEASIBILITY"
];

const SALES_DIRECT_CMO_HINTS = [
  "MIS",
  "MIS EXECUTIVE",
  "VENDOR COORDINATOR",
  "SERVICE SUPPORT",
  "SALES SUPPORT REPRESENTATIVE",
  "TELESALES"
];

const HEAD_OFFICE_TEAM_HINTS = [
  "IT",
  "HRD",
  "ACCOUNTS",
  "SUPPORT",
  "MARKETING",
  "OPERATIONS",
  "CUSTOMER CARE",
  "STORE",
  "PURCHASE",
  "NOC",
  "PROJECT",
  "ONM",
  "VAS",
  "LEGAL",
  "FINANCE"
];

const HEAD_OFFICE_MANAGER_HINTS = ["MANAGER", "ASST MANAGER", "ASSISTANT MANAGER"];

const getUserBranchIdsForTickets = (user) => {
  const ids = [
    Number(user?.branch_id) || null,
    ...((user?.all_branch_ids || []).map(Number))
  ].filter(Boolean);

  return [...new Set(ids)];
};

const getUserZoneIdsForTickets = (user) => {
  const ids = [
    Number(user?.zone_id) || null,
    ...((user?.crm_zone_ids || []).map(Number))
  ].filter(Boolean);

  return [...new Set(ids)];
};

const getFunctionalDomain = ({ teamName, designationName }) => {
  const normalizedTeam = normalizeText(teamName);
  const normalizedDesignation = normalizeText(designationName);

  if (normalizedTeam === "SALES") {
    return "SALES";
  }

  if (TECHNICAL_DESIGNATION_HINTS.some((hint) => normalizedDesignation.includes(hint))) {
    return "TECHNICAL";
  }

  if (HEAD_OFFICE_TEAM_HINTS.includes(normalizedTeam)) {
    return "HEAD_OFFICE";
  }

  return normalizedTeam === "TECHNICAL" ? "TECHNICAL" : "HEAD_OFFICE";
};

const isTechnicalUser = (user) => {
  const designation = normalizeText(user?.designation_name);
  const team = normalizeText(user?.team_name);

  return (
    team === "TECHNICAL" ||
    TECHNICAL_DESIGNATION_HINTS.some((hint) => designation.includes(hint))
  );
};

const isSalesUser = (user) => {
  const team = normalizeText(user?.team_name);
  const designation = normalizeText(user?.designation_name);

  return (
    team === "SALES" ||
    designation === "ASM" ||
    designation.includes("CMO") ||
    designation.includes("SALES HEAD") ||
    SALES_DIRECT_CMO_HINTS.some((hint) => designation.includes(hint))
  );
};

const isHeadOfficeUser = (user) => {
  const team = normalizeText(user?.team_name);
  return HEAD_OFFICE_TEAM_HINTS.includes(team);
};

const getDomainDesignationStage = (domain, designationName = "") => {
  const normalizedDesignation = normalizeText(designationName);

  if (domain === "TECHNICAL") {
    if (normalizedDesignation.includes("TECH LEAD")) return "ZONE_HEAD";
    if (normalizedDesignation.includes("BRANCH INCHARGE")) return "BRANCH_HEAD";
    return "STAFF";
  }

  if (domain === "SALES") {
    if (normalizedDesignation.includes("CMO") || normalizedDesignation.includes("SALES HEAD")) return "GLOBAL_HEAD";
    if (normalizedDesignation === "ASM" || normalizedDesignation.includes(" ASM")) return "ZONE_HEAD";
    return "STAFF";
  }

  if (domain === "HEAD_OFFICE") {
    if (HEAD_OFFICE_MANAGER_HINTS.includes(normalizedDesignation)) return "TEAM_HEAD";
    return "STAFF";
  }

  return "STAFF";
};

const canUserSeeCreatorHierarchy = (ticket, user) => {
  const creatorDomain = getFunctionalDomain({
    teamName: ticket.creator_team_name,
    designationName: ticket.creator_designation_name
  });

  const creatorStage = getDomainDesignationStage(creatorDomain, ticket.creator_designation_name);
  const userDesignation = normalizeText(user?.designation_name);
  const userTeamId = Number(user?.team_id) || null;
  const userBranchIds = getUserBranchIdsForTickets(user);
  const userZoneIds = getUserZoneIdsForTickets(user);

  if (creatorDomain === "TECHNICAL") {
    if (normalizeText(user?.designation_name) === "CTO") {
      return true;
    }

    if (creatorStage === "ZONE_HEAD") {
      return false;
    }

    if (
      creatorStage === "BRANCH_HEAD" &&
      isTechnicalUser(user) &&
      userBranchIds.includes(Number(ticket.creator_branch_id)) &&
      userDesignation.includes("BRANCH INCHARGE")
    ) {
      return true;
    }

    if (
      isTechnicalUser(user) &&
      creatorStage === "STAFF" &&
      userBranchIds.includes(Number(ticket.creator_branch_id))
    ) {
      return true;
    }

    if (
      userDesignation.includes("TECH LEAD") &&
      userZoneIds.includes(Number(ticket.creator_zone_id))
    ) {
      return true;
    }

    return false;
  }

  if (creatorDomain === "SALES") {
    if (userDesignation.includes("CMO") || userDesignation.includes("SALES HEAD")) {
      return true;
    }

    if (creatorStage === "ZONE_HEAD" || creatorStage === "GLOBAL_HEAD") {
      return false;
    }

    if (
      isSalesUser(user) &&
      creatorStage === "STAFF" &&
      userBranchIds.includes(Number(ticket.creator_branch_id))
    ) {
      return true;
    }

    if (
      userDesignation === "ASM" &&
      userZoneIds.includes(Number(ticket.creator_zone_id))
    ) {
      return true;
    }

    return false;
  }

  if (creatorDomain === "HEAD_OFFICE") {
    if (userDesignation === "CTO") {
      return true;
    }

    if (creatorStage === "TEAM_HEAD") {
      return false;
    }

    if (
      userTeamId &&
      Number(ticket.creator_team_id) &&
      creatorStage === "STAFF" &&
      userTeamId === Number(ticket.creator_team_id)
    ) {
      return true;
    }

    if (
      HEAD_OFFICE_MANAGER_HINTS.includes(userDesignation) &&
      userTeamId &&
      Number(ticket.creator_team_id) === userTeamId
    ) {
      return true;
    }

    return false;
  }

  return false;
};

const canUserSeeAssignedHierarchy = (ticket, user) => {
  const assignedDomain = getFunctionalDomain({
    teamName: ticket.assigned_team_name || ticket.team_name,
    designationName: ticket.assigned_designation_name
  });

  const assignedStage = getDomainDesignationStage(assignedDomain, ticket.assigned_designation_name);
  const userDesignation = normalizeText(user?.designation_name);
  const userTeamId = Number(user?.team_id) || null;
  const userBranchIds = getUserBranchIdsForTickets(user);
  const userZoneIds = getUserZoneIdsForTickets(user);

  if (assignedDomain === "TECHNICAL") {
    if (userDesignation === "CTO") {
      return true;
    }

    if (assignedStage === "ZONE_HEAD") {
      return false;
    }

    if (
      assignedStage === "BRANCH_HEAD" &&
      userDesignation.includes("BRANCH INCHARGE") &&
      userBranchIds.includes(Number(ticket.branch_id))
    ) {
      return true;
    }

    if (
      isTechnicalUser(user) &&
      assignedStage === "STAFF" &&
      userBranchIds.includes(Number(ticket.branch_id))
    ) {
      return true;
    }

    if (
      userDesignation.includes("TECH LEAD") &&
      userZoneIds.includes(Number(ticket.ticket_zone_id))
    ) {
      return true;
    }

    return false;
  }

  if (assignedDomain === "SALES") {
    if (userDesignation.includes("CMO") || userDesignation.includes("SALES HEAD")) {
      return true;
    }

    if (assignedStage === "ZONE_HEAD" || assignedStage === "GLOBAL_HEAD") {
      return false;
    }

    if (
      isSalesUser(user) &&
      assignedStage === "STAFF" &&
      userBranchIds.includes(Number(ticket.branch_id))
    ) {
      return true;
    }

    if (
      userDesignation === "ASM" &&
      userZoneIds.includes(Number(ticket.ticket_zone_id))
    ) {
      return true;
    }

    return false;
  }

  if (assignedDomain === "HEAD_OFFICE") {
    if (userDesignation === "CTO") {
      return true;
    }

    if (assignedStage === "TEAM_HEAD") {
      return false;
    }

    if (
      userTeamId &&
      Number(ticket.assign_team) &&
      assignedStage === "STAFF" &&
      userTeamId === Number(ticket.assign_team)
    ) {
      return true;
    }

    if (
      HEAD_OFFICE_MANAGER_HINTS.includes(userDesignation) &&
      userTeamId &&
      Number(ticket.assign_team) === userTeamId
    ) {
      return true;
    }

    return false;
  }

  return false;
};

const canUserViewTicket = (ticket, user) => {
  const normalizedRole = normalizeText(user?.role);

  if (
    FULL_ACCESS_ROLES.includes(normalizedRole) ||
    normalizeText(user?.designation_name) === "MD" ||
    normalizeText(user?.designation_name) === "CEO"
  ) {
    return true;
  }

  if (
    String(ticket.created_by || "") === String(user?.emp_id || "") ||
    String(ticket.assigned_to || "") === String(user?.emp_id || "")
  ) {
    return true;
  }

  return canUserSeeCreatorHierarchy(ticket, user) || canUserSeeAssignedHierarchy(ticket, user);
};

const hasUserTicketParticipation = async (ticketId, empId) => {
  if (!ticketId || !empId) {
    return false;
  }

  const [[row]] = await db.query(
    `
    SELECT 1 AS has_access
    FROM (
      SELECT action_by AS emp_id
      FROM ticket_actions
      WHERE ticket_id = ?
        AND action_by IS NOT NULL

      UNION ALL

      SELECT assigned_by AS emp_id
      FROM ticket_assignments
      WHERE ticket_id = ?
        AND assigned_by IS NOT NULL

      UNION ALL

      SELECT from_employee AS emp_id
      FROM ticket_assignments
      WHERE ticket_id = ?
        AND from_employee IS NOT NULL

      UNION ALL

      SELECT to_employee AS emp_id
      FROM ticket_assignments
      WHERE ticket_id = ?
        AND to_employee IS NOT NULL
    ) ticket_participants
    WHERE ticket_participants.emp_id = ?
    LIMIT 1
    `,
    [ticketId, ticketId, ticketId, ticketId, empId]
  );

  return Boolean(row?.has_access);
};

const inferVerificationRule = (ticket) => {
  const creatorDesignation = normalizeText(ticket.creator_designation_name);
  const creatorTeam = normalizeText(ticket.creator_team_name || ticket.team_name);

  if (creatorDesignation.includes("TECH LEAD")) {
    return { verifierType: "CEO", scope: "GLOBAL" };
  }

  if (creatorDesignation === "ASM" || creatorDesignation.includes(" ASM")) {
    return { verifierType: "CMO", scope: "GLOBAL" };
  }

  if (
    creatorDesignation === "MANAGER" ||
    creatorDesignation === "ASST MANAGER" ||
    creatorDesignation === "ASSISTANT MANAGER"
  ) {
    return { verifierType: "CEO", scope: "GLOBAL" };
  }

  if (creatorTeam === "SALES") {
    const isDirectCmoRole = SALES_DIRECT_CMO_HINTS.some((hint) =>
      creatorDesignation.includes(hint)
    );

    return {
      verifierType: isDirectCmoRole ? "CMO" : "ASM",
      scope: isDirectCmoRole ? "GLOBAL" : "ZONE"
    };
  }

  const isTechnical = creatorTeam === "IT" || TECHNICAL_DESIGNATION_HINTS.some((hint) =>
    creatorDesignation.includes(hint)
  );

  if (isTechnical) {
    return { verifierType: "TECH_LEAD", scope: "ZONE" };
  }

  return { verifierType: "MANAGER", scope: "TEAM" };
};

const getVerificationLabel = (rule) => {
  switch (rule?.verifierType) {
    case "CEO":
      return "CEO";
    case "CMO":
      return "CMO";
    case "ASM":
      return "ASM";
    case "TECH_LEAD":
      return "Tech Lead";
    case "MANAGER":
      return "Manager";
    default:
      return "";
  }
};

const canUserVerifyTicket = (ticket, user) => {
  if (ticket.is_verified) {
    return false;
  }

  const normalizedRole = normalizeText(user?.role);
  if (FULL_ACCESS_ROLES.includes(normalizedRole)) {
    return true;
  }

  const userDesignation = normalizeText(user?.designation_name);
  const userTeamId = Number(user?.team_id) || null;
  const userZoneId = Number(user?.zone_id) || null;
  const ticketCreatorTeamId = Number(ticket.creator_team_id) || null;
  const ticketCreatorZoneId = Number(ticket.creator_zone_id) || null;

  const rule = inferVerificationRule(ticket);

  switch (rule.verifierType) {
    case "CEO":
      return userDesignation === "CEO";
    case "CMO":
      return userDesignation.includes("CMO") || userDesignation.includes("SALES HEAD");
    case "ASM":
      return userDesignation === "ASM" && userZoneId && ticketCreatorZoneId && userZoneId === ticketCreatorZoneId;
    case "TECH_LEAD":
      return userDesignation.includes("TECH LEAD") && userZoneId && ticketCreatorZoneId && userZoneId === ticketCreatorZoneId;
    case "MANAGER":
      return (
        (userDesignation === "MANAGER" ||
          userDesignation === "ASST MANAGER" ||
          userDesignation === "ASSISTANT MANAGER") &&
        userTeamId &&
        ticketCreatorTeamId &&
        userTeamId === ticketCreatorTeamId
      );
    default:
      return false;
  }
};

const buildTicketWhereClause = async (status, filters = {}, user) => {
  let where = `WHERE t.status=?`;
  const params = [status];

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

  if (filters.zone) {
    where += ` AND b.zone_id=?`;
    params.push(filters.zone);
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
    where += status === "Closed"
      ? ` AND DATE(t.updated_at) BETWEEN ? AND ?`
      : ` AND DATE(t.created_date) BETWEEN ? AND ?`;
    params.push(filters.from_date, filters.to_date);
  }

  const normalizedRole = normalizeText(user?.role);
  if (!FULL_ACCESS_ROLES.includes(normalizedRole)) {
    const allowedBranchIds = await getTicketLeadBranchIds(user?.emp_id);
    const scopeParts = [];

    if (allowedBranchIds.length) {
      scopeParts.push(`t.branch_id IN (${allowedBranchIds.map(() => "?").join(",")})`);
      params.push(...allowedBranchIds);
    }

    if (user?.emp_id) {
      scopeParts.push(`t.created_by = ?`);
      params.push(user.emp_id);
      scopeParts.push(`t.assigned_to = ?`);
      params.push(user.emp_id);
    }

    if (Number(user?.team_id)) {
      scopeParts.push(`t.assign_team = ?`);
      params.push(Number(user.team_id));

      scopeParts.push(
        `EXISTS (
          SELECT 1
          FROM employees creator_scope
          WHERE creator_scope.emp_id = t.created_by
            AND creator_scope.team_id = ?
        )`
      );
      params.push(Number(user.team_id));
    }

    if (!scopeParts.length) {
      return { where, params, noAccess: true };
    }

    where += ` AND (${scopeParts.join(" OR ")})`;
  }

  return { where, params, noAccess: false };
};

const getTicketSelectSql = (where, sortField, sortOrder, includePagination = true) => `
  SELECT
    t.ticket_id,
    t.customer_id,
    t.customer_name,
    t.created_date,
    t.updated_at,
    t.branch_id,
    b.branch_name,
    b.zone_id AS ticket_zone_id,
    t.due_date,
    t.priority,
    t.type_of_ticket,
    t.subtype_of_ticket,
    tt.type_name,
    st.subtype_name,
    t.assigned_to,
    t.created_by,
    cb.name AS created_by_name,
    t.reporter_name,
    t.landmark,
    t.address,
    t.contact_number1,
    t.contact_number2,
    t.more_details,
    t.assign_team,
    tm.team_name,
    tm.team_name AS assigned_team_name,
    e.name AS assigned_to_name,
    e.team_id AS assigned_team_id,
    assignedTeam.team_name AS assigned_employee_team_name,
    assignedDesignation.designation_name AS assigned_designation_name,
    t.status,
    creator.team_id AS creator_team_id,
    creator.branch_id AS creator_branch_id,
    creatorBranch.zone_id AS creator_zone_id,
    creatorTeam.team_name AS creator_team_name,
    creatorDesignation.designation_name AS creator_designation_name,
    EXISTS (
      SELECT 1
      FROM ticket_actions va
      WHERE va.ticket_id = t.ticket_id
        AND UPPER(va.action_type) = 'VERIFIED'
      LIMIT 1
    ) AS is_verified
  FROM tickets t
  LEFT JOIN ticket_types tt
    ON t.type_of_ticket = tt.type_id
  LEFT JOIN ticket_subtypes st
    ON t.subtype_of_ticket = st.subtype_id
  LEFT JOIN teams tm
    ON t.assign_team = tm.id
  LEFT JOIN branches b
    ON t.branch_id = b.id
  LEFT JOIN employees e
    ON t.assigned_to = e.emp_id
  LEFT JOIN teams assignedTeam
    ON e.team_id = assignedTeam.id
  LEFT JOIN designations assignedDesignation
    ON e.designation_id = assignedDesignation.id
  LEFT JOIN employees cb
    ON t.created_by = cb.emp_id
  LEFT JOIN employees creator
    ON t.created_by = creator.emp_id
  LEFT JOIN branches creatorBranch
    ON creator.branch_id = creatorBranch.id
  LEFT JOIN teams creatorTeam
    ON creator.team_id = creatorTeam.id
  LEFT JOIN designations creatorDesignation
    ON creator.designation_id = creatorDesignation.id
  ${where}
  ORDER BY t.${sortField} ${sortOrder}
  ${includePagination ? "LIMIT ? OFFSET ?" : ""}
`;

const getFilteredTicketRows = async ({ status, filters = {}, user, sortField, sortOrder }) => {
  const { where, params, noAccess } = await buildTicketWhereClause(status, filters, user);

  if (noAccess) {
    return [];
  }

  const [rows] = await db.query(
    getTicketSelectSql(where, sortField, sortOrder, false),
    params
  );

  return rows.filter((row) => canUserViewTicket(row, user));
};

const buildHistoryMap = async (ticketIds) => {
  if (!ticketIds.length) return new Map();

  const placeholders = ticketIds.map(() => "?").join(",");

  const [actions] = await db.query(
    `
    SELECT
      ta.ticket_id,
      ta.action_type,
      ta.comments,
      ta.created_at,
      ta.action_by,
      e.name AS action_by_name
    FROM ticket_actions ta
    LEFT JOIN employees e
      ON ta.action_by = e.emp_id
    WHERE ta.ticket_id IN (${placeholders})
    ORDER BY ta.ticket_id, ta.created_at ASC, ta.action_id ASC
    `,
    ticketIds
  );

  const [moves] = await db.query(
    `
    SELECT
      ta.ticket_id,
      ta.assigned_at,
      ta.from_employee,
      e1.name AS from_name,
      ta.to_employee,
      e2.name AS to_name,
      ta.assigned_by,
      e3.name AS assigned_by_name
    FROM ticket_assignments ta
    LEFT JOIN employees e1
      ON ta.from_employee = e1.emp_id
    LEFT JOIN employees e2
      ON ta.to_employee = e2.emp_id
    LEFT JOIN employees e3
      ON ta.assigned_by = e3.emp_id
    WHERE ta.ticket_id IN (${placeholders})
    ORDER BY ta.ticket_id, ta.assigned_at ASC, ta.id ASC
    `,
    ticketIds
  );

  const historyMap = new Map();

  for (const row of actions) {
    const existing = historyMap.get(row.ticket_id) || { actions: [], moves: [] };
    existing.actions.push(row);
    historyMap.set(row.ticket_id, existing);
  }

  for (const row of moves) {
    const existing = historyMap.get(row.ticket_id) || { actions: [], moves: [] };
    existing.moves.push(row);
    historyMap.set(row.ticket_id, existing);
  }

  return historyMap;
};

const formatDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN");
};

const buildActionHistoryText = (historyEntry) => {
  const actions = historyEntry?.actions || [];
  if (!actions.length) return "";
  return actions
    .map((row) =>
      `[${formatDateTime(row.created_at)}] ${row.action_type} - ${row.comments || ""} | By: ${row.action_by_name || row.action_by || "System"}`
    )
    .join(" || ");
};

const buildMoveHistoryText = (historyEntry) => {
  const moves = historyEntry?.moves || [];
  if (!moves.length) return "";
  return moves
    .map((row) =>
      `[${formatDateTime(row.assigned_at)}] ${row.from_name || row.from_employee || "-"} -> ${row.to_name || row.to_employee || "-"} | Moved by: ${row.assigned_by_name || row.assigned_by || "-"}`
    )
    .join(" || ");
};

const sendTicketExportCsv = async (req, res, status) => {
  await autoCloseResolvedTickets();

  const sortField = status === "Closed" ? "updated_at" : "created_date";
  const sortOrder = "DESC";
  const rows = await getFilteredTicketRows({
    status,
    filters: req.body || {},
    user: req.user,
    sortField,
    sortOrder
  });

  if (!rows.length) {
    const fileName = `${status.toLowerCase()}-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    return res.send("Ticket ID\n");
  }
  const ticketIds = rows.map((row) => row.ticket_id);
  const historyMap = await buildHistoryMap(ticketIds);

  const headers = [
    "Ticket ID",
    "Type",
    "Subtype",
    "Priority",
    "Customer ID",
    "Customer Name",
    "Raised Date",
    "Due Date",
    status === "Closed" ? "Closed Date" : "Last Updated",
    "Raised By",
    "Reporter Name",
    "Branch",
    "Landmark",
    "Address",
    "Contact Number 1",
    "Contact Number 2",
    "Assigned Team",
    "Assigned To",
    "More Details",
    "Status",
    "Creator Team",
    "Creator Designation",
    "Verification Required By",
    "Verified",
    "Action History",
    "Assignment History"
  ];

  const escapeCsv = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const csvRows = [
    headers.join(","),
    ...rows.map((row) => {
      const historyEntry = historyMap.get(row.ticket_id);
      const verificationRule = inferVerificationRule(row);
      return [
        row.ticket_id,
        row.type_name || row.type_of_ticket || "",
        row.subtype_name || row.subtype_of_ticket || "",
        row.priority || "",
        row.customer_id || "",
        row.customer_name || "",
        formatDateTime(row.created_date),
        formatDateTime(row.due_date),
        formatDateTime(status === "Closed" ? row.updated_at : row.updated_at),
        row.created_by_name || row.created_by || row.reporter_name || "",
        row.reporter_name || "",
        row.branch_name || row.branch_id || "",
        row.landmark || "",
        row.address || "",
        row.contact_number1 || "",
        row.contact_number2 || "",
        row.team_name || "",
        row.assigned_to_name || row.assigned_to || "",
        row.more_details || "",
        row.status || "",
        row.creator_team_name || "",
        row.creator_designation_name || "",
        getVerificationLabel(verificationRule),
        row.is_verified ? "Yes" : "No",
        buildActionHistoryText(historyEntry),
        buildMoveHistoryText(historyEntry)
      ].map(escapeCsv).join(",");
    })
  ];

  const fileName = `${status.toLowerCase()}-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  return res.send(csvRows.join("\n"));
};

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
    const [result] = await db.query(
      `DELETE FROM ticket_types WHERE type_id=?`,
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Ticket type not found or already deleted" });
    }

    res.json({ message: "Deleted" });

  } catch (err) {
    if (["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(err.code)) {
      return res.status(400).json({ message: "Ticket type is in use and cannot be deleted" });
    }

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
    const [result] = await db.query(
      `DELETE FROM ticket_subtypes WHERE subtype_id=?`,
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Ticket subtype not found or already deleted" });
    }

    res.json({ message: "Deleted" });

  } catch (err) {
    if (["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(err.code)) {
      return res.status(400).json({ message: "Ticket subtype is in use and cannot be deleted" });
    }

    res.status(500).json({ message: "Delete failed" });
  }
};

/* =============================
   CREATE TICKET
============================= */

exports.createTicket = async (req, res) => {
  try {
    const data = req.body;
    const createdBy = String(req.user?.emp_id || "").trim();

    if (!data.type_of_ticket)
      return res.status(400).json({ message: "Ticket type required" });

    if (!data.subtype_of_ticket)
      return res.status(400).json({ message: "Ticket subtype required" });

    if (!data.due_date)
      return res.status(400).json({ message: "Due date required" });

    if (!data.branch_id)
      return res.status(400).json({ message: "Branch required" });

    if (!data.assign_team)
      return res.status(400).json({ message: "Team required" });

    if (!data.assigned_to)
      return res.status(400).json({ message: "Employee required" });

    if (!createdBy)
      return res.status(400).json({ message: "Created by is required" });

    if (!data.customer_id)
      return res.status(400).json({ message: "Customer ID required" });

    if (!data.customer_name)
      return res.status(400).json({ message: "Customer name required" });

    if (!data.address)
      return res.status(400).json({ message: "Address required" });

    if (!data.contact_number1)
      return res.status(400).json({ message: "Primary contact number required" });

    if (!data.more_details)
      return res.status(400).json({ message: "More details required" });

    const { rows: eligibleEmployees } = await getAssignableEmployeesForBranchTeam({
      branchId: Number(data.branch_id),
      teamId: Number(data.assign_team),
      requester: req.user || {},
      enforceRequesterBranchAccess: false
    });

    /* ?? CONVERT ID ? EMP_ID */
    let assignedEmpId = String(data.assigned_to || "").trim();

    const [[emp]] = await db.query(
      `SELECT emp_id FROM employees WHERE emp_id = ? AND status = 'ACTIVE'`,
      [assignedEmpId]
    );

    if (!emp) {
      const [[fallbackEmp]] = await db.query(
        `SELECT emp_id FROM employees WHERE id = ? AND status = 'ACTIVE'`,
        [data.assigned_to]
      );

      if (!fallbackEmp) {
        return res.status(400).json({ message: "Invalid employee" });
      }

      assignedEmpId = fallbackEmp.emp_id;
    }

    

    if (!eligibleEmployees.some((row) => row.emp_id === assignedEmpId)) {
      return res.status(400).json({ message: "Selected employee is not available for the chosen branch/team" });
    }

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
        data.reporter_name || null,
        data.landmark || null,
        data.address,
        data.contact_number1,
        data.contact_number2 || null,
        data.more_details,
        data.status || "Opened",
        createdBy
      ]
    );

    if (req.file) {
      await db.query(
        `INSERT INTO ticket_attachments
         (ticket_id, file_name, file_path)
         VALUES (?, ?, ?)`,
        [
          ticketId,
          req.file.originalname || req.file.filename,
          `/uploads/tickets/${req.file.filename}`
        ]
      );
    }

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
    await autoCloseResolvedTickets();

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

    const filteredRows = await getFilteredTicketRows({
      status: "Opened",
      filters,
      user,
      sortField,
      sortOrder
    });

    const total = filteredRows.length;
    const totalPages = Math.ceil(total / limit);

    res.json({
      tickets: filteredRows.slice(offset, offset + limit),
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
    await autoCloseResolvedTickets();

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

    const filteredRows = await getFilteredTicketRows({
      status: "Closed",
      filters,
      user,
      sortField,
      sortOrder
    });

    const total = filteredRows.length;
    const totalPages = Math.ceil(total / limit);

    const enrichedRows = filteredRows.map((row) => {
      const verificationRule = inferVerificationRule(row);
      return {
        ...row,
        verification_required_by: getVerificationLabel(verificationRule),
        can_verify: canUserVerifyTicket(row, user)
      };
    });

    res.json({
      tickets: enrichedRows.slice(offset, offset + limit),
      totalPages,
      total,
      canVerifyAny:
        FULL_ACCESS_ROLES.includes(normalizeText(user?.role)) ||
        enrichedRows.some((row) => row.can_verify)
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
      `SELECT branch_id, assign_team, assigned_to FROM tickets WHERE ticket_id = ?`,
      [ticketId]
    );

    console.log("CURRENT TICKET:", current);

    if (!current) {
      console.log("❌ Ticket not found");
      return res.status(404).json({ message: "Ticket not found" });
    }

    const { forbidden, rows: eligibleEmployees } = await getAssignableEmployeesForBranchTeam({
      branchId: Number(current.branch_id),
      teamId: Number(new_assigned_team),
      requester: user
    });

    if (forbidden) {
      return res.json([]);
    }

    if (new_assigned_to) {
      console.log("Checking NEW employee:", new_assigned_to);

      const emp = eligibleEmployees.find((row) => row.emp_id === new_assigned_to);

      console.log("NEW EMP RESULT:", emp);

      if (!emp) {
        console.log("❌ Invalid NEW employee");
        return res.status(400).json({ message: "Selected employee is not eligible for this branch/team" });
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

    const { branch_id, team_id, context } = req.query;

    console.log("REQ QUERY:", { branch_id, team_id });

    if (!branch_id || !team_id) {
      return res.status(400).json({ message: "Missing branch or team" });
    }

    const { forbidden, rows } = await getAssignableEmployeesForBranchTeam({
      branchId: Number(branch_id),
      teamId: Number(team_id),
      requester: req.user,
      enforceRequesterBranchAccess: context !== "new-ticket"
    });

    if (forbidden) {
      return res.json([]);
    }

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

    await db.query(
      `
      UPDATE tickets
      SET updated_at = NOW()
      WHERE ticket_id = ?
      `,
      [ticketId]
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

exports.resolveTicket = async (req, res) => {
  try {
    const user = req.user;
    const { ticketId } = req.params;
    const { action_type, comments } = req.body || {};

    const normalizedActionType = normalizeActionType(action_type);

    if (!ticketId) {
      return res.status(400).json({ message: "Ticket ID is required" });
    }

    if (!normalizedActionType || !RESOLVE_ACTION_TYPES.includes(normalizedActionType)) {
      return res.status(400).json({ message: "Valid resolve action required" });
    }

    if (!comments || !String(comments).trim()) {
      return res.status(400).json({ message: "Comments required" });
    }

    const [[ticketExists]] = await db.query(
      `SELECT ticket_id FROM tickets WHERE ticket_id = ?`,
      [ticketId]
    );

    if (!ticketExists) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    await db.query(
      `
      INSERT INTO ticket_actions
      (ticket_id, action_type, comments, action_by)
      VALUES (?, ?, ?, ?)
      `,
      [ticketId, normalizedActionType, String(comments).trim(), user.emp_id]
    );

    await db.query(
      `
      UPDATE tickets
      SET status = 'Opened',
          updated_at = NOW()
      WHERE ticket_id = ?
      `,
      [ticketId]
    );

    res.json({
      message: "Ticket marked for 24-hour follow-up window"
    });
  } catch (err) {
    console.error("RESOLVE ERROR:", err);
    res.status(500).json({ message: "Resolve failed" });
  }
};

exports.getTicketHistory = async (req, res) => {
  try {
    await autoCloseResolvedTickets();

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
  b.zone_id AS ticket_zone_id,
  tm.team_name,
  tm.team_name AS assigned_team_name,
  e.name AS assigned_name,
  e.emp_id AS assigned_emp_id,
  e.team_id AS assigned_team_id,
  assignedTeam.team_name AS assigned_employee_team_name,
  assignedDesignation.designation_name AS assigned_designation_name,
  cb.name AS created_by_name,
  creator.team_id AS creator_team_id,
  creator.branch_id AS creator_branch_id,
  creatorBranch.zone_id AS creator_zone_id,
  creatorTeam.team_name AS creator_team_name,
  creatorDesignation.designation_name AS creator_designation_name
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
  ON t.assigned_to = e.emp_id
LEFT JOIN teams assignedTeam
  ON e.team_id = assignedTeam.id
LEFT JOIN designations assignedDesignation
  ON e.designation_id = assignedDesignation.id
LEFT JOIN employees cb 
  ON t.created_by = cb.emp_id
LEFT JOIN employees creator
  ON t.created_by = creator.emp_id
LEFT JOIN branches creatorBranch
  ON creator.branch_id = creatorBranch.id
LEFT JOIN teams creatorTeam
  ON creator.team_id = creatorTeam.id
LEFT JOIN designations creatorDesignation
  ON creator.designation_id = creatorDesignation.id
WHERE t.ticket_id = ?;
      `,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const participatedInTicket = await hasUserTicketParticipation(ticketId, req.user?.emp_id);

    if (!canUserViewTicket(ticket, req.user) && !participatedInTicket) {
      return res.status(403).json({ message: "Access denied for this ticket" });
    }

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

    // ✅ 3. GET ASSIGNMENT MOVES
    const [assignmentMoves] = await db.query(
      `
      SELECT
        ta.id,
        ta.ticket_id,
        ta.from_team,
        fromTeam.team_name AS from_team_name,
        ta.to_team,
        toTeam.team_name AS to_team_name,
        ta.from_employee,
        e1.name AS from_name,
        ta.to_employee,
        e2.name AS to_name,
        ta.assigned_by,
        e3.name AS assigned_by_name,
        ta.assigned_at
      FROM ticket_assignments ta
      LEFT JOIN employees e1
        ON ta.from_employee = e1.emp_id
      LEFT JOIN employees e2
        ON ta.to_employee = e2.emp_id
      LEFT JOIN employees e3
        ON ta.assigned_by = e3.emp_id
      LEFT JOIN teams fromTeam
        ON ta.from_team = fromTeam.id
      LEFT JOIN teams toTeam
        ON ta.to_team = toTeam.id
      WHERE ta.ticket_id = ?
      ORDER BY ta.assigned_at ASC
      `,
      [ticketId]
    );

    const [attachments] = await db.query(
      `
      SELECT
        id,
        file_name,
        file_path,
        uploaded_at
      FROM ticket_attachments
      WHERE ticket_id = ?
      ORDER BY uploaded_at ASC, id ASC
      `,
      [ticketId]
    );

    const formatTimelineDate = (value) => new Date(value).toLocaleString("en-IN");

    const firstMove = assignmentMoves[0] || null;
    const initialAssignedTo = firstMove?.from_employee || ticket.assigned_to || null;
    const initialAssignedToName = firstMove?.from_name || ticket.assigned_name || null;

    const timeline = [
      ...actions.map((action) => ({
        id: action.action_id || action.id,
        event_type: "action",
        label: action.action_type || "Updated",
        timestamp: action.created_at,
        text: `${action.comments || "-"}\n\nUpdated By - ${action.action_by_name || "System"} (${action.action_by || "-"})\nat [${formatTimelineDate(action.created_at)}]`
      })),
      ...assignmentMoves.map((move) => ({
        id: move.id,
        event_type: "move",
        label: "Ticket Moved",
        timestamp: move.assigned_at,
        text: `From Team - ${move.from_team_name || "-"}${move.from_name || move.from_employee ? ` | ${move.from_name || "-"} (${move.from_employee || "-"})` : ""}\nTo Team - ${move.to_team_name || "-"}${move.to_name || move.to_employee ? ` | ${move.to_name || "-"} (${move.to_employee || "-"})` : ""}\nMoved By - ${move.assigned_by_name || "-"} (${move.assigned_by || "-"})\nat [${formatTimelineDate(move.assigned_at)}]`
      }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      ticket: {
        ...ticket,
        initial_assigned_to: initialAssignedTo,
        initial_assigned_to_name: initialAssignedToName
      },
      actions,
      assignmentMoves,
      attachments,
      timeline
    });

  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ message: "Failed to load history" });
  }
};

exports.downloadTicketAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const [[attachment]] = await db.query(
      `
      SELECT id, file_name, file_path
      FROM ticket_attachments
      WHERE id = ?
      `,
      [attachmentId]
    );

    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const normalizedPath = String(attachment.file_path || "").replace(/^\/+/, "");
    const absolutePath = path.join(__dirname, "..", normalizedPath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "Attachment file missing" });
    }

    return res.download(absolutePath, attachment.file_name || path.basename(absolutePath));
  } catch (err) {
    console.error("ATTACHMENT DOWNLOAD ERROR:", err);
    res.status(500).json({ message: "Failed to download attachment" });
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

exports.verifyTicket = async (req, res) => {
  try {
    const user = req.user;
    const { ticketId } = req.params;

    const [[ticket]] = await db.query(
      `
      SELECT
        t.ticket_id,
        t.status,
        creator.team_id AS creator_team_id,
        creator.branch_id AS creator_branch_id,
        creatorBranch.zone_id AS creator_zone_id,
        creatorTeam.team_name AS creator_team_name,
        creatorDesignation.designation_name AS creator_designation_name,
        EXISTS (
          SELECT 1
          FROM ticket_actions va
          WHERE va.ticket_id = t.ticket_id
            AND UPPER(va.action_type) = 'VERIFIED'
          LIMIT 1
        ) AS is_verified
      FROM tickets t
      LEFT JOIN employees creator
        ON t.created_by = creator.emp_id
      LEFT JOIN branches creatorBranch
        ON creator.branch_id = creatorBranch.id
      LEFT JOIN teams creatorTeam
        ON creator.team_id = creatorTeam.id
      LEFT JOIN designations creatorDesignation
        ON creator.designation_id = creatorDesignation.id
      WHERE t.ticket_id = ?
      `,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (ticket.status !== "Closed") {
      return res.status(400).json({ message: "Only closed tickets can be verified" });
    }

    if (ticket.is_verified) {
      return res.status(400).json({ message: "Ticket already verified" });
    }

    if (!canUserVerifyTicket(ticket, user)) {
      return res.status(403).json({ message: "You do not have permission to verify this ticket" });
    }

    const verificationRule = inferVerificationRule(ticket);

    await db.query(
      `
      INSERT INTO ticket_actions
      (ticket_id, action_type, action_by, comments, created_at)
      VALUES (?, 'VERIFIED', ?, ?, NOW())
      `,
      [
        ticketId,
        user.emp_id,
        `Ticket verified by ${user.name || user.emp_id} (${user.emp_id}) - Required verifier: ${getVerificationLabel(verificationRule)}`
      ]
    );

    await db.query(
      `
      UPDATE tickets
      SET updated_at = NOW()
      WHERE ticket_id = ?
      `,
      [ticketId]
    );

    return res.json({ message: "Ticket verified successfully" });
  } catch (err) {
    console.error("VERIFY TICKET ERROR:", err);
    return res.status(500).json({ message: "Failed to verify ticket" });
  }
};

exports.exportOpenedTickets = async (req, res) => {
  try {
    return await sendTicketExportCsv(req, res, "Opened");
  } catch (err) {
    console.error("OPENED EXPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to export opened tickets" });
  }
};

exports.exportClosedTickets = async (req, res) => {
  try {
    return await sendTicketExportCsv(req, res, "Closed");
  } catch (err) {
    console.error("CLOSED EXPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to export closed tickets" });
  }
};
