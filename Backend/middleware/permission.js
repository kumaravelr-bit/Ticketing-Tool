const db = require("../config/db");
const { getAccessProfile } = require("./access");

const normalize = (v = "") => String(v).trim().toUpperCase();

/* ═══════════════════════════════════════════════════════════════════════
   PERMISSION MIDDLEWARE  —  middleware/permission.js

   Derives implicit permissions from hierarchy (no DB hit needed for
   most roles). Falls back to employee_permissions table for explicit
   grants.

   Usage:
     router.post("/employees", auth, permit("EMP_CREATE"), handler)
     router.get("/analytics",  auth, permit("ANALYTICS_VIEW"), handler)

   Implicit permission matrix:
   ┌──────────────────┬──────────────────────────────────────────────────┐
   │ Role/Designation │ Permissions                                      │
   ├──────────────────┼──────────────────────────────────────────────────┤
   │ SUPER_ADMIN      │ ALL (bypasses check)                             │
   │ ADMIN            │ EMP_*, BRANCH_*, ZONE_*, TEAM_*, REQUEST_*, etc │
   │ MD / CEO         │ EMP_VIEW, REQUEST_*, ANALYTICS_VIEW              │
   │ CTO              │ EMP_*, REQUEST_*, ANALYTICS_VIEW                 │
   │ CMO/SALES HEAD   │ EMP_*, REQUEST_*, ANALYTICS_VIEW                 │
   │ HRD team         │ EMP_*, REQUEST_* (HR stage)                      │
   │ IT team          │ EMP_VIEW, REQUEST_VIEW                           │
   │ MIS/VENDOR       │ EMP_VIEW, REQUEST_VIEW, REQUEST_EXPORT           │
   │ TECH LEAD        │ EMP_*, REQUEST_* (within zone)                   │
   │ ASM              │ EMP_VIEW, REQUEST_* (within zone)                │
   │ BRANCH INCHARGE  │ EMP_*, REQUEST_* (own branch)                    │
   │ Others           │ REQUEST_VIEW only                                │
   └──────────────────┴──────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════════════════ */

function getImplicitPermissions(user) {
  const p       = getAccessProfile(user);
  const implicit = new Set();

  /* SUPER_ADMIN: handled separately, this is never reached */
  if (p.is.superAdmin) return implicit;

  /* ── ADMIN ── */
  if (p.is.admin) {
    [
      "EMP_CREATE", "EMP_UPDATE", "EMP_VIEW", "EMP_DEACTIVATE",
      "BRANCH_VIEW", "BRANCH_CREATE", "BRANCH_UPDATE",
      "ZONE_VIEW", "ZONE_CREATE", "ZONE_UPDATE",
      "TEAM_VIEW", "TEAM_CREATE", "TEAM_UPDATE",
      "DESIGNATION_VIEW", "DESIGNATION_CREATE", "DESIGNATION_UPDATE",
      "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT",
      "ANALYTICS_VIEW", "MASTER_DATA_MANAGE", "USER_MANAGE",
    ].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── MD / CEO ── */
  if (p.is.mdOrCEO) {
    ["EMP_VIEW", "BRANCH_VIEW", "ZONE_VIEW", "REQUEST_VIEW",
     "REQUEST_APPROVE", "REQUEST_EXPORT", "ANALYTICS_VIEW"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── CTO ── */
  if (p.is.cto) {
    ["EMP_VIEW",
     "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT", "ANALYTICS_VIEW"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── CMO / SALES HEAD ── */
  if (p.is.cmo) {
    ["EMP_VIEW",
     "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT", "ANALYTICS_VIEW"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── HRD ── */
  if (p.is.hrd) {
    ["EMP_VIEW",
     "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── IT ── */
  if (p.is.it) {
    ["EMP_VIEW", "REQUEST_VIEW"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── MIS / VENDOR COORDINATOR ── */
  if (p.is.misDesk) {
    ["EMP_VIEW", "REQUEST_VIEW", "REQUEST_EXPORT"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── TECH LEAD ── */
  if (p.is.techLead) {
    ["EMP_VIEW",
     "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── ASM ── */
  if (p.is.asm) {
    ["EMP_VIEW", "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── BRANCH INCHARGE ── */
  if (p.is.branchIC) {
    ["EMP_VIEW",
     "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── HO Dept Manager / Asst Manager ── */
  if (p.is.hoDeptMgr) {
    ["EMP_VIEW", "REQUEST_VIEW", "REQUEST_APPROVE", "REQUEST_EXPORT"].forEach(p => implicit.add(p));
    return implicit;
  }

  /* ── Everyone else: basic request view ── */
  implicit.add("REQUEST_VIEW");
  return implicit;
}

/* ═══════════════════════════════════════════════════════════════════════
   PERMISSION MIDDLEWARE
═══════════════════════════════════════════════════════════════════════ */
module.exports = (permission) => async (req, res, next) => {
  try {
    /* SUPER_ADMIN always passes */
    if (req.user.role === "SUPER_ADMIN") return next();

    /* Check implicit permissions first (no DB hit) */
    const implicitPerms = getImplicitPermissions(req.user);
    if (implicitPerms.has(normalize(permission))) return next();

    /* Fallback: check explicit grants in DB */
    const [rows] = await db.query(
      `SELECT p.permission_key
       FROM employee_permissions ep
       JOIN permissions p ON ep.permission_id = p.id
       WHERE ep.emp_id = ?`,
      [req.user.emp_id]
    );

    const dbPerms = new Set(rows.map(r => normalize(r.permission_key)));
    if (dbPerms.has(normalize(permission))) return next();

    return res.status(403).json({
      message: `Permission denied: '${permission}' required`,
    });
  } catch (err) {
    console.error("Permission check error:", err);
    return res.status(500).json({ message: "Permission check failed" });
  }
};

module.exports.getImplicitPermissions = getImplicitPermissions;


