/* ═══════════════════════════════════════════════════════════════════════
   CENTRALIZED ACCESS CONTROL  —  middleware/access.js
   Single source of truth for ALL pages, ALL modules.

   ─── HOW TO USE ON ANY NEW PAGE / ROUTE ─────────────────────────────

   1. Get user's access profile:
        const p = getAccessProfile(req.user);

   2. Check what they can do (CRUD):
        p.can.create   → can create records
        p.can.edit     → can edit records
        p.can.delete   → can delete records
        p.can.view     → can view records
        p.can.export   → can download/export
        p.can.approve  → can approve requests

   3. Get data visibility (what rows they should see):
        const scope = getDataVisibility(req.user, "manpower" | "uniform" | "employee" | "crm");
        if (scope.fullAccess) → no WHERE clause needed
        if (scope.selfOnly)   → WHERE requester_emp_id = ?
        scope.branchIds       → WHERE branch_id IN (...)
        scope.zoneIds         → WHERE zone_id IN (...)
        scope.teamNames       → WHERE department IN (...)
        scope.departmentNames → WHERE department IN (...) [manpower text col]

   4. Check row-level access:
        canAccessRecord(req.user, record, "manpower" | "uniform")
        → returns true/false

   5. Check approval:
        canApproveStage(req.user, record, "manager" | "hr" | "cto")
        → returns true/false

   ─── HIERARCHY ────────────────────────────────────────────────────────
   SUPER_ADMIN → full everything, no restrictions
   ADMIN       → app management, all data read, user CRUD
   MD / CEO    → all data read, analytics, final approval stage
   CTO         → TECHNICAL team: read + manager-approval + export
   CMO / SALES HEAD → SALES team: read + manager-approval + export
   HRD         → all employee read, HR approval stage, request read
   IT          → all employee read, own dept only for requests
   HO DEPTS    → 15+ departments, own-dept requests + approval
   TECH LEAD   → zone-wide TECHNICAL: CRM-branches read + approve + create
   ASM         → zone-wide SALES: own-zone read + approve + create
   BRANCH IC   → own branch ONLY: branch read + approve + create
   MIS/VENDOR  → SALES read only, no approval
   BDO/BDE/BDM → self only: own data create + view

   ─── BRANCH ACCESS CRITICAL RULES ────────────────────────────────────
   req.user.primary_branch_id = employees.branch_id (own branch)
   req.user.primary_zone_id   = zone of own branch (derived, not from dropped col)
   req.user.crm_branch_ids    = ONLY access_type='CRM' AND module='CRM'

   Branch Incharge: sees [primary_branch_id] ONLY
     (crm_branch_ids added only if explicitly granted)
   Tech Lead: sees [primary_branch_id] + crm_branch_ids, TECHNICAL dept only
   ASM: sees primary_zone_id zone + crm_branch_ids, SALES dept only
═══════════════════════════════════════════════════════════════════════ */

/* ─── Role / designation constants ─── */
const SUPER_ADMIN_ROLE  = "SUPER_ADMIN";
const ADMIN_ROLE        = "ADMIN";
const MGMT_DESIG        = ["MD", "CEO"];
const CTO_DESIG         = ["CTO"];
const CMO_DESIG         = ["CMO", "SALES HEAD"];
const MIS_DESIG         = ["MIS", "MIS EXECUTIVE", "VENDOR COORDINATOR", "VENDOR SALES", "SERVICE SUPPORT"];
const TECH_LEAD_DESIG   = ["TECH LEAD", "ASST TECH LEAD"];
const BRANCH_IC_DESIG   = ["BRANCH INCHARGE", "BRANCH IN-CHARGE", "BRANCH HEAD", "ASST BRANCH INCHARGE"];
const DEPT_MGR_DESIG    = ["MANAGER", "DEPARTMENT MANAGER", "ASST MANAGER", "ASSISTANT MANAGER", "TEAM LEAD"];
const ASM_DESIG         = ["ASM"];
const SALES_FLOOR_DESIG = ["BDO", "BDE", "BDM"];
const ADMIN_ROLES       = [SUPER_ADMIN_ROLE, ADMIN_ROLE];
const MANPOWER_TECH_DESIG = ["ASST BRANCH INCHARGE", "BRANCH INCHARGE", "ASST TECH LEAD", "TECH LEAD", "CTO"];
const MANPOWER_SALES_DESIG = ["ASM", "MIS", "MIS EXECUTIVE", "VENDOR COORDINATOR", "VENDOR SALES", "SERVICE SUPPORT", "CMO", "SALES HEAD"];
const MANPOWER_HO_DESIG = ["ASST MANAGER", "MANAGER"];

/* Head Office department team names */
const HO_DEPTS = new Set([
  "ACCOUNTS", "IT", "HRD", "CUSTOMER CARE", "STORE",
  "DESIGNER", "NOC", "TECHOPS", "SERVICE VENDOR", "RETENSION",
  "PURCHASE", "VAS", "ONM", "PROJECT", "MARKETING", "OPERATIONS",
  "SUPPORT", "ADMIN", "HRD", "COLLECTION", "PROCUREMENT",
  "FEASIBILITY",
  "QUALITY", "TRAINING", "COMPLIANCE", "FINANCE",
]);

/* ─── Tiny helpers ─── */
const norm  = (v = "") => String(v).trim().toUpperCase();
const match = (val, list) => list.map(norm).includes(norm(val));
const num   = (v) => Number(v) || null;

/* ─── Branch ID collector helpers ──────────────────────────────────────
   ALWAYS use these — never inline array manipulation on user.* arrays.
   This is the root cause of wrong-branch bugs.
─────────────────────────────────────────────────────────────────────── */

/** Primary branch only */
const primaryBranchIds = (user) =>
  user.primary_branch_id ? [user.primary_branch_id] : [];

/** Primary zone only */
const primaryZoneIds = (user) =>
  user.primary_zone_id ? [user.primary_zone_id] : [];

/** Primary branch + explicitly CRM-granted branches */
const primaryAndCrmBranchIds = (user) => {
  const ids = [
    num(user.branch_id),
    ...(user.crm_branch_ids || []).map(Number),
  ].filter(Boolean);
  return [...new Set(ids)];
};

/** Primary zone + zones of CRM branches */
const primaryAndCrmZoneIds = (user) => {
  const ids = [
    num(user.zone_id),
    ...(user.crm_zone_ids || []).map(Number),
  ].filter(Boolean);
  return [...new Set(ids)];
};

/* ══════════════════════════════════════════════════════════════════════
   CORE ACCESS PROFILE
   Call this ONCE per request. Returns everything you need.
   Used by all helpers below. Also exported for direct use in controllers.

   p.is.*   → identity flags
   p.can.*  → what actions are allowed (general, not record-specific)
   p.scope  → the primary branch/zone/team context
══════════════════════════════════════════════════════════════════════ */
const getAccessProfile = (user = {}) => {
  const role  = norm(user.role);
  const team  = norm(user.team_name  || user.team  || "");
  const desig = norm(user.designation_name || user.designation || "");

  /* Identity flags */
  const isSuperAdmin    = role === SUPER_ADMIN_ROLE;
  const isAdmin         = role === ADMIN_ROLE;
  const isMDOrCEO       = match(desig, MGMT_DESIG);
  const isCTO           = match(desig, CTO_DESIG);
  const isCMO           = match(desig, CMO_DESIG) && team === "SALES";
  const isMISDesk       = match(desig, MIS_DESIG)  && team === "SALES";
  const isHRD           = team === "HRD";
  const isIT            = team === "IT";
  const isHODept        = HO_DEPTS.has(team);

  /* TECH LEAD must be in a non-HO team (i.e. TECHNICAL) */
  const isTechLead      = match(desig, TECH_LEAD_DESIG) && !isHODept;
  const isBranchIC      = match(desig, BRANCH_IC_DESIG);
  const isASM           = match(desig, ASM_DESIG) && team === "SALES";
  const isSalesFloor    = match(desig, SALES_FLOOR_DESIG);

  /* HO dept approver = a manager/TL *within* a Head Office department */
  const isHODeptMgr     = isHODept && match(desig, DEPT_MGR_DESIG);

  /* Computed branch/zone access arrays for this profile */
  const branchIds = primaryAndCrmBranchIds(user);  /* primary + CRM only */
  const zoneIds   = primaryAndCrmZoneIds(user);     /* primary zone + CRM zones */

  /* ── CRUD capability matrix ── */
  const can = {
    /* Create: who can raise / add records */
    create: isSuperAdmin || isAdmin || isMDOrCEO || isCTO || isCMO ||
            isHRD || isTechLead || isASM || isBranchIC ||
            isHODeptMgr || isMISDesk || isIT ||
            match(desig, SALES_FLOOR_DESIG) || true, /* all employees can create own requests */

    /* Edit: who can edit existing records */
    edit:   isSuperAdmin || isAdmin || isMDOrCEO || isCTO || isCMO ||
            isHRD || isTechLead || isASM || isBranchIC || isHODeptMgr,

    /* Delete: restricted to super admin and admin only */
    delete: isSuperAdmin || isAdmin,

    /* View: broad — most roles can view within their scope */
    view:   true, /* scoped by getDataVisibility() */

    /* Export / download */
    export: isSuperAdmin || isAdmin || isMDOrCEO || isCTO || isCMO ||
            isHRD || isTechLead || isASM || isBranchIC || isHODeptMgr,

    /* Approve requests */
    approve: isSuperAdmin || isAdmin || isMDOrCEO || isCTO || isCMO ||
             isHRD || isTechLead || isASM || isBranchIC || isHODeptMgr,

    /* Manage users (create/edit employees) */
    manageUsers: isSuperAdmin || isAdmin,

    /* Manage master data (branches, zones, teams, designations) */
    manageMasterData: isSuperAdmin || isAdmin,

    /* Analytics dashboards */
    analytics: isSuperAdmin || isAdmin || isMDOrCEO || isCTO || isCMO || isHRD,
  };

  return {
    /* Raw */
    role, team, desig,
    empId:    user.emp_id,
    branchId: num(user.branch_id),
    zoneId:   num(user.zone_id),
    teamId:   num(user.team_id),
    branchIds,
    zoneIds,

    /* Identity */
    is: {
      superAdmin: isSuperAdmin,
      admin:      isAdmin,
      anyAdmin:   isSuperAdmin || isAdmin,
      mdOrCEO:    isMDOrCEO,
      cto:        isCTO,
      cmo:        isCMO,
      misDesk:    isMISDesk,
      hrd:        isHRD,
      it:         isIT,
      techLead:   isTechLead,
      branchIC:   isBranchIC,
      asm:        isASM,
      salesFloor: isSalesFloor,
      hoDept:     isHODept,
      hoDeptMgr:  isHODeptMgr,
    },

    /* Capabilities */
    can,

    /* Legacy flags for backward compatibility */
    isAdmin:          isSuperAdmin || isAdmin,
    isSuperAdmin:     isSuperAdmin,
    isAppAdmin:       isAdmin,
    isMDOrCEO,
    isCTO,
    isCMO,
    isMISDesk,
    isHRD,
    isIT,
    isTechLead,
    isBranchIC,
    isASM,
    isSalesFloor,
    isHODeptApprover: isHODeptMgr,
    isHeadOfficeDept: isHODept,
  };
};

exports.getAccessProfile      = getAccessProfile;
exports.getRequestAccessProfile = getAccessProfile; /* alias for controllers */

/* ══════════════════════════════════════════════════════════════════════
   DATA VISIBILITY SCOPE
   Returns what data this user can SEE. One function for all modules.

   module: "manpower" | "uniform" | "employee" | "crm" | "general"

   Returns:
   {
     fullAccess: bool,     → no WHERE needed (admin/hrd/md/ceo)
     selfOnly:   bool,     → only own records
     branchIds:  number[], → branch_id IN (...)
     zoneIds:    number[], → zone_id IN (...)
     teamNames:  string[], → department/team_name IN (...) [uniform]
     departmentNames: string[], → department IN (...) [manpower text col]
   }
══════════════════════════════════════════════════════════════════════ */
const getDataVisibility = (user, module = "general") => {
  const p = getAccessProfile(user);

  /* ── Full access tier ── */
  if (p.is.superAdmin || p.is.admin || p.is.mdOrCEO || p.is.hrd) {
    return {
      fullAccess: true, selfOnly: false,
      branchIds: [], zoneIds: [], teamNames: [], departmentNames: [],
    };
  }

  /* ── CTO: TECHNICAL department, all zones ── */
  if (p.is.cto) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds: [], zoneIds: [], teamNames: ["TECHNICAL"], departmentNames: ["TECHNICAL"],
    };
  }

  /* ── CMO / SALES HEAD: SALES department, all zones ── */
  if (p.is.cmo) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds: [], zoneIds: [], teamNames: ["SALES"], departmentNames: ["SALES"],
    };
  }

  /* ── MIS / VENDOR COORDINATOR: SALES read only ── */
  if (p.is.misDesk) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds: [], zoneIds: [], teamNames: ["SALES"], departmentNames: ["SALES"],
    };
  }

  /* ── IT team: employee module sees all non-admin, requests = self ── */
  if (p.is.it) {
    if (module === "employee") {
      return {
        fullAccess: false, selfOnly: false,
        branchIds: [], zoneIds: [], teamNames: [], departmentNames: [],
        excludeAdmins: true,
      };
    }
    return { fullAccess: false, selfOnly: true, branchIds: [], zoneIds: [], teamNames: [], departmentNames: [] };
  }

  /* ── ASM: SALES + own primary zone + CRM branches ── */
  if (p.is.asm) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds:       p.branchIds,
      zoneIds:         p.zoneIds,
      teamNames:       ["SALES"],
      departmentNames: ["SALES"],
    };
  }

  /* ── TECH LEAD: TECHNICAL + own primary+CRM branches ──
     CRITICAL: branchIds = [primary] + crm_branch_ids ONLY
     They do NOT see other zones' branches. */
  if (p.is.techLead) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds:       p.branchIds,   /* primary + CRM only */
      zoneIds:         p.zoneIds,
      teamNames:       ["TECHNICAL"],
      departmentNames: ["TECHNICAL"],
    };
  }

  /* ── BRANCH INCHARGE: OWN branch only + own dept ──
     CRITICAL FIX: p.branchIds = [primary_branch_id] + crm_branch_ids
     For Namakkal BI with no CRM grants → branchIds = [4] only.
     They will NEVER see Paramathi Velur or any other branch. */
  if (p.is.branchIC) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds:       p.branchIds,   /* [primary_branch_id] + crm_branch_ids */
      zoneIds:         [],
      teamNames:       [p.team],      /* own department only */
      departmentNames: [p.team],
    };
  }

  /* ── Head Office dept manager: own department ── */
  if (p.is.hoDeptMgr) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds:       [],
      zoneIds:         [],
      teamNames:       [p.team],
      departmentNames: [p.team],
    };
  }

  /* ── Head Office dept (non-manager): own dept records ── */
  if (p.is.hoDept) {
    return {
      fullAccess: false, selfOnly: false,
      branchIds:       [],
      zoneIds:         [],
      teamNames:       [p.team],
      departmentNames: [p.team],
    };
  }

  /* ── Default: self only ── */
  return {
    fullAccess: false, selfOnly: true,
    branchIds: [], zoneIds: [], teamNames: [], departmentNames: [],
  };
};

exports.getDataVisibility = getDataVisibility;

/* ══════════════════════════════════════════════════════════════════════
   ROW-LEVEL ACCESS CHECK
   Can this user access THIS specific record?
   Use for detail page guards, edit guards, etc.

   module: "manpower" | "uniform" | "employee" | "crm" | "general"
══════════════════════════════════════════════════════════════════════ */
const canAccessRecord = (user, record = {}, module = "manpower") => {
  const p           = getAccessProfile(user);
  const dept        = norm(record.department || "");
  const reqBranchId = num(record.branch_id);
  const reqZoneId   = num(record.zone_id);
  const requesterId = record.requester_emp_id
                   || record.employee_emp_id
                   || record.employee_id
                   || record.emp_id;

  /* Full access tier */
  if (p.is.superAdmin || p.is.admin || p.is.mdOrCEO || p.is.hrd) return true;

  /* Own record */
  if (p.empId && requesterId && String(p.empId) === String(requesterId)) return true;

  /* CTO → TECHNICAL */
  if (p.is.cto && dept === "TECHNICAL") return true;

  /* CMO / MIS → SALES */
  if ((p.is.cmo || p.is.misDesk) && dept === "SALES") return true;

  /* ASM → SALES + own zone/CRM branches */
  if (p.is.asm && dept === "SALES") {
    if (reqZoneId   && p.zoneIds.includes(reqZoneId))    return true;
    if (reqBranchId && p.branchIds.includes(reqBranchId)) return true;
  }

  /* TECH LEAD → TECHNICAL + own primary+CRM branches only */
  if (p.is.techLead && dept === "TECHNICAL") {
    if (reqBranchId && p.branchIds.includes(reqBranchId)) return true;
    if (reqZoneId   && p.zoneIds.includes(reqZoneId))    return true;
  }

  /* BRANCH INCHARGE → own primary+CRM branches ONLY
     If Namakkal BI (branchIds=[4]), cannot view branch_id=7 (Paramathi Velur). */
  if (p.is.branchIC && reqBranchId && p.branchIds.includes(reqBranchId)) return true;

  /* HO dept manager → own dept */
  if ((p.is.hoDeptMgr || p.is.hoDept) && dept === p.team) return true;

  /* Uniform: also allow review access by branch */
  if (module === "uniform") {
    if ((p.is.techLead || p.is.branchIC) && reqBranchId && p.branchIds.includes(reqBranchId)) {
      return true;
    }
  }

  return false;
};

exports.canAccessRecord         = canAccessRecord;
exports.canViewOwnOrScopedRequest = canAccessRecord; /* alias */

/* ══════════════════════════════════════════════════════════════════════
   APPROVAL STAGE CHECK
   Can this user approve this record at this stage?

   stage: "manager" | "hr" | "cto" (for manpower)
          "review"                  (for uniform)
══════════════════════════════════════════════════════════════════════ */
const canApproveStage = (user, record = {}, stage = "") => {
  const p           = getAccessProfile(user);
  const stageNorm   = norm(stage);
  const dept        = norm(record.department || "");
  const reqBranchId = num(record.branch_id);
  const reqZoneId   = num(record.zone_id);
  const finalStatus = norm(record.final_status || "SUBMITTED");

  /* SUPER_ADMIN / ADMIN approve anything */
  if (p.is.superAdmin || p.is.admin) return true;

  /* Already fully rejected — no further action */
  if (finalStatus.includes("REJECTED")) return false;

  /* ── Uniform REVIEW stage ── */
  if (stageNorm === "REVIEW") {
    if (p.is.hrd || p.is.mdOrCEO) return true;
    if (p.is.cto  && dept === "TECHNICAL") return true;
    if (p.is.cmo  && dept === "SALES")     return true;
    if (p.is.asm  && dept === "SALES") {
      if (reqZoneId   && p.zoneIds.includes(reqZoneId))    return true;
      if (reqBranchId && p.branchIds.includes(reqBranchId)) return true;
    }
    if ((p.is.techLead || p.is.branchIC) && reqBranchId && p.branchIds.includes(reqBranchId)) return true;
    if (p.is.hoDeptMgr && dept === p.team) return true;
    return false;
  }

  /* ── Manpower: MANAGER stage ── */
  if (stageNorm === "MANAGER") {

    /* TECHNICAL dept */
    if (dept === "TECHNICAL") {
      if (p.is.cto) return true;
      if (p.is.techLead) {
        if (reqBranchId && p.branchIds.includes(reqBranchId)) return true;
        if (reqZoneId   && p.zoneIds.includes(reqZoneId))    return true;
        return false;
      }
      return false;
    }

    /* SALES dept */
    if (dept === "SALES") {
      if (p.is.cmo) return true;
      if (p.is.asm) {
        if (reqZoneId   && p.zoneIds.includes(reqZoneId))    return true;
        if (reqBranchId && p.branchIds.includes(reqBranchId)) return true;
      }
      return false;
    }

    /* HO / other dept: manager in that dept approves */
    if (p.is.hoDeptMgr && dept === p.team) return true;

    /* Branch Incharge: own dept + own branch only */
    if (p.is.branchIC && dept === p.team && reqBranchId && p.branchIds.includes(reqBranchId)) {
      return true;
    }

    return false;
  }

  /* ── Manpower: HR stage ── */
  if (stageNorm === "HR") {
    return p.is.hrd;
  }

  /* ── Manpower: Management stage ── */
  if (stageNorm === "CTO" || stageNorm === "CTO/CEO" || stageNorm === "CEO" || stageNorm === "MANAGEMENT") {
    const managementDesignation = norm(user.designation_name || user.designation);
    return p.team === "MANAGEMENT" && (managementDesignation === "CTO" || managementDesignation === "CEO");
  }

  return false;
};

exports.canApproveStage          = canApproveStage;
exports.canApproveManpowerStage  = canApproveStage; /* alias */
exports.canReviewUniformRequest  = (user, record) => canApproveStage(user, record, "review");

/* ══════════════════════════════════════════════════════════════════════
   BRANCH USAGE CHECK
   Can this user file/create a record FOR a given branch?
══════════════════════════════════════════════════════════════════════ */
exports.canUseRequestBranch = (user, branchId) => {
  const p  = getAccessProfile(user);
  const id = num(branchId);
  if (!id) return false;
  if (p.is.superAdmin || p.is.admin || p.is.mdOrCEO || p.is.hrd) return true;
  return p.branchIds.includes(id);
};

/* ══════════════════════════════════════════════════════════════════════
   EMPLOYEE LIST SCOPE
   For the employee listing page — purely hierarchy based.
   Branch access table NOT used here.
══════════════════════════════════════════════════════════════════════ */
exports.getEmployeeScope = (user) => {
  const p    = getAccessProfile(user);
  const ownDesignationLevel = num(user.designation_level);
  const limitedHierarchyScope = {
    fullAccess: false,
    excludeAdmins: true,
    zoneIds: [],
    branchIds: [],
    teamIds: [],
    selfOnly: false,
    ctoScope: false,
    maxDesignationLevel: ownDesignationLevel,
  };

  if (p.is.superAdmin || p.is.admin) {
    return { fullAccess: true, excludeAdmins: false, zoneIds: [], branchIds: [], teamIds: [], selfOnly: false, ctoScope: false, maxDesignationLevel: null };
  }

  if (p.is.mdOrCEO) {
    return { fullAccess: true, excludeAdmins: true, zoneIds: [], branchIds: [], teamIds: [], selfOnly: false, ctoScope: false, maxDesignationLevel: null };
  }

  if (p.is.cto) {
    return {
      ...limitedHierarchyScope,
      ctoScope: true,
    };
  }

  if (p.is.cmo || p.is.misDesk) {
    return {
      ...limitedHierarchyScope,
      teamIds: [num(user.team_id)],
    };
  }

  if (p.is.hrd) {
    return { fullAccess: false, excludeAdmins: true, zoneIds: [], branchIds: [], teamIds: [], selfOnly: false, ctoScope: false, maxDesignationLevel: null };
  }

  /* Other HO departments → own team only */
  if (p.is.hoDept) {
    return {
      ...limitedHierarchyScope,
      teamIds: [num(user.team_id)],
    };
  }

  /* Tech Lead → own zone + own team (TECHNICAL) */
  if (p.is.techLead) {
    return {
      ...limitedHierarchyScope,
      excludeAdmins: false,
      zoneIds: [num(user.zone_id)],
      teamIds: [num(user.team_id)],
    };
  }

  /* ASM → own zone + SALES team */
  if (p.is.asm) {
    return {
      ...limitedHierarchyScope,
      excludeAdmins: false,
      zoneIds: [num(user.zone_id)],
      teamIds: [num(user.team_id)],
    };
  }

  /* Branch Incharge → own branch + own team ONLY */
  if (p.is.branchIC) {
    return {
      ...limitedHierarchyScope,
      excludeAdmins: false,
      branchIds: [num(user.branch_id)],
      teamIds: [num(user.team_id)],
    };
  }

  return { fullAccess: false, excludeAdmins: false, zoneIds: [], branchIds: [], teamIds: [], selfOnly: true, ctoScope: false, maxDesignationLevel: ownDesignationLevel };
};

exports.buildEmployeeWhereClause = (scope, params, alias = "e", callerEmpId = null) => {
  if (scope.fullAccess && !scope.excludeAdmins) return "";

  let sql = "";

  if (scope.selfOnly) {
    sql += callerEmpId ? ` AND ${alias}.emp_id = ?` : " AND 1=0";
    if (callerEmpId) params.push(callerEmpId);
    return sql;
  }

  if (scope.excludeAdmins) {
    sql += ` AND ${alias}.role NOT IN ('ADMIN','SUPER_ADMIN')`;
  }

  if (scope.zoneIds?.length) {
    sql += ` AND b.zone_id IN (${scope.zoneIds.filter(Boolean).map(() => "?").join(",")})`;
    params.push(...scope.zoneIds.filter(Boolean));
  }

  if (scope.branchIds?.length) {
    sql += ` AND ${alias}.branch_id IN (${scope.branchIds.filter(Boolean).map(() => "?").join(",")})`;
    params.push(...scope.branchIds.filter(Boolean));
  }

  if (scope.teamIds?.length) {
    sql += ` AND ${alias}.team_id IN (${scope.teamIds.filter(Boolean).map(() => "?").join(",")})`;
    params.push(...scope.teamIds.filter(Boolean));
  }

  if (scope.ctoScope) {
    sql += ` AND t.team_name = 'TECHNICAL'`;
  }

  if (scope.maxDesignationLevel) {
    sql += ` AND (d.level IS NULL OR d.level <= ?`;
    params.push(scope.maxDesignationLevel);
    if (callerEmpId) {
      sql += ` OR ${alias}.emp_id = ?`;
      params.push(callerEmpId);
    }
    sql += `)`;
  }

  return sql;
};

/* ══════════════════════════════════════════════════════════════════════
   EMPLOYEE CRUD PERMISSIONS
══════════════════════════════════════════════════════════════════════ */
exports.canCreateEmployee = (user) => {
  const p = getAccessProfile(user);
  return p.is.superAdmin || p.is.admin || p.is.hrd || p.is.techLead || p.is.cmo || p.is.cto;
};

exports.canUpdateEmployee = (user, target) => {
  const p          = getAccessProfile(user);
  const targetRole = norm(target.role || "");
  const targetTeam = norm(target.team_name || "");

  if (p.is.superAdmin || p.is.admin) return true;
  if (String(user.emp_id) === String(target.emp_id)) return true;
  if (p.is.hrd && !["ADMIN", "SUPER_ADMIN"].includes(targetRole)) return true;
  if (p.is.techLead && num(user.zone_id) === num(target.zone_id) && targetTeam === "TECHNICAL") return true;
  if (p.is.cto && !["ADMIN", "SUPER_ADMIN"].includes(targetRole) && targetTeam === "TECHNICAL") return true;
  if (p.is.cmo && targetTeam === "SALES") return true;
  if (p.is.branchIC &&
      num(user.branch_id) === num(target.branch_id) &&
      num(user.team_id) === num(target.team_id)) return true;
  return false;
};

/* ══════════════════════════════════════════════════════════════════════
   REQUEST CREATION RIGHTS
   All authenticated employees can raise requests.
══════════════════════════════════════════════════════════════════════ */
exports.canRaiseUniformRequest  = () => true;
exports.canRaiseManpowerRequest = (user = {}) => {
  const p = getAccessProfile(user);
  const team = norm(user.team_name || user.team || "");
  const desig = norm(user.designation_name || user.designation || "");

  if (p.is.superAdmin || p.is.admin) return true;
  if (team === "HRD") return true;
  if (HO_DEPTS.has(team) && MANPOWER_HO_DESIG.includes(desig)) return true;
  if (team === "TECHNICAL" && MANPOWER_TECH_DESIG.includes(desig)) return true;
  if (team === "SALES" && MANPOWER_SALES_DESIG.includes(desig)) return true;
  return false;
};

/* ══════════════════════════════════════════════════════════════════════
   MASTER DATA MANAGEMENT
══════════════════════════════════════════════════════════════════════ */
exports.canManageMasterData     = (user) => ["SUPER_ADMIN", "ADMIN"].includes(norm(user.role));
exports.canManageAllRequestCrud = (user) => ["SUPER_ADMIN", "ADMIN"].includes(norm(user.role));

/* ══════════════════════════════════════════════════════════════════════
   BACKWARD-COMPATIBLE SCOPE EXPORTS
   These delegate to getDataVisibility() so old controllers still work
   without any changes.
══════════════════════════════════════════════════════════════════════ */
exports.getUniformVisibilityScope = (user) => {
  const v = getDataVisibility(user, "uniform");
  return {
    fullAccess: v.fullAccess,
    selfOnly:   v.selfOnly,
    branchIds:  v.branchIds,
    zoneIds:    v.zoneIds,
    teamNames:  v.teamNames,
  };
};

exports.getManpowerVisibilityScope = (user) => {
  const v = getDataVisibility(user, "manpower");
  return {
    fullAccess:      v.fullAccess,
    selfOnly:        v.selfOnly,
    departmentNames: v.departmentNames,
    zoneIds:         v.zoneIds,
    branchIds:       v.branchIds,
  };
};

/* ══════════════════════════════════════════════════════════════════════
   EXPRESS MIDDLEWARE HELPERS
══════════════════════════════════════════════════════════════════════ */
exports.requireRole = (...roles) => (req, res, next) => {
  if (roles.map(norm).includes(norm(req.user.role))) return next();
  return res.status(403).json({ message: "Access denied: insufficient role" });
};

exports.requireAdminOrHRD = (req, res, next) => {
  const p = getAccessProfile(req.user);
  if (p.is.superAdmin || p.is.admin || p.is.hrd) return next();
  return res.status(403).json({ message: "HRD or Admin access required" });
};

exports.canAccessPayslipModule = (req, res, next) => {
  if (req.user) return next();
  return res.status(403).json({ message: "Payslip access denied" });
};

exports.requireCan = (capability) => (req, res, next) => {
  const p = getAccessProfile(req.user);
  if (p.can[capability]) return next();
  return res.status(403).json({ message: `Access denied: '${capability}' permission required` });
};


