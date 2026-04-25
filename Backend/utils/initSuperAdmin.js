const db = require("../config/db");
const bcrypt = require("bcrypt");
const { runTriggerStatement } = require("./mysqlTriggerSupport");

const EMP_ID = "ICEEMP0001";
const PASSWORD = "Kavin@091001";
const SUPER_ADMIN_EMAIL = "kumaravelramar2019@gmail.com";

const hasColumn = (columns, name) => columns.has(String(name).trim().toLowerCase());

async function getTableColumns(conn, tableName) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => String(row.Field).trim().toLowerCase()));
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function ensureSuperAdminHierarchyBypass(conn) {
  if (!(await tableExists(conn, "employees")) || !(await tableExists(conn, "designations"))) {
    return;
  }

  await runTriggerStatement(
    conn,
    "DROP TRIGGER IF EXISTS validate_manager_hierarchy",
    "super admin hierarchy trigger cleanup"
  );
  await runTriggerStatement(
    conn,
    "DROP TRIGGER IF EXISTS validate_manager_hierarchy_update",
    "super admin hierarchy trigger cleanup"
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
      DECLARE employee_level INT;
      DECLARE manager_level INT;
      DECLARE manager_is_manager TINYINT(1);
      DECLARE allowed_count INT DEFAULT 0;

      IF NEW.manager_id IS NOT NULL THEN
        SELECT
          e.designation_id,
          e.team_id,
          e.branch_id,
          e.zone_id,
          e.role,
          d.level,
          d.is_manager
        INTO
          manager_designation_id,
          manager_team_id,
          manager_branch_id,
          manager_zone_id,
          manager_role,
          manager_level,
          manager_is_manager
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

        IF manager_role <> 'SUPER_ADMIN' THEN
          IF manager_is_manager <> 1 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Selected manager designation is not marked as manager';
          END IF;

          IF manager_level <= employee_level THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Manager must have higher designation level';
          END IF;

          SELECT COUNT(*)
          INTO allowed_count
          FROM designation_reporting_rules r
          WHERE r.child_designation_id = NEW.designation_id
            AND r.parent_designation_id = manager_designation_id
            AND r.is_active = 1
            AND (r.same_team_only = 0 OR manager_team_id = NEW.team_id)
            AND (r.same_branch_only = 0 OR manager_branch_id = NEW.branch_id)
            AND (r.same_zone_only = 0 OR manager_zone_id = NEW.zone_id);

          IF allowed_count = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Manager mapping is not allowed for this designation hierarchy';
          END IF;
        END IF;
      END IF;
    END
  `, "super admin hierarchy trigger creation");

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
      DECLARE employee_level INT;
      DECLARE manager_level INT;
      DECLARE manager_is_manager TINYINT(1);
      DECLARE allowed_count INT DEFAULT 0;

      IF NEW.manager_id IS NOT NULL THEN
        SELECT
          e.designation_id,
          e.team_id,
          e.branch_id,
          e.zone_id,
          e.role,
          d.level,
          d.is_manager
        INTO
          manager_designation_id,
          manager_team_id,
          manager_branch_id,
          manager_zone_id,
          manager_role,
          manager_level,
          manager_is_manager
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

        IF manager_role <> 'SUPER_ADMIN' THEN
          IF manager_is_manager <> 1 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Selected manager designation is not marked as manager';
          END IF;

          IF manager_level <= employee_level THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Manager must have higher designation level';
          END IF;

          SELECT COUNT(*)
          INTO allowed_count
          FROM designation_reporting_rules r
          WHERE r.child_designation_id = NEW.designation_id
            AND r.parent_designation_id = manager_designation_id
            AND r.is_active = 1
            AND (r.same_team_only = 0 OR manager_team_id = NEW.team_id)
            AND (r.same_branch_only = 0 OR manager_branch_id = NEW.branch_id)
            AND (r.same_zone_only = 0 OR manager_zone_id = NEW.zone_id);

          IF allowed_count = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Manager mapping is not allowed for this designation hierarchy';
          END IF;
        END IF;
      END IF;
    END
  `, "super admin hierarchy trigger creation");
}

async function ensureManpowerFlowTrigger(conn) {
  if (!(await tableExists(conn, "manpower_requests"))) {
    return;
  }

  await runTriggerStatement(
    conn,
    "DROP TRIGGER IF EXISTS enforce_manpower_flow",
    "manpower trigger cleanup"
  );

  await runTriggerStatement(conn, `
    CREATE TRIGGER enforce_manpower_flow
    BEFORE UPDATE ON manpower_requests
    FOR EACH ROW
    BEGIN
      IF NEW.manager_status = 'Approved' AND OLD.manager_status <> 'Approved' THEN
        IF OLD.final_status NOT IN ('Submitted', 'Manager Rejected') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Manager approval must be the first stage';
        END IF;
      END IF;

      IF NEW.hr_status = 'Approved' AND OLD.hr_status <> 'Approved' THEN
        IF OLD.manager_status <> 'Approved' THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Manager approval required before HR';
        END IF;
      END IF;

      IF NEW.cto_status = 'Approved' AND OLD.cto_status <> 'Approved' THEN
        IF OLD.hr_status <> 'Approved' THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'HR approval required before Management';
        END IF;
      END IF;
    END
  `, "manpower trigger creation");
}

async function ensureSuperAdminEmployee(conn) {
  const employeeColumns = await getTableColumns(conn, "employees");

  const [[existingByRole]] = await conn.query(
    "SELECT id, emp_id, branch_id FROM employees WHERE role = 'SUPER_ADMIN' ORDER BY id ASC LIMIT 1"
  );

  const [[existingByEmpId]] = await conn.query(
    "SELECT id, emp_id, branch_id FROM employees WHERE emp_id = ? LIMIT 1",
    [EMP_ID]
  );

  const existing = existingByRole || existingByEmpId || null;

  const [zoneRows] = await conn.query(
    "SELECT id FROM zones WHERE UPPER(TRIM(zone_name)) = 'HEAD OFFICE' LIMIT 1"
  );
  const [branchRows] = await conn.query(
    "SELECT id FROM branches WHERE UPPER(TRIM(branch_name)) = 'HEAD OFFICE' LIMIT 1"
  );
  const [teamRows] = await conn.query(
    "SELECT id FROM teams WHERE UPPER(TRIM(team_name)) = 'IT' LIMIT 1"
  );
  const [designationRows] = await conn.query(
    "SELECT id FROM designations WHERE UPPER(TRIM(designation_name)) = 'MANAGER' LIMIT 1"
  );

  if (branchRows.length === 0) {
    throw new Error("Branch 'HEAD OFFICE' not found in branches table");
  }
  if (teamRows.length === 0) {
    throw new Error("Team 'IT' not found in teams table");
  }
  if (designationRows.length === 0) {
    throw new Error("Designation 'MANAGER' not found in designations table");
  }

  const branchId = Number(branchRows[0].id);
  const teamId = Number(teamRows[0].id);
  const designationId = Number(designationRows[0].id);
  const zoneId = zoneRows[0] ? Number(zoneRows[0].id) : null;

  if (!existing) {
    const hashedPassword = await bcrypt.hash(PASSWORD, 10);

    const payload = {
      emp_id: EMP_ID,
      joining_status: "PERMANENT",
      name: "KUMARAVEL R",
      email: SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      dob: "1990-01-01",
      phone: "9043946932",
      role: "SUPER_ADMIN",
      team_id: teamId,
      designation_id: designationId,
      manager_id: null,
      branch_id: branchId,
      zone_id: zoneId,
      status: "ACTIVE",
    };

    const insertEntries = Object.entries(payload).filter(([key]) =>
      hasColumn(employeeColumns, key)
    );
    const columns = insertEntries.map(([key]) => key);
    const values = insertEntries.map(([, value]) => value);
    const placeholders = columns.map(() => "?").join(", ");

    await conn.query(
      `INSERT INTO employees (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    console.log("Super Admin created successfully");
    console.log("EMP ID :", EMP_ID);
    console.log("PASS   :", PASSWORD);

    return { empId: EMP_ID, branchId };
  }

  const setClauses = [];
  const values = [];

  if (hasColumn(employeeColumns, "role")) {
    setClauses.push("role = 'SUPER_ADMIN'");
  }
  if (hasColumn(employeeColumns, "status")) {
    setClauses.push("status = 'ACTIVE'");
  }
  if (hasColumn(employeeColumns, "branch_id")) {
    setClauses.push("branch_id = ?");
    values.push(branchId);
  }
  if (hasColumn(employeeColumns, "zone_id")) {
    setClauses.push("zone_id = ?");
    values.push(zoneId);
  }
  if (hasColumn(employeeColumns, "team_id")) {
    setClauses.push("team_id = ?");
    values.push(teamId);
  }
  if (hasColumn(employeeColumns, "designation_id")) {
    setClauses.push("designation_id = ?");
    values.push(designationId);
  }

  if (setClauses.length > 0) {
    values.push(existing.emp_id);
    await conn.query(
      `UPDATE employees SET ${setClauses.join(", ")} WHERE emp_id = ?`,
      values
    );
  }

  console.log("Super Admin already exists, syncing full access");
  return { empId: existing.emp_id, branchId };
}

async function ensureSuperAdminBranchAccess(conn, empId, primaryBranchId) {
  if (!(await tableExists(conn, "employee_branches"))) return;

  const [branchRows] = await conn.query("SELECT id FROM branches ORDER BY id ASC");
  if (branchRows.length === 0) return;

  await conn.query(
    "DELETE FROM employee_branches WHERE emp_id = ? AND access_type = 'PRIMARY'",
    [empId]
  );

  await conn.query(
    `INSERT INTO employee_branches (emp_id, branch_id, access_type, module)
     VALUES (?, ?, 'PRIMARY', 'ALL')
     ON DUPLICATE KEY UPDATE access_type = VALUES(access_type), module = VALUES(module)`,
    [empId, primaryBranchId]
  );

  for (const row of branchRows) {
    const branchId = Number(row.id);

    await conn.query(
      `INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module)
       VALUES (?, ?, 'CRM', 'CRM')`,
      [empId, branchId]
    );

    await conn.query(
      `INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module)
       VALUES (?, ?, 'SUPPORT', 'TICKETING')`,
      [empId, branchId]
    );

    try {
      await conn.query(
        `INSERT IGNORE INTO employee_branches (emp_id, branch_id, access_type, module)
         VALUES (?, ?, 'SUPPORT', 'LEAD')`,
        [empId, branchId]
      );
    } catch (error) {
      if (!["ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", "WARN_DATA_TRUNCATED"].includes(error.code)) {
        throw error;
      }
    }
  }
}

async function ensureSuperAdminAreaAccess(conn, empId) {
  if (!(await tableExists(conn, "employee_areas")) || !(await tableExists(conn, "areas"))) {
    return;
  }

  const [areaRows] = await conn.query("SELECT id FROM areas ORDER BY id ASC");
  if (areaRows.length === 0) return;

  await conn.query(
    "INSERT IGNORE INTO employee_areas (emp_id, area_id) VALUES ?",
    [areaRows.map((row) => [empId, Number(row.id)])]
  );
}

async function ensureSuperAdminPermissions(conn, empId) {
  if (!(await tableExists(conn, "employee_permissions")) || !(await tableExists(conn, "permissions"))) {
    return;
  }

  const [permissionRows] = await conn.query("SELECT id FROM permissions ORDER BY id ASC");
  if (permissionRows.length === 0) return;

  await conn.query(
    "INSERT IGNORE INTO employee_permissions (emp_id, permission_id) VALUES ?",
    [permissionRows.map((row) => [empId, Number(row.id)])]
  );
}

async function initSuperAdmin() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await ensureSuperAdminHierarchyBypass(conn);
    await ensureManpowerFlowTrigger(conn);
    const { empId, branchId } = await ensureSuperAdminEmployee(conn);
    await ensureSuperAdminBranchAccess(conn, empId, branchId);
    await ensureSuperAdminAreaAccess(conn, empId);
    await ensureSuperAdminPermissions(conn, empId);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error("initSuperAdmin crashed:", error.message);
  } finally {
    conn.release();
  }
}

module.exports = initSuperAdmin;

