const db     = require("../config/db");
const bcrypt = require("bcrypt");
const fs     = require("fs");
const path   = require("path");
const {
  getEmployeeScope,
  buildEmployeeWhereClause,
  canCreateEmployee,
  canUpdateEmployee,
} = require("../middleware/access");
const { runTriggerStatement } = require("../utils/mysqlTriggerSupport");

const UPLOAD_DIR = path.join(__dirname, "../uploads/profile");

const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

const dedup = (arr) => [...new Set(arr.map(Number).filter(Boolean))];
const normalizeBranchAccessIds = (arr) => dedup(arr);
let employeeHierarchyTriggersEnsured = false;

const hasColumn = async (conn, tableName, columnName) => {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
};

const hasTable = async (conn, tableName) => {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
};

const ensureEmployeeHierarchySchema = async (conn) => {
  const managerScopeExists = await hasColumn(conn, "designations", "manager_scope");
  if (!managerScopeExists) {
    try {
      await conn.query(`
        ALTER TABLE designations
        ADD COLUMN manager_scope ENUM(
          'NONE',
          'TEAM',
          'BRANCH',
          'ZONE',
          'GLOBAL'
        ) NOT NULL DEFAULT 'NONE' AFTER is_manager
      `);
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }
  }

  const rulesTableExists = await hasTable(conn, "designation_reporting_rules");
  if (!rulesTableExists) {
    try {
      await conn.query(`
        CREATE TABLE designation_reporting_rules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          child_designation_id INT NOT NULL,
          parent_designation_id INT NOT NULL,
          same_team_only TINYINT(1) NOT NULL DEFAULT 0,
          same_branch_only TINYINT(1) NOT NULL DEFAULT 0,
          same_zone_only TINYINT(1) NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_designation_rule (child_designation_id, parent_designation_id),
          INDEX idx_drr_child (child_designation_id),
          INDEX idx_drr_parent (parent_designation_id),
          CONSTRAINT fk_drr_child
            FOREIGN KEY (child_designation_id) REFERENCES designations(id)
            ON DELETE CASCADE,
          CONSTRAINT fk_drr_parent
            FOREIGN KEY (parent_designation_id) REFERENCES designations(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    } catch (error) {
      if (!["ER_TABLE_EXISTS_ERROR", "ER_FK_DUP_NAME"].includes(error.code)) {
        throw error;
      }
    }
  }

  const scopeOwnerTableExists = await hasTable(conn, "scope_owner_mapping");
  if (!scopeOwnerTableExists) {
    try {
      await conn.query(`
        CREATE TABLE scope_owner_mapping (
          id INT AUTO_INCREMENT PRIMARY KEY,
          team_id INT NULL,
          zone_id INT NULL,
          branch_id INT NULL,
          designation_id INT NOT NULL,
          employee_id INT NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_scope_owner (team_id, zone_id, branch_id, designation_id),
          INDEX idx_scope_owner_designation (designation_id),
          INDEX idx_scope_owner_employee (employee_id),
          INDEX idx_scope_owner_team (team_id),
          INDEX idx_scope_owner_zone (zone_id),
          INDEX idx_scope_owner_branch (branch_id),
          CONSTRAINT fk_scope_owner_team
            FOREIGN KEY (team_id) REFERENCES teams(id)
            ON DELETE SET NULL,
          CONSTRAINT fk_scope_owner_zone
            FOREIGN KEY (zone_id) REFERENCES zones(id)
            ON DELETE SET NULL,
          CONSTRAINT fk_scope_owner_branch
            FOREIGN KEY (branch_id) REFERENCES branches(id)
            ON DELETE SET NULL,
          CONSTRAINT fk_scope_owner_designation
            FOREIGN KEY (designation_id) REFERENCES designations(id)
            ON DELETE CASCADE,
          CONSTRAINT fk_scope_owner_employee
            FOREIGN KEY (employee_id) REFERENCES employees(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    } catch (error) {
      if (!["ER_TABLE_EXISTS_ERROR", "ER_FK_DUP_NAME"].includes(error.code)) {
        throw error;
      }
    }
  }
};

const MANAGER_FALLBACK_PRIORITY = [
  "BRANCH INCHARGE",
  "TECH LEAD",
  "ASM",
  "CMO",
  "SALES HEAD",
  "MANAGER",
  "CTO",
  "CEO",
  "MD",
];

const GLOBAL_MANAGER_DESIGNATIONS = new Set([
  "CTO",
  "CEO",
  "MD",
  "CMO",
  "SALES HEAD",
]);

const CROSS_TEAM_MANAGER_DESIGNATIONS = new Set([
  "MANAGER",
  "ASST MANAGER",
  "ASSISTANT MANAGER",
]);

const ZONE_MANAGER_DESIGNATIONS = new Set([
  "TECH LEAD",
  "ASST TECH LEAD",
  "ASM",
]);

const getManagerPriorityRank = (designationName) => {
  const normalized = String(designationName || "").trim().toUpperCase();
  const index = MANAGER_FALLBACK_PRIORITY.indexOf(normalized);
  return index === -1 ? 999 : index;
};

const isGlobalManagerDesignation = (designationName, managerScope) => {
  const normalized = String(designationName || "").trim().toUpperCase();
  return managerScope === "GLOBAL" || GLOBAL_MANAGER_DESIGNATIONS.has(normalized);
};

const isCrossTeamManagerDesignation = (designationName) => {
  const normalized = String(designationName || "").trim().toUpperCase();
  return CROSS_TEAM_MANAGER_DESIGNATIONS.has(normalized);
};

const isZoneManagerDesignation = (designationName) => {
  const normalized = String(designationName || "").trim().toUpperCase();
  return ZONE_MANAGER_DESIGNATIONS.has(normalized);
};

const ensureEmployeeHierarchyTriggers = async (conn) => {
  if (employeeHierarchyTriggersEnsured) return;

  await runTriggerStatement(
    conn,
    "DROP TRIGGER IF EXISTS validate_manager_hierarchy",
    "employee hierarchy trigger cleanup"
  );
  await runTriggerStatement(
    conn,
    "DROP TRIGGER IF EXISTS validate_manager_hierarchy_update",
    "employee hierarchy trigger cleanup"
  );

  await runTriggerStatement(conn, `
    CREATE TRIGGER validate_manager_hierarchy
    BEFORE INSERT ON employees
    FOR EACH ROW
    BEGIN
      DECLARE manager_designation_id INT;
      DECLARE manager_team_id INT;
      DECLARE manager_branch_id INT;
      DECLARE manager_zone_id INT;
      DECLARE manager_role VARCHAR(50);
      DECLARE manager_designation_name VARCHAR(120);
      DECLARE employee_level INT;
      DECLARE manager_level INT;
      DECLARE manager_is_manager TINYINT(1);
      DECLARE manager_scope_value VARCHAR(20);
      DECLARE allowed_count INT DEFAULT 0;
      DECLARE manual_fallback_allowed INT DEFAULT 0;

      IF NEW.manager_id IS NOT NULL THEN
        SELECT
          e.designation_id,
          e.team_id,
          e.branch_id,
          e.zone_id,
          e.role,
          d.designation_name,
          d.level,
          d.is_manager,
          d.manager_scope
        INTO
          manager_designation_id,
          manager_team_id,
          manager_branch_id,
          manager_zone_id,
          manager_role,
          manager_designation_name,
          manager_level,
          manager_is_manager,
          manager_scope_value
        FROM employees e
        JOIN designations d ON d.id = e.designation_id
        WHERE e.id = NEW.manager_id
        LIMIT 1;

        SELECT d.level
        INTO employee_level
        FROM designations d
        WHERE d.id = NEW.designation_id
        LIMIT 1;

        IF manager_designation_id IS NULL THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Selected manager not found';
        END IF;

        IF manager_is_manager <> 1 AND manager_role NOT IN ('SUPER_ADMIN', 'ADMIN') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Selected manager designation is not marked as manager';
        END IF;

        IF manager_level <= employee_level AND manager_role NOT IN ('SUPER_ADMIN', 'ADMIN') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Manager must have higher designation level';
        END IF;

        SELECT COUNT(*)
        INTO allowed_count
        FROM designation_reporting_rules r
        WHERE r.child_designation_id = NEW.designation_id
          AND r.parent_designation_id = manager_designation_id
          AND r.is_active = 1
          AND (
            r.same_team_only = 0
            OR manager_team_id = NEW.team_id
            OR manager_scope_value = 'GLOBAL'
            OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
            OR (
              r.same_team_only = 1
              AND UPPER(manager_designation_name) IN ('MANAGER', 'ASST MANAGER', 'ASSISTANT MANAGER')
              AND manager_branch_id = NEW.branch_id
            )
          )
          AND (
            r.same_branch_only = 0
            OR manager_branch_id = NEW.branch_id
            OR manager_scope_value = 'GLOBAL'
            OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
          )
          AND (
            r.same_zone_only = 0
            OR manager_zone_id = NEW.zone_id
            OR manager_scope_value = 'GLOBAL'
            OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
          );

        IF allowed_count = 0 THEN
          IF manager_scope_value = 'GLOBAL'
             OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
             OR UPPER(manager_designation_name) IN ('CTO', 'CEO', 'MD', 'CMO', 'SALES HEAD') THEN
            SET manual_fallback_allowed = 1;
          ELSEIF UPPER(manager_designation_name) IN ('MANAGER', 'ASST MANAGER', 'ASSISTANT MANAGER')
             AND manager_branch_id = NEW.branch_id THEN
            SET manual_fallback_allowed = 1;
          ELSEIF UPPER(manager_designation_name) IN ('TECH LEAD', 'ASST TECH LEAD', 'ASM')
             AND manager_zone_id = NEW.zone_id THEN
            SET manual_fallback_allowed = 1;
          END IF;
        END IF;

        IF allowed_count = 0 AND manual_fallback_allowed = 0 THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Manager mapping is not allowed for this designation hierarchy';
        END IF;
      END IF;
    END
  `, "employee hierarchy trigger creation");

  await runTriggerStatement(conn, `
    CREATE TRIGGER validate_manager_hierarchy_update
    BEFORE UPDATE ON employees
    FOR EACH ROW
    BEGIN
      DECLARE manager_designation_id INT;
      DECLARE manager_team_id INT;
      DECLARE manager_branch_id INT;
      DECLARE manager_zone_id INT;
      DECLARE manager_role VARCHAR(50);
      DECLARE manager_designation_name VARCHAR(120);
      DECLARE employee_level INT;
      DECLARE manager_level INT;
      DECLARE manager_is_manager TINYINT(1);
      DECLARE manager_scope_value VARCHAR(20);
      DECLARE allowed_count INT DEFAULT 0;
      DECLARE manual_fallback_allowed INT DEFAULT 0;

      IF NEW.manager_id IS NOT NULL THEN
        SELECT
          e.designation_id,
          e.team_id,
          e.branch_id,
          e.zone_id,
          e.role,
          d.designation_name,
          d.level,
          d.is_manager,
          d.manager_scope
        INTO
          manager_designation_id,
          manager_team_id,
          manager_branch_id,
          manager_zone_id,
          manager_role,
          manager_designation_name,
          manager_level,
          manager_is_manager,
          manager_scope_value
        FROM employees e
        JOIN designations d ON d.id = e.designation_id
        WHERE e.id = NEW.manager_id
        LIMIT 1;

        SELECT d.level
        INTO employee_level
        FROM designations d
        WHERE d.id = NEW.designation_id
        LIMIT 1;

        IF manager_designation_id IS NULL THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Selected manager not found';
        END IF;

        IF manager_is_manager <> 1 AND manager_role NOT IN ('SUPER_ADMIN', 'ADMIN') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Selected manager designation is not marked as manager';
        END IF;

        IF manager_level <= employee_level AND manager_role NOT IN ('SUPER_ADMIN', 'ADMIN') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Manager must have higher designation level';
        END IF;

        SELECT COUNT(*)
        INTO allowed_count
        FROM designation_reporting_rules r
        WHERE r.child_designation_id = NEW.designation_id
          AND r.parent_designation_id = manager_designation_id
          AND r.is_active = 1
          AND (
            r.same_team_only = 0
            OR manager_team_id = NEW.team_id
            OR manager_scope_value = 'GLOBAL'
            OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
            OR (
              r.same_team_only = 1
              AND UPPER(manager_designation_name) IN ('MANAGER', 'ASST MANAGER', 'ASSISTANT MANAGER')
              AND manager_branch_id = NEW.branch_id
            )
          )
          AND (
            r.same_branch_only = 0
            OR manager_branch_id = NEW.branch_id
            OR manager_scope_value = 'GLOBAL'
            OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
          )
          AND (
            r.same_zone_only = 0
            OR manager_zone_id = NEW.zone_id
            OR manager_scope_value = 'GLOBAL'
            OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
          );

        IF allowed_count = 0 THEN
          IF manager_scope_value = 'GLOBAL'
             OR manager_role IN ('SUPER_ADMIN', 'ADMIN')
             OR UPPER(manager_designation_name) IN ('CTO', 'CEO', 'MD', 'CMO', 'SALES HEAD') THEN
            SET manual_fallback_allowed = 1;
          ELSEIF UPPER(manager_designation_name) IN ('MANAGER', 'ASST MANAGER', 'ASSISTANT MANAGER')
             AND manager_branch_id = NEW.branch_id THEN
            SET manual_fallback_allowed = 1;
          ELSEIF UPPER(manager_designation_name) IN ('TECH LEAD', 'ASST TECH LEAD', 'ASM')
             AND manager_zone_id = NEW.zone_id THEN
            SET manual_fallback_allowed = 1;
          END IF;
        END IF;

        IF allowed_count = 0 AND manual_fallback_allowed = 0 THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Manager mapping is not allowed for this designation hierarchy';
        END IF;
      END IF;
    END
  `, "employee hierarchy trigger creation");

  employeeHierarchyTriggersEnsured = true;
};

const ensureEmployeeHierarchyRuntime = async (conn) => {
  await ensureEmployeeHierarchySchema(conn);
  await ensureEmployeeHierarchyTriggers(conn);
};

const getParentManagerRules = async (conn, childDesignationId) => {
  const [rows] = await conn.query(
    `SELECT
       r.parent_designation_id,
       r.same_team_only,
       r.same_branch_only,
       r.same_zone_only,
       d.designation_name,
       d.level,
       d.manager_scope
     FROM designation_reporting_rules r
     INNER JOIN designations d
       ON d.id = r.parent_designation_id
     WHERE r.child_designation_id = ?
       AND r.is_active = 1`,
    [childDesignationId]
  );

  return rows.sort((a, b) => {
    const priorityDiff =
      getManagerPriorityRank(a.designation_name) - getManagerPriorityRank(b.designation_name);
    if (priorityDiff !== 0) return priorityDiff;
    if ((a.level || 0) !== (b.level || 0)) return (a.level || 0) - (b.level || 0);
    return (a.parent_designation_id || 0) - (b.parent_designation_id || 0);
  });
};

const findScopeOwnerEmployee = async (conn, { parentDesignationId, rule, teamId, branchId, zoneId }) => {
  const [rows] = await conn.query(
    `SELECT
       som.employee_id,
       d.designation_name,
       d.manager_scope
     FROM scope_owner_mapping som
     INNER JOIN employees e
       ON e.id = som.employee_id
      AND e.status = 'ACTIVE'
     INNER JOIN designations d
       ON d.id = som.designation_id
     WHERE som.designation_id = ?
       AND som.is_active = 1
       AND (? = 0 OR som.team_id = ?)
       AND (? = 0 OR som.branch_id = ?)
       AND (? = 0 OR som.zone_id = ?)
     ORDER BY
       (som.branch_id IS NOT NULL) DESC,
       (som.zone_id IS NOT NULL) DESC,
       (som.team_id IS NOT NULL) DESC,
       som.id ASC
     LIMIT 1`,
    [
      parentDesignationId,
      Number(rule.same_team_only) || 0,
      teamId || null,
      Number(rule.same_branch_only) || 0,
      branchId || null,
      Number(rule.same_zone_only) || 0,
      zoneId || null,
    ]
  );

  if (rows[0]?.employee_id) return rows[0].employee_id;

  if (Number(rule.same_team_only) === 1 && isCrossTeamManagerDesignation(rule.designation_name)) {
    const [crossTeamRows] = await conn.query(
      `SELECT som.employee_id
       FROM scope_owner_mapping som
       INNER JOIN employees e
         ON e.id = som.employee_id
        AND e.status = 'ACTIVE'
       WHERE som.designation_id = ?
         AND som.is_active = 1
         AND (? IS NULL OR som.branch_id = ? OR som.branch_id IS NULL)
         AND (? IS NULL OR som.zone_id = ? OR som.zone_id IS NULL)
       ORDER BY
         (som.branch_id = ?) DESC,
         (som.zone_id = ?) DESC,
         (som.team_id IS NOT NULL) DESC,
         som.id ASC
       LIMIT 1`,
      [
        parentDesignationId,
        branchId || null,
        branchId || null,
        zoneId || null,
        zoneId || null,
        branchId || null,
        zoneId || null,
      ]
    );

    if (crossTeamRows[0]?.employee_id) {
      return crossTeamRows[0].employee_id;
    }
  }

  if (isZoneManagerDesignation(rule.designation_name)) {
    const [zoneRows] = await conn.query(
      `SELECT som.employee_id
       FROM scope_owner_mapping som
       INNER JOIN employees e
         ON e.id = som.employee_id
        AND e.status = 'ACTIVE'
       WHERE som.designation_id = ?
         AND som.is_active = 1
         AND (? IS NULL OR som.zone_id = ? OR som.zone_id IS NULL)
       ORDER BY
         (som.zone_id = ?) DESC,
         (som.branch_id IS NULL) DESC,
         som.id ASC
       LIMIT 1`,
      [
        parentDesignationId,
        zoneId || null,
        zoneId || null,
        zoneId || null,
      ]
    );

    if (zoneRows[0]?.employee_id) {
      return zoneRows[0].employee_id;
    }
  }

  if (!isGlobalManagerDesignation(rule.designation_name, rule.manager_scope)) {
    return null;
  }

  const [globalRows] = await conn.query(
    `SELECT som.employee_id
     FROM scope_owner_mapping som
     INNER JOIN employees e
       ON e.id = som.employee_id
      AND e.status = 'ACTIVE'
     WHERE som.designation_id = ?
       AND som.is_active = 1
     ORDER BY
       (som.branch_id IS NULL) DESC,
       (som.zone_id IS NULL) DESC,
       (som.team_id IS NULL) DESC,
       som.id ASC
     LIMIT 1`,
    [parentDesignationId]
  );

  return globalRows[0]?.employee_id || null;
};

const resolveAutoManagerId = async (conn, { teamId, branchId, zoneId, designationId }) => {
  if (!designationId) return null;

  await ensureEmployeeHierarchyRuntime(conn);

  const visited = new Set();

  const resolveFromDesignation = async (childDesignationId) => {
    if (!childDesignationId || visited.has(childDesignationId)) return null;
    visited.add(childDesignationId);

    const parentRules = await getParentManagerRules(conn, childDesignationId);

    for (const rule of parentRules) {
      const directOwnerId = await findScopeOwnerEmployee(conn, {
        parentDesignationId: rule.parent_designation_id,
        rule,
        teamId,
        branchId,
        zoneId,
      });

      if (directOwnerId) {
        return directOwnerId;
      }

      const higherOwnerId = await resolveFromDesignation(rule.parent_designation_id);
      if (higherOwnerId) {
        return higherOwnerId;
      }
    }

    return null;
  };

  return resolveFromDesignation(Number(designationId));
};

/* ═══════════════════════════════════════════════════════
   SHARED: base employee SELECT query
   Used by getActiveEmployees, getRelievedEmployees, exportEmployees.
   Returns a full column list suitable for display and CSV export.
═══════════════════════════════════════════════════════ */
function buildEmployeeBaseFromSql() {
  return `
    FROM employees e
    LEFT JOIN zones        z ON e.zone_id        = z.id
    LEFT JOIN branches     b ON e.branch_id      = b.id
    LEFT JOIN teams        t ON e.team_id        = t.id
    LEFT JOIN designations d ON e.designation_id = d.id
  `;
}

function buildBaseEmployeeSql() {
  return `
    SELECT
      e.emp_id,
      e.name,
      e.email,
      e.phone,
      e.emergency_contact,
      e.gender,
      e.dob,
      e.joining_date,
      e.joining_status,
      e.marital_status,
      e.experience,
      e.qualification,
      e.role,
      e.status,
      e.zone_id,
      e.branch_id,
      e.team_id,
      e.permanent_address,
      e.temporary_address,
      z.zone_name,
      b.branch_name,
      t.team_name,
      d.designation_name,
      e.created_at
    ${buildEmployeeBaseFromSql()}
  `;
}

function getPaginationOptions(query = {}, defaultLimit = 25, maxLimit = 100) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), maxLimit);
  const offset = (page - 1) * limit;
  const paginate = "page" in query || "limit" in query;
  return { page, limit, offset, paginate };
}

async function fetchEmployeeListing({ req, statusCondition, countLabel }) {
  const scope  = getEmployeeScope(req.user);
  const params = [];
  let whereSql = ` WHERE ${statusCondition}`;

  whereSql += buildEmployeeWhereClause(scope, params, "e", req.user.emp_id);
  whereSql += applyFilters(req.query, params);

  const { page, limit, offset, paginate } = getPaginationOptions(req.query);
  const orderSql = " ORDER BY e.created_at DESC";

  if (!paginate) {
    const [rows] = await db.query(
      buildBaseEmployeeSql() + whereSql + orderSql + " LIMIT 500",
      params
    );
    return rows;
  }

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total ${buildEmployeeBaseFromSql()} ${whereSql}`,
    params
  );

  const [rows] = await db.query(
    buildBaseEmployeeSql() + whereSql + orderSql + " LIMIT ? OFFSET ?",
    [...params, limit, offset]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      hasNextPage: offset + rows.length < total,
      hasPreviousPage: page > 1,
      countLabel,
    },
  };
}

/* ═══════════════════════════════════════════════════════
   GET MANAGERS
═══════════════════════════════════════════════════════ */
exports.getManagers = async (req, res) => {
  try {
    const { designation_id, zone_id } = req.query;
    if (!designation_id) return res.json([]);

    const [[current]] = await db.query(
      "SELECT level FROM designations WHERE id = ?",
      [designation_id]
    );
    if (!current) return res.json([]);

    const params = [current.level];
    let sql = `
      SELECT
        e.id, e.emp_id, e.name, e.role,
        d.level, d.designation_name,
        t.team_name, z.zone_name
      FROM employees e
      LEFT JOIN designations d ON e.designation_id = d.id
      LEFT JOIN teams        t ON e.team_id        = t.id
      LEFT JOIN zones        z ON e.zone_id        = z.id
      WHERE e.status = 'ACTIVE'
        AND (e.role IN ('SUPER_ADMIN','ADMIN') OR d.level > ?)
    `;

    if (zone_id) {
      sql += ` ORDER BY (e.zone_id = ?) DESC, e.role ASC, d.level DESC`;
      params.push(Number(zone_id));
    } else {
      sql += ` ORDER BY e.role ASC, d.level DESC`;
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("getManagers:", err);
    res.status(500).json({ message: "Failed to load managers" });
  }
};

/* ═══════════════════════════════════════════════════════
   CREATE EMPLOYEE
═══════════════════════════════════════════════════════ */
exports.createEmployee = async (req, res) => {
  const conn = await db.getConnection();
  try {
    if (!canCreateEmployee(req.user)) {
      return res.status(403).json({ message: "Not authorised to create employees" });
    }

    await conn.beginTransaction();
    await ensureEmployeeHierarchyRuntime(conn);
    ensureUploadDir();

    let {
      joining_status, name, father_name, gender, email,
      dob, joining_date, phone, emergency_contact,
      marital_status, experience, qualification,
      permanent_address, temporary_address,
      team_id, designation_id, manager_id, zone_id, role,
      primary_branch_id,
      crm_branch_ids    = "[]",
      ticket_branch_ids = "[]",
      area_ids          = "[]",
    } = req.body;

    if (typeof crm_branch_ids    === "string") crm_branch_ids    = JSON.parse(crm_branch_ids);
    if (typeof ticket_branch_ids === "string") ticket_branch_ids = JSON.parse(ticket_branch_ids);
    if (typeof area_ids          === "string") area_ids          = JSON.parse(area_ids);

    const crmBranches    = normalizeBranchAccessIds(crm_branch_ids);
    const ticketBranches = normalizeBranchAccessIds(ticket_branch_ids);
    const areaIds        = dedup(area_ids);
    const effectiveManagerId =
      Number(manager_id) || (await resolveAutoManagerId(conn, {
        teamId: Number(team_id) || null,
        branchId: Number(primary_branch_id) || null,
        zoneId: Number(zone_id) || null,
        designationId: Number(designation_id) || null,
      }));

    if (!name || !email || !dob || !primary_branch_id) {
      return res.status(400).json({ message: "Name, email, DOB and primary branch are required" });
    }

    if (req.user.role !== "SUPER_ADMIN" && ["ADMIN","SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({ message: "Only SUPER_ADMIN can assign this role" });
    }

    const prefix = joining_status === "TRAINEE" ? "T" : "ICEEMP";
    const [last] = await conn.query(
      "SELECT emp_id FROM employees WHERE emp_id LIKE ? ORDER BY id DESC LIMIT 1",
      [`${prefix}%`]
    );
    const next   = last.length ? parseInt(last[0].emp_id.replace(prefix, "")) + 1 : 1;
    const padded = String(next).padStart(4, "0");
    const emp_id = `${prefix}${padded}`;

    let profilePhotoName = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (![".jpg",".jpeg",".png"].includes(ext)) throw new Error("Invalid file type");
      profilePhotoName = `${emp_id}${ext}`;
    }

    const rawPassword = `Info@${padded}`;
    const hash        = await bcrypt.hash(rawPassword, 10);

    await conn.query(
      `INSERT INTO employees (
         emp_id, joining_status, name, father_name, gender,
         email, password, dob, joining_date,
         phone, emergency_contact, marital_status, experience,
         qualification, permanent_address, temporary_address,
         role, team_id, designation_id, manager_id,
         branch_id, zone_id, profile_photo
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        emp_id, joining_status || "TRAINEE",
        name, father_name || null, gender || null,
        email, hash, dob, joining_date || null,
        phone || null, emergency_contact || null,
        marital_status || null, experience || null,
        qualification || null,
        permanent_address || null, temporary_address || null,
        role || "USER_ACCOUNT",
        team_id || null, designation_id || null, effectiveManagerId || null,
        primary_branch_id, zone_id || null, profilePhotoName,
      ]
    );

    if (req.file) {
      fs.renameSync(req.file.path, path.join(UPLOAD_DIR, profilePhotoName));
    }

    await conn.query(
      `INSERT INTO employee_branches (emp_id, branch_id, access_type, module)
       VALUES (?, ?, 'PRIMARY', 'ALL')`,
      [emp_id, primary_branch_id]
    );

    for (const b of crmBranches) {
      await conn.query(
        `INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module)
         VALUES (?, ?, 'CRM', 'CRM')`,
        [emp_id, b]
      );
    }

    for (const b of ticketBranches) {
      await conn.query(
        `INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module)
         VALUES (?, ?, 'SUPPORT', 'TICKETING')`,
        [emp_id, b]
      );
      await conn.query(
        `INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module)
         VALUES (?, ?, 'SUPPORT', 'LEAD')`,
        [emp_id, b]
      );
    }

    if (areaIds.length > 0) {
      await conn.query(
        "INSERT IGNORE INTO employee_areas (emp_id, area_id) VALUES ?",
        [areaIds.map(a => [emp_id, a])]
      );
    }

    await assignDefaultPermissions(conn, emp_id, role);
    await conn.commit();

    res.json({ message: "Employee created successfully", emp_id, password: rawPassword });
  } catch (err) {
    await conn.rollback();
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    console.error("createEmployee:", err);
    res.status(500).json({ message: err.message || "Server error" });
  } finally {
    conn.release();
  }
};

async function assignDefaultPermissions(conn, emp_id, role) {
  const map = {
    SUPER_ADMIN:  ["EMP_CREATE","EMP_UPDATE","EMP_DELETE","EMP_VIEW","TICKET_ALL","HRD_ALL","REPORTS_ALL"],
    ADMIN:        ["EMP_CREATE","EMP_UPDATE","EMP_VIEW","TICKET_ALL","HRD_ALL","REPORTS_ALL"],
    USER_ACCOUNT: ["EMP_VIEW","TICKET_CREATE","TICKET_VIEW"],
  };
  const keys = map[role] || map["USER_ACCOUNT"];
  if (!keys.length) return;
  const [rows] = await conn.query(
    `SELECT id FROM permissions WHERE permission_key IN (${keys.map(() => "?").join(",")})`,
    keys
  );
  if (!rows.length) return;
  await conn.query(
    "INSERT IGNORE INTO employee_permissions (emp_id, permission_id) VALUES ?",
    [rows.map(r => [emp_id, r.id])]
  );
}

/* ═══════════════════════════════════════════════════════
   GET EMPLOYEE BY ID
═══════════════════════════════════════════════════════ */
exports.getEmployeeById = async (req, res) => {
  try {
    const [[emp]] = await db.query(
      `SELECT e.*, t.team_name, d.designation_name, z.zone_name, b.branch_name
       FROM employees e
       LEFT JOIN teams        t ON e.team_id        = t.id
       LEFT JOIN designations d ON e.designation_id = d.id
       LEFT JOIN zones        z ON e.zone_id        = z.id
       LEFT JOIN branches     b ON e.branch_id      = b.id
       WHERE e.emp_id = ?`,
      [req.params.empId]
    );
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    ["password","reset_otp","otp_expiry","otp_attempts","otp_last_sent"].forEach(k => delete emp[k]);

    const [branchRows] = await db.query(
      "SELECT branch_id, access_type, module FROM employee_branches WHERE emp_id = ?",
      [req.params.empId]
    );
    const [areaRows] = await db.query(
      "SELECT area_id FROM employee_areas WHERE emp_id = ?",
      [req.params.empId]
    );

    res.json({
      ...emp,
      primary_branch_id: branchRows.find(b => b.access_type === "PRIMARY")?.branch_id ?? emp.branch_id,
      crm_branch_ids: dedup([
        branchRows.find(b => b.access_type === "PRIMARY")?.branch_id ?? emp.branch_id,
        ...branchRows.filter(b => b.access_type === "CRM").map(b => b.branch_id),
      ]),
      ticket_branch_ids: dedup(
        branchRows
          .filter(b => b.access_type === "SUPPORT" && b.module === "TICKETING")
          .map(b => b.branch_id)
      ),
      area_ids:          areaRows.map(a => a.area_id),
    });
  } catch (err) {
    console.error("getEmployeeById:", err);
    res.status(500).json({ message: "Failed to load employee" });
  }
};

/* ═══════════════════════════════════════════════════════
   GET ACTIVE EMPLOYEES  (hierarchy-scoped, NOT branch-access-based)
═══════════════════════════════════════════════════════ */
exports.getActiveEmployees = async (req, res) => {
  try {
    const result = await fetchEmployeeListing({
      req,
      statusCondition: "e.status = 'ACTIVE'",
      countLabel: "activeEmployees",
    });
    res.json(result);
  } catch (err) {
    console.error("getActiveEmployees:", err);
    res.status(500).json({ message: "Failed to load active employees" });
  }
};

/* ═══════════════════════════════════════════════════════
   GET RELIEVED EMPLOYEES
═══════════════════════════════════════════════════════ */
exports.getRelievedEmployees = async (req, res) => {
  try {
    const result = await fetchEmployeeListing({
      req,
      statusCondition: "e.status IN ('RELIEVED','DEACTIVATED')",
      countLabel: "relievedEmployees",
    });
    res.json(result);
  } catch (err) {
    console.error("getRelievedEmployees:", err);
    res.status(500).json({ message: "Failed to load relieved employees" });
  }
};

/* ═══════════════════════════════════════════════════════
   EXPORT ACTIVE EMPLOYEES  →  GET /employee/export/active
   Returns ALL columns (no LIMIT) for CSV export.
   Respects same hierarchy scope as the list view.
═══════════════════════════════════════════════════════ */
exports.exportActiveEmployees = async (req, res) => {
  try {
    const scope  = getEmployeeScope(req.user);
    const params = [];
    let sql = buildBaseEmployeeSql() + " WHERE e.status = 'ACTIVE'";
    sql += buildEmployeeWhereClause(scope, params, "e", req.user.emp_id);
    sql += applyFilters(req.query, params);
    sql += " ORDER BY e.created_at DESC";           // no LIMIT for export

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("exportActiveEmployees:", err);
    res.status(500).json({ message: "Export failed" });
  }
};

/* ═══════════════════════════════════════════════════════
   EXPORT RELIEVED EMPLOYEES  →  GET /employee/export/relieved
═══════════════════════════════════════════════════════ */
exports.exportRelievedEmployees = async (req, res) => {
  try {
    const scope  = getEmployeeScope(req.user);
    const params = [];
    let sql = buildBaseEmployeeSql() + " WHERE e.status IN ('RELIEVED','DEACTIVATED')";
    sql += buildEmployeeWhereClause(scope, params, "e", req.user.emp_id);
    sql += applyFilters(req.query, params);
    sql += " ORDER BY e.created_at DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("exportRelievedEmployees:", err);
    res.status(500).json({ message: "Export failed" });
  }
};

/* ═══════════════════════════════════════════════════════
   GET ALL EMPLOYEES (admin)
═══════════════════════════════════════════════════════ */
exports.getEmployees = async (req, res) => {
  try {
    const [rows] = await db.query(
      buildBaseEmployeeSql() + " ORDER BY e.created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load employees" });
  }
};

/* ═══════════════════════════════════════════════════════
   UPDATE EMPLOYEE
═══════════════════════════════════════════════════════ */
exports.updateEmployee = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureEmployeeHierarchyRuntime(conn);
    ensureUploadDir();

    const oldEmpId   = req.params.empId;
    const callerRole = req.user.role;

    const [[target]] = await conn.query(
      `SELECT e.emp_id, e.role, e.zone_id, e.branch_id, e.team_id, t.team_name
       FROM employees e LEFT JOIN teams t ON e.team_id = t.id
       WHERE e.emp_id = ?`,
      [oldEmpId]
    );
    if (!target) return res.status(404).json({ message: "Employee not found" });
    if (!canUpdateEmployee(req.user, target)) {
      return res.status(403).json({ message: "Not authorised to update this employee" });
    }

    const body = req.body || {};
    let {
      emp_id, name, father_name, gender, email, password,
      phone, emergency_contact, marital_status, qualification,
      permanent_address, temporary_address,
      team_id, designation_id, manager_id, zone_id,
      status, joining_date, joining_status, role, dob,
      primary_branch_id,
      crm_branch_ids    = "[]",
      ticket_branch_ids = "[]",
      area_ids          = "[]",
      remove_photo,
    } = body;

    if (typeof crm_branch_ids    === "string") crm_branch_ids    = JSON.parse(crm_branch_ids);
    if (typeof ticket_branch_ids === "string") ticket_branch_ids = JSON.parse(ticket_branch_ids);
    if (typeof area_ids          === "string") area_ids          = JSON.parse(area_ids);

    const crmBranches    = normalizeBranchAccessIds(crm_branch_ids);
    const ticketBranches = normalizeBranchAccessIds(ticket_branch_ids);
    const areaIds        = dedup(area_ids);
    const effectiveManagerId =
      Number(manager_id) || (await resolveAutoManagerId(conn, {
        teamId: Number(team_id) || null,
        branchId: Number(primary_branch_id) || null,
        zoneId: Number(zone_id) || null,
        designationId: Number(designation_id) || null,
      }));

    if (callerRole !== "SUPER_ADMIN" && ["ADMIN","SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({ message: "Only SUPER_ADMIN can assign this role" });
    }

    const experience = `${body.exp_year || 0}.${body.exp_month || 0}`;

    let hashedPassword = null;
    if (password && password.trim() !== "") {
      if (password.length < 8) throw new Error("Password must be ≥ 8 characters");
      hashedPassword = await bcrypt.hash(password, 10);
    }

    let finalEmpId = oldEmpId;
    if (emp_id && emp_id !== oldEmpId) {
      if (!["ADMIN","SUPER_ADMIN"].includes(callerRole)) throw new Error("Not allowed to change Employee ID");
      const [exists] = await conn.query("SELECT emp_id FROM employees WHERE emp_id=?", [emp_id]);
      if (exists.length) throw new Error("Employee ID already exists");
      finalEmpId = emp_id;
      await conn.query("UPDATE employee_branches SET emp_id=? WHERE emp_id=?", [finalEmpId, oldEmpId]);
      await conn.query("UPDATE employee_areas    SET emp_id=? WHERE emp_id=?", [finalEmpId, oldEmpId]);
    }

    let profilePhotoName = undefined;
    if (remove_photo === "true") {
      const [[old]] = await conn.query("SELECT profile_photo FROM employees WHERE emp_id=?", [oldEmpId]);
      if (old?.profile_photo) {
        const oldPath = path.join(UPLOAD_DIR, old.profile_photo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      profilePhotoName = null;
    }
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (![".jpg",".jpeg",".png"].includes(ext)) throw new Error("Invalid file type");
      profilePhotoName = `${finalEmpId}${ext}`;
    }

    const setClauses = [
      "emp_id=?","name=?","father_name=?","gender=?","email=?",
      "phone=?","emergency_contact=?","marital_status=?",
      "experience=?","qualification=?",
      "permanent_address=?","temporary_address=?",
      "team_id=?","designation_id=?","manager_id=?",
      "branch_id=?","zone_id=?","status=?",
      "joining_date=?","joining_status=?","role=?","dob=?",
    ];
    const vals = [
      finalEmpId, name, father_name||null, gender||null, email,
      phone||null, emergency_contact||null, marital_status||null,
      experience, qualification||null,
      permanent_address||null, temporary_address||null,
      team_id||null, designation_id||null, effectiveManagerId||null,
      primary_branch_id, zone_id||null, status,
      joining_date||null, joining_status||"TRAINEE", role, dob,
    ];

    if (hashedPassword)          { setClauses.push("password=?");      vals.push(hashedPassword); }
    if (profilePhotoName !== undefined) { setClauses.push("profile_photo=?"); vals.push(profilePhotoName); }

    vals.push(oldEmpId);
    await conn.query(`UPDATE employees SET ${setClauses.join(",")} WHERE emp_id=?`, vals);

    if (req.file) {
      fs.renameSync(req.file.path, path.join(UPLOAD_DIR, profilePhotoName));
    }

    if (finalEmpId !== oldEmpId) {
      await conn.query("UPDATE employee_branches SET emp_id=? WHERE emp_id=?", [finalEmpId, oldEmpId]);
      await conn.query("UPDATE employee_areas    SET emp_id=? WHERE emp_id=?", [finalEmpId, oldEmpId]);
    }

    await conn.query("DELETE FROM employee_areas    WHERE emp_id=?", [finalEmpId]);
    await conn.query("DELETE FROM employee_branches WHERE emp_id=?", [finalEmpId]);

    await conn.query(
      "INSERT INTO employee_branches (emp_id, branch_id, access_type, module) VALUES (?,?,'PRIMARY','ALL')",
      [finalEmpId, primary_branch_id]
    );

    for (const b of crmBranches) {
      await conn.query(
        "INSERT IGNORE INTO employee_branches (emp_id,branch_id,access_type,module) VALUES (?,?,'CRM','CRM')",
        [finalEmpId, b]
      );
    }

    for (const b of ticketBranches) {
      await conn.query(
        "INSERT IGNORE INTO employee_branches (emp_id,branch_id,access_type,module) VALUES (?,?,'SUPPORT','TICKETING')",
        [finalEmpId, b]
      );
      await conn.query(
        "INSERT IGNORE INTO employee_branches (emp_id,branch_id,access_type,module) VALUES (?,?,'SUPPORT','LEAD')",
        [finalEmpId, b]
      );
    }

    if (areaIds.length > 0) {
      await conn.query(
        "INSERT IGNORE INTO employee_areas (emp_id, area_id) VALUES ?",
        [areaIds.map(a => [finalEmpId, a])]
      );
    }

    await conn.commit();
    res.json({ message: "Employee updated successfully", emp_id: finalEmpId });
  } catch (err) {
    await conn.rollback();
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    console.error("updateEmployee:", err);
    res.status(500).json({ message: err.message || "Update failed" });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════
   REACTIVATE
═══════════════════════════════════════════════════════ */
exports.reactivateEmployee = async (req, res) => {
  try {
    const team = (req.user.team_name || "").toUpperCase();
    const allowed = ["ADMIN","SUPER_ADMIN"].includes(req.user.role) || team === "HRD";
    if (!allowed) return res.status(403).json({ message: "No permission to reactivate" });
    await db.query(
      "UPDATE employees SET status='ACTIVE', updated_at=NOW() WHERE emp_id=?",
      [req.params.empId]
    );
    res.json({ message: "Employee reactivated successfully" });
  } catch (err) {
    console.error("reactivateEmployee:", err);
    res.status(500).json({ message: "Failed to reactivate" });
  }
};

/* ═══════════════════════════════════════════════════════
   DELETE (soft — SUPER_ADMIN only)
═══════════════════════════════════════════════════════ */
exports.deleteEmployee = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Only SUPER_ADMIN can delete employees" });
    }
    await db.query(
      "UPDATE employees SET deleted_at=NOW(), status='DEACTIVATED' WHERE emp_id=?",
      [req.params.empId]
    );
    res.json({ message: "Employee deactivated" });
  } catch (err) {
    console.error("deleteEmployee:", err);
    res.status(500).json({ message: "Delete failed" });
  }
};

function applyFilters(query, params) {
  let sql = "";
  const { emp_id, name, team, zone, branch, designation } = query;
  if (emp_id)                   { sql += " AND e.emp_id LIKE ?";   params.push(`%${emp_id}%`);  }
  if (name)                     { sql += " AND e.name LIKE ?";     params.push(`%${name}%`);    }
  if (team   && team   !== "0") { sql += " AND e.team_id = ?";    params.push(Number(team));   }
  if (designation && designation !== "0") { sql += " AND e.designation_id = ?"; params.push(Number(designation)); }
  if (zone   && zone   !== "0") { sql += " AND e.zone_id = ?";    params.push(Number(zone));   }
  if (branch && branch !== "0") { sql += " AND e.branch_id = ?";  params.push(Number(branch)); }
  return sql;
}

exports.ensureEmployeeHierarchyRuntime = ensureEmployeeHierarchyRuntime;
