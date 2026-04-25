const jwt = require("jsonwebtoken");
const db  = require("../config/db");

/* ═══════════════════════════════════════════════════════════════════════
   AUTH MIDDLEWARE  —  middleware/auth.js

   KEY FIX: employees.zone_id was dropped from the schema.
   Zone is now derived via: employees.branch_id → branches.zone_id → zones.

   req.user shape:
   ┌─ Identity ────────────────────────────────────────────────────────┐
   │  emp_id, name, role, status                                       │
   │  team_id, team_name                                               │
   │  designation_id, designation_name, designation_level             │
   ├─ Primary location (zone derived from primary branch) ─────────────┤
   │  branch_id, branch_name                                           │
   │  zone_id, zone_name      ← from branches.zone_id, NOT employees  │
   ├─ Branch access arrays ────────────────────────────────────────────┤
   │  primary_branch_id   — employees.branch_id                       │
   │  primary_zone_id     — zone_id of primary branch                 │
   │                                                                   │
   │  crm_branch_ids      — ONLY: access_type='CRM' AND module='CRM' │
   │  crm_branch_names    — names of CRM branches                     │
   │  crm_zone_ids        — zone IDs of CRM branches                  │
   │                                                                   │
   │  all_branch_ids      — every row in employee_branches            │
   │  all_branch_names    — all branch names in employee_branches      │
   └───────────────────────────────────────────────────────────────────┘

   CRITICAL SCOPING RULES (enforced in access.js):
   • Branch Incharge → [primary_branch_id] + crm_branch_ids ONLY
   • Tech Lead       → [primary_branch_id] + crm_branch_ids
   • ASM             → own primary_zone_id + crm_branch_ids
   • crm_branch_ids  → strict: access_type='CRM' AND module='CRM' only
═══════════════════════════════════════════════════════════════════════ */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* ── Core employee profile (zone derived from branch) ── */
    const [[user]] = await db.query(
      `SELECT
         e.emp_id,
         e.name,
         e.role,
         e.status,
         e.branch_id,
         e.team_id,
         e.designation_id,
         b.branch_name,
         b.zone_id,
         z.zone_name,
         t.team_name,
         d.designation_name,
         d.level AS designation_level
       FROM employees e
       LEFT JOIN branches     b ON e.branch_id      = b.id
       LEFT JOIN zones        z ON b.zone_id         = z.id
       LEFT JOIN teams        t ON e.team_id         = t.id
       LEFT JOIN designations d ON e.designation_id  = d.id
       WHERE e.emp_id = ?`,
      [decoded.emp_id]
    );

    if (!user) return res.status(401).json({ message: "User not found" });

    if (user.status !== "ACTIVE" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Account inactive" });
    }

    /* ── All branch access rows from employee_branches ── */
    const [branchRows] = await db.query(
      `SELECT
         eb.branch_id,
         eb.access_type,
         eb.module,
         b.branch_name,
         b.zone_id,
         z.zone_name
       FROM employee_branches eb
       INNER JOIN branches b ON eb.branch_id = b.id
       LEFT JOIN  zones    z ON b.zone_id    = z.id
       WHERE eb.emp_id = ?`,
      [decoded.emp_id]
    );

    /* ── CRM-only rows (strictly access_type='CRM' AND module='CRM') ── */
    const crmRows = branchRows.filter(
      r => String(r.access_type).toUpperCase() === "CRM" &&
           String(r.module).toUpperCase() === "CRM"
    );

    /* Primary location anchors */
    user.primary_branch_id = Number(user.branch_id) || null;
    user.primary_zone_id   = Number(user.zone_id)   || null;

    /* CRM-granted branches (strict) */
    user.crm_branch_ids   = [...new Set(crmRows.map(r => Number(r.branch_id)).filter(Boolean))];
    user.crm_branch_names = crmRows.map(r => r.branch_name);
    user.crm_zone_ids     = [...new Set(crmRows.map(r => Number(r.zone_id)).filter(Boolean))];

    /* All entries (used only by ADMIN/MD/CEO-level logic) */
    user.all_branch_ids   = [...new Set(branchRows.map(r => Number(r.branch_id)).filter(Boolean))];
    user.all_branch_names = branchRows.map(r => r.branch_name);

    req.user = user;
    next();

  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
