const fs = require("fs");
const path = require("path");
const db = require("../config/db");

/* ===================== COMMON ERROR HANDLER ===================== */
const handleError = (res, err, msg = "Server Error") => {
  console.error(msg, err);
  return res.status(500).json({ message: msg });
};

const normalizeDeleteId = (id) => Number(id);

const deleteById = async ({
  res,
  table,
  id,
  successMessage,
  notFoundMessage,
  referencedMessage,
}) => {
  try {
    const [result] = await db.query(`DELETE FROM ${table} WHERE id=?`, [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: notFoundMessage });
    }

    return res.json({ message: successMessage });
  } catch (err) {
    if (["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(err.code)) {
      return res.status(400).json({ message: referencedMessage });
    }

    return handleError(res, err, "Delete failed");
  }
};

const getFallbackBranch = async (conn, branchId, zoneId) => {
  const [[sameZoneBranch]] = await conn.query(
    `SELECT id, branch_name, zone_id
     FROM branches
     WHERE zone_id = ? AND id <> ?
     ORDER BY id
     LIMIT 1`,
    [zoneId, branchId]
  );

  if (sameZoneBranch) return sameZoneBranch;

  const [[headOfficeBranch]] = await conn.query(
    `SELECT b.id, b.branch_name, b.zone_id
     FROM branches b
     INNER JOIN zones z ON z.id = b.zone_id
     WHERE UPPER(z.zone_name) = 'HEAD OFFICE'
       AND b.id <> ?
     ORDER BY b.id
     LIMIT 1`,
    [branchId]
  );

  return headOfficeBranch || null;
};

const hasColumn = async (tableName, columnName) => {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
};

const hasTable = async (tableName) => {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
};

const ensureManagerMappingSchema = async () => {
  const managerScopeExists = await hasColumn("designations", "manager_scope");
  if (!managerScopeExists) {
    try {
      await db.query(`
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

  const rulesTableExists = await hasTable("designation_reporting_rules");
  if (!rulesTableExists) {
    try {
      await db.query(`
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
};

const ensureScopeOwnerSchema = async () => {
  const scopeOwnerTableExists = await hasTable("scope_owner_mapping");
  if (!scopeOwnerTableExists) {
    try {
      await db.query(`
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

const toBoolFlag = (value) => {
  if (value === true || value === 1 || value === "1" || value === "true") return 1;
  return 0;
};

const HR_MANAGER_SIGN_DIR = path.join(
  __dirname,
  "../uploads/template/hr-manager-sign",
);
const HR_MANAGER_SIGN_NAME = "hr_manager_sign.png";
const HR_MANAGER_SIGN_FILE = path.join(HR_MANAGER_SIGN_DIR, HR_MANAGER_SIGN_NAME);
const HR_MANAGER_SIGN_CANDIDATES = [
  path.join(HR_MANAGER_SIGN_DIR, "hr_manager_sign.png"),
  path.join(HR_MANAGER_SIGN_DIR, "hr_manager_sign.jpg"),
  path.join(HR_MANAGER_SIGN_DIR, "hr_manager_sign.jpeg"),
  path.join(HR_MANAGER_SIGN_DIR, "hr_manager_sign.webp"),
  path.join(HR_MANAGER_SIGN_DIR, "hr_manager_sign.svg"),
];

const ensureHrManagerSignDir = () => {
  if (!fs.existsSync(HR_MANAGER_SIGN_DIR)) {
    fs.mkdirSync(HR_MANAGER_SIGN_DIR, { recursive: true });
  }
};

const isAdminRole = (user = {}) =>
  ["ADMIN", "SUPER_ADMIN"].includes(
    String(user.role || "").trim().toUpperCase(),
  );

const deleteHrManagerSignFiles = () => {
  for (const filePath of HR_MANAGER_SIGN_CANDIDATES) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const buildHrManagerSignPayload = () => {
  const exists = fs.existsSync(HR_MANAGER_SIGN_FILE);
  return {
    exists,
    fileName: exists ? HR_MANAGER_SIGN_NAME : "",
    url: exists
      ? `/uploads/template/hr-manager-sign/${HR_MANAGER_SIGN_NAME}?v=${Date.now()}`
      : "",
  };
};

/* ===================== ZONES ===================== */

exports.getZones = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id AS zone_id, zone_name AS name
      FROM zones
      ORDER BY zone_name
    `);

    res.json(rows);

  } catch (err) {
    handleError(res, err, "Failed to load zones");
  }
};

exports.createZone = async (req, res) => {
  try {
    const { zone_name } = req.body;

    if (!zone_name) {
      return res.status(400).json({ message: "Zone name required" });
    }

    await db.query(`INSERT INTO zones (zone_name) VALUES (?)`, [zone_name]);

    res.json({ message: "Zone created successfully" });

  } catch (err) {
    handleError(res, err, "Zone already exists");
  }
};

exports.updateZone = async (req, res) => {
  try {
    const { zone_name } = req.body;

    if (!zone_name) {
      return res.status(400).json({ message: "Zone name required" });
    }

    await db.query(
      `UPDATE zones SET zone_name=? WHERE id=?`,
      [zone_name, req.params.id]
    );

    res.json({ message: "Zone updated successfully" });

  } catch (err) {
    handleError(res, err, "Update failed");
  }
};

exports.deleteZone = async (req, res) => {
  return deleteById({
    res,
    table: "zones",
    id: normalizeDeleteId(req.params.id),
    successMessage: "Zone deleted successfully",
    notFoundMessage: "Zone not found or already deleted",
    referencedMessage: "Zone is in use and cannot be deleted",
  });
};

exports.getHrManagerSign = async (req, res) => {
  try {
    ensureHrManagerSignDir();
    return res.json(buildHrManagerSignPayload());
  } catch (err) {
    return handleError(res, err, "Failed to fetch HR manager signature");
  }
};

exports.uploadHrManagerSign = async (req, res) => {
  try {
    if (!isAdminRole(req.user)) {
      return res
        .status(403)
        .json({ message: "Only Admin and Super Admin can manage HR signature" });
    }

    if (!req.file?.buffer?.length) {
      return res.status(400).json({ message: "PNG file is required" });
    }

    ensureHrManagerSignDir();
    deleteHrManagerSignFiles();
    fs.writeFileSync(HR_MANAGER_SIGN_FILE, req.file.buffer);

    return res.json({
      message: "HR manager signature uploaded successfully",
      ...buildHrManagerSignPayload(),
    });
  } catch (err) {
    return handleError(res, err, "Failed to upload HR manager signature");
  }
};

exports.deleteHrManagerSign = async (req, res) => {
  try {
    if (!isAdminRole(req.user)) {
      return res
        .status(403)
        .json({ message: "Only Admin and Super Admin can manage HR signature" });
    }

    ensureHrManagerSignDir();
    const exists = HR_MANAGER_SIGN_CANDIDATES.some((filePath) =>
      fs.existsSync(filePath),
    );

    if (!exists) {
      return res.status(404).json({ message: "HR manager signature not found" });
    }

    deleteHrManagerSignFiles();
    return res.json({ message: "HR manager signature deleted successfully" });
  } catch (err) {
    return handleError(res, err, "Failed to delete HR manager signature");
  }
};

/* ===================== BRANCHES ===================== */

exports.getBranches = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        b.id AS branch_id,
        b.branch_name AS name,
        b.short_name,              -- ✅ ADD THIS
        b.zone_id,
        z.zone_name
      FROM branches b
      LEFT JOIN zones z ON b.zone_id = z.id
      ORDER BY b.branch_name
    `);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load branches" });
  }
};

/* ===================== BY ZONE ===================== */

exports.getBranchesByZone = async (req, res) => {
  try {
    const { zoneId } = req.params;

    // ✅ If NO zoneId → return ALL branches (fallback)
    if (!zoneId) {
      const [rows] = await db.query(`
        SELECT 
          b.id AS branch_id,
          b.branch_name AS name,
          b.zone_id,
          z.zone_name
        FROM branches b
        LEFT JOIN zones z ON b.zone_id = z.id
        ORDER BY b.branch_name
      `);

      return res.json(rows);
    }

    // ✅ FILTERED BY ZONE
    const [rows] = await db.query(
      `SELECT 
        id AS branch_id, 
        branch_name AS name,
        zone_id
       FROM branches
       WHERE zone_id = ?
       ORDER BY branch_name`,
      [zoneId]
    );

    res.json(rows);

  } catch (err) {
    handleError(res, err, "Failed to load branches");
  }
};

/* ===================== CREATE ===================== */

exports.createBranch = async (req, res) => {
  try {
    const { branch_name, short_name, zone_id } = req.body;

    if (!branch_name || !zone_id) {
      return res.status(400).json({ message: "Branch & Zone required" });
    }

    await db.query(
      `INSERT INTO branches (branch_name, short_name, zone_id) 
       VALUES (?, ?, ?)`,
      [branch_name, short_name || null, zone_id]
    );

    res.json({ message: "Branch created successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Branch already exists" });
  }
};

/* ===================== UPDATE ===================== */

exports.updateBranch = async (req, res) => {
  try {
    const { branch_name, short_name, zone_id } = req.body;

    if (!branch_name || !zone_id) {
      return res.status(400).json({ message: "Branch & Zone required" });
    }

    await db.query(
      `UPDATE branches 
       SET branch_name=?, short_name=?, zone_id=? 
       WHERE id=?`,
      [branch_name, short_name || null, zone_id, req.params.id]
    );

    res.json({ message: "Branch updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
};

/* ===================== DELETE ===================== */

exports.deleteBranch = async (req, res) => {
  const branchId = normalizeDeleteId(req.params.id);
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[branchRow]] = await conn.query(
      `SELECT id, branch_name, zone_id
       FROM branches
       WHERE id = ?
       LIMIT 1`,
      [branchId]
    );

    if (!branchRow) {
      await conn.rollback();
      return res.status(404).json({ message: "Branch not found or already deleted" });
    }

    const fallbackBranch = await getFallbackBranch(conn, branchId, branchRow.zone_id);

    const [[employeeUsage]] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM employees
       WHERE branch_id = ?`,
      [branchId]
    );

    const [[ticketUsage]] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM tickets
       WHERE branch_id = ?`,
      [branchId]
    );

    const [[requestUsage]] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM request_entries
       WHERE branch_id = ?`,
      [branchId]
    );

    const [[offerUsage]] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM offer_letters
       WHERE branch_id = ?`,
      [branchId]
    );

    const hasCoreUsage =
      Number(employeeUsage?.total || 0) > 0 ||
      Number(ticketUsage?.total || 0) > 0 ||
      Number(requestUsage?.total || 0) > 0 ||
      Number(offerUsage?.total || 0) > 0;

    if (hasCoreUsage && !fallbackBranch) {
      await conn.rollback();
      return res.status(400).json({
        message:
          "Branch is linked to live employee or ticket data, and no fallback branch is available for remapping",
      });
    }

    if (hasCoreUsage && fallbackBranch) {
      await conn.query(
        `UPDATE employees
         SET branch_id = ?, zone_id = ?
         WHERE branch_id = ?`,
        [fallbackBranch.id, fallbackBranch.zone_id, branchId]
      );

      await conn.query(
        `UPDATE tickets
         SET branch_id = ?
         WHERE branch_id = ?`,
        [fallbackBranch.id, branchId]
      );

      await conn.query(
        `UPDATE request_entries
         SET branch_id = ?, zone_id = ?
         WHERE branch_id = ?`,
        [fallbackBranch.id, fallbackBranch.zone_id, branchId]
      );

      await conn.query(
        `UPDATE offer_letters
         SET branch_id = ?,
             zone_id = ?,
             location = COALESCE(?, location)
         WHERE branch_id = ?`,
        [fallbackBranch.id, fallbackBranch.zone_id, fallbackBranch.branch_name, branchId]
      );
    }

    await conn.query(`DELETE FROM employee_branches WHERE branch_id = ?`, [branchId]);
    await conn.query(`DELETE FROM areas WHERE branch_id = ?`, [branchId]);
    await conn.query(`DELETE FROM scope_owner_mapping WHERE branch_id = ?`, [branchId]);

    const [result] = await conn.query(`DELETE FROM branches WHERE id = ?`, [branchId]);

    if (!result.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ message: "Branch not found or already deleted" });
    }

    await conn.commit();

    const remapNote = hasCoreUsage && fallbackBranch
      ? ` Live records were remapped to ${fallbackBranch.branch_name}.`
      : "";

    return res.json({
      message: `Branch deleted successfully.${remapNote}`,
    });
  } catch (err) {
    await conn.rollback();
    if (["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(err.code)) {
      return res.status(400).json({
        message: "Branch is still linked to dependent records and could not be deleted",
      });
    }

    return handleError(res, err, "Delete failed");
  } finally {
    conn.release();
  }
};

/* ===================== TEAMS ===================== */

exports.getTeams = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id AS team_id, team_name AS name
      FROM teams
      ORDER BY team_name
    `);

    res.json(rows);

  } catch (err) {
    handleError(res, err, "Failed to load teams");
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { team_name } = req.body;

    if (!team_name) {
      return res.status(400).json({ message: "Team name required" });
    }

    await db.query(`INSERT INTO teams (team_name) VALUES (?)`, [team_name]);

    res.json({ message: "Team created successfully" });

  } catch (err) {
    handleError(res, err, "Team already exists");
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const { team_name } = req.body;
    if (!team_name) {
      return res.status(400).json({ message: "Team name required" });
    }
    await db.query(
      `UPDATE teams SET team_name=? WHERE id=?`,
      [team_name, req.params.id]
    );
    res.json({ message: "Team updated successfully" });
  } catch (err) {
    handleError(res, err, "Update failed");
  }
};

exports.deleteTeam = async (req, res) => {
  return deleteById({
    res,
    table: "teams",
    id: normalizeDeleteId(req.params.id),
    successMessage: "Team deleted successfully",
    notFoundMessage: "Team not found or already deleted",
    referencedMessage: "Team is in use and cannot be deleted",
  });
};

/* ===================== EMPLOYEES FILTER ===================== */

exports.getEmployeesByBranchTeam = async (req, res) => {
  try {
    const { branch_id, team_id } = req.query;

    if (!branch_id || !team_id) {
      return res.status(400).json({
        message: "Branch and Team required"
      });
    }

    const [rows] = await db.query(
      `SELECT id, name 
       FROM employees
       WHERE branch_id=? AND team_id=? AND status='ACTIVE'
       ORDER BY name`,
      [branch_id, team_id]
    );

    res.json(rows);

  } catch (err) {
    handleError(res, err, "Failed to load employees");
  }
};

/* ===================== DESIGNATIONS ===================== */

exports.getDesignationsByTeam = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        id AS designation_id,
        designation_name AS name,
        team_id,
        level
       FROM designations
       WHERE team_id=?
       ORDER BY level`,
      [req.params.teamId]
    );

    res.json(rows);

  } catch (err) {
    handleError(res, err, "Failed to load designations");
  }
};

exports.createDesignation = async (req, res) => {
  try {
    const { designation_name, team_id, level } = req.body;

    if (!designation_name || !team_id || !level) {
      return res.status(400).json({
        message: "All fields required"
      });
    }

    await db.query(
      `INSERT INTO designations (designation_name, team_id, level)
       VALUES (?,?,?)`,
      [designation_name, team_id, level]
    );

    res.json({ message: "Designation created successfully" });

  } catch (err) {
    handleError(res, err, "Designation already exists");
  }
};

exports.updateDesignation = async (req, res) => {
  try {
    const { designation_name, team_id, level } = req.body;

    if (!designation_name || !team_id || !level) {
      return res.status(400).json({
        message: "All fields required"
      });
    }

    await db.query(
      `UPDATE designations 
       SET designation_name=?, team_id=?, level=? 
       WHERE id=?`,
      [designation_name, team_id, level, req.params.id]
    );

    res.json({ message: "Designation updated successfully" });

  } catch (err) {
    handleError(res, err, "Update failed");
  }
};

exports.deleteDesignation = async (req, res) => {
  return deleteById({
    res,
    table: "designations",
    id: normalizeDeleteId(req.params.id),
    successMessage: "Designation deleted successfully",
    notFoundMessage: "Designation not found or already deleted",
    referencedMessage: "Designation is in use and cannot be deleted",
  });
};

/* ===================== AREAS ===================== */

exports.getAreasByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    const [rows] = await db.query(
      `SELECT 
        id,
        area_name,
        branch_id
       FROM areas
       WHERE branch_id = ?
       ORDER BY area_name`,
      [branchId]
    );

    res.json(rows);

  } catch (err) {
    handleError(res, err, "Failed to load areas");
  }
};

// Create Area
exports.createArea = async (req, res) => {
  try {
    const { area_name, branch_id } = req.body;

    if (!area_name || !branch_id) {
      return res.status(400).json({
        message: "Area name and Branch required"
      });
    }

    await db.query(
      `INSERT INTO areas (area_name, branch_id)
       VALUES (?, ?)`,
      [area_name, branch_id]
    );

    res.json({ message: "Area created successfully" });

  } catch (err) {
    handleError(res, err, "Area already exists");
  }
};

// Update Area
exports.updateArea = async (req, res) => {
  try {
    const { area_name, branch_id } = req.body;

    await db.query(
      `UPDATE areas 
       SET area_name=?, branch_id=? 
       WHERE id=?`,
      [area_name, branch_id, req.params.id]
    );

    res.json({ message: "Area updated successfully" });

  } catch (err) {
    handleError(res, err, "Update failed");
  }
};

// Delete Area
exports.deleteArea = async (req, res) => {
  try {
    const areaId = normalizeDeleteId(req.params.id);
    const [result] = await db.query(`DELETE FROM areas WHERE id=?`, [areaId]);

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Area not found or already deleted",
      });
    }

    res.json({ message: "Area deleted successfully" });

  } catch (err) {
    if (["ER_ROW_IS_REFERENCED", "ER_ROW_IS_REFERENCED_2"].includes(err.code)) {
      return res.status(400).json({
        message: "Area is still linked to dependent records and could not be deleted",
      });
    }

    handleError(res, err, "Delete failed");
  }
};

exports.getAllDesignations = async (req, res) => {
  try {
    await ensureManagerMappingSchema();
    const [rows] = await db.query(
      `SELECT
         d.id AS designation_id,
         d.designation_name AS name,
         d.team_id,
         t.team_name,
         d.level,
         d.is_manager,
         d.manager_scope
       FROM designations d
       LEFT JOIN teams t ON d.team_id = t.id
       ORDER BY t.team_name, d.level, d.designation_name`
    );

    res.json(rows);
  } catch (err) {
    handleError(res, err, "Failed to load all designations");
  }
};

exports.getDesignationManagerRules = async (req, res) => {
  try {
    await ensureManagerMappingSchema();
    const [rows] = await db.query(
      `SELECT
         r.id,
         r.child_designation_id,
         cd.designation_name AS child_designation_name,
         ct.team_name AS child_team_name,
         cd.level AS child_level,
         r.parent_designation_id,
         pd.designation_name AS parent_designation_name,
         pt.team_name AS parent_team_name,
         pd.level AS parent_level,
         r.same_team_only,
         r.same_branch_only,
         r.same_zone_only,
         r.is_active,
         r.created_at
       FROM designation_reporting_rules r
       INNER JOIN designations cd ON r.child_designation_id = cd.id
       INNER JOIN teams ct ON cd.team_id = ct.id
       INNER JOIN designations pd ON r.parent_designation_id = pd.id
       INNER JOIN teams pt ON pd.team_id = pt.id
       ORDER BY ct.team_name, cd.level, cd.designation_name, pd.level, pd.designation_name`
    );

    res.json(rows);
  } catch (err) {
    handleError(res, err, "Failed to load manager mapping rules");
  }
};

exports.getScopeOwnerEmployees = async (req, res) => {
  try {
    await ensureScopeOwnerSchema();
    const [rows] = await db.query(
      `SELECT
         e.id,
         e.emp_id,
         e.name,
         e.team_id,
         e.zone_id,
         e.branch_id,
         e.designation_id,
         d.designation_name,
         t.team_name,
         z.zone_name,
         b.branch_name
       FROM employees e
       LEFT JOIN designations d ON e.designation_id = d.id
       LEFT JOIN teams t ON e.team_id = t.id
       LEFT JOIN zones z ON e.zone_id = z.id
       LEFT JOIN branches b ON e.branch_id = b.id
       WHERE e.status = 'ACTIVE'
       ORDER BY e.name`
    );
    res.json(rows);
  } catch (err) {
    handleError(res, err, "Failed to load scope owner employees");
  }
};

exports.getScopeOwnerMappings = async (req, res) => {
  try {
    await ensureScopeOwnerSchema();
    const [rows] = await db.query(
      `SELECT
         s.id,
         s.team_id,
         t.team_name,
         s.zone_id,
         z.zone_name,
         s.branch_id,
         b.branch_name,
         s.designation_id,
         d.designation_name,
         d.level AS designation_level,
         s.employee_id,
         e.emp_id,
         e.name AS employee_name,
         s.is_active,
         s.created_at,
         s.updated_at
       FROM scope_owner_mapping s
       INNER JOIN designations d ON s.designation_id = d.id
       INNER JOIN employees e ON s.employee_id = e.id
       LEFT JOIN teams t ON s.team_id = t.id
       LEFT JOIN zones z ON s.zone_id = z.id
       LEFT JOIN branches b ON s.branch_id = b.id
       ORDER BY t.team_name, z.zone_name, b.branch_name, d.level, d.designation_name`
    );
    res.json(rows);
  } catch (err) {
    handleError(res, err, "Failed to load scope owner mappings");
  }
};

exports.createScopeOwnerMapping = async (req, res) => {
  try {
    await ensureScopeOwnerSchema();
    const {
      team_id,
      zone_id,
      branch_id,
      designation_id,
      employee_id,
      is_active,
    } = req.body;

    if (!designation_id || !employee_id) {
      return res.status(400).json({ message: "Designation and Employee are required" });
    }

    const [[employeeRow]] = await db.query(
      `SELECT id, designation_id, team_id, zone_id, branch_id, status
       FROM employees
       WHERE id = ?`,
      [employee_id]
    );

    if (!employeeRow) {
      return res.status(404).json({ message: "Selected employee not found" });
    }

    if (employeeRow.status !== "ACTIVE") {
      return res.status(400).json({ message: "Selected employee must be active" });
    }

    if (Number(employeeRow.designation_id) !== Number(designation_id)) {
      return res.status(400).json({ message: "Employee designation must match mapping designation" });
    }

    const [duplicateRows] = await db.query(
      `SELECT id
       FROM scope_owner_mapping
       WHERE team_id <=> ?
         AND zone_id <=> ?
         AND branch_id <=> ?
         AND designation_id = ?
       LIMIT 1`,
      [team_id || null, zone_id || null, branch_id || null, designation_id]
    );

    if (duplicateRows.length) {
      return res.status(400).json({ message: "Scope owner mapping already exists for this scope and designation" });
    }

    await db.query(
      `INSERT INTO scope_owner_mapping (
        team_id, zone_id, branch_id, designation_id, employee_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        team_id || null,
        zone_id || null,
        branch_id || null,
        designation_id,
        employee_id,
        is_active === undefined ? 1 : toBoolFlag(is_active),
      ]
    );

    res.json({ message: "Scope owner mapping created successfully" });
  } catch (err) {
    handleError(res, err, "Scope owner mapping already exists or failed");
  }
};

exports.updateScopeOwnerMapping = async (req, res) => {
  try {
    await ensureScopeOwnerSchema();
    const {
      team_id,
      zone_id,
      branch_id,
      designation_id,
      employee_id,
      is_active,
    } = req.body;

    if (!designation_id || !employee_id) {
      return res.status(400).json({ message: "Designation and Employee are required" });
    }

    const [[employeeRow]] = await db.query(
      `SELECT id, designation_id, status
       FROM employees
       WHERE id = ?`,
      [employee_id]
    );

    if (!employeeRow) {
      return res.status(404).json({ message: "Selected employee not found" });
    }

    if (employeeRow.status !== "ACTIVE") {
      return res.status(400).json({ message: "Selected employee must be active" });
    }

    if (Number(employeeRow.designation_id) !== Number(designation_id)) {
      return res.status(400).json({ message: "Employee designation must match mapping designation" });
    }

    const [duplicateRows] = await db.query(
      `SELECT id
       FROM scope_owner_mapping
       WHERE team_id <=> ?
         AND zone_id <=> ?
         AND branch_id <=> ?
         AND designation_id = ?
         AND id <> ?
       LIMIT 1`,
      [team_id || null, zone_id || null, branch_id || null, designation_id, req.params.id]
    );

    if (duplicateRows.length) {
      return res.status(400).json({ message: "Scope owner mapping already exists for this scope and designation" });
    }

    await db.query(
      `UPDATE scope_owner_mapping
       SET team_id = ?,
           zone_id = ?,
           branch_id = ?,
           designation_id = ?,
           employee_id = ?,
           is_active = ?
       WHERE id = ?`,
      [
        team_id || null,
        zone_id || null,
        branch_id || null,
        designation_id,
        employee_id,
        is_active === undefined ? 1 : toBoolFlag(is_active),
        req.params.id,
      ]
    );

    res.json({ message: "Scope owner mapping updated successfully" });
  } catch (err) {
    handleError(res, err, "Scope owner mapping update failed");
  }
};

exports.deleteScopeOwnerMapping = async (req, res) => {
  try {
    await ensureScopeOwnerSchema();
    await db.query("DELETE FROM scope_owner_mapping WHERE id = ?", [req.params.id]);
    res.json({ message: "Scope owner mapping deleted successfully" });
  } catch (err) {
    handleError(res, err, "Scope owner mapping delete failed");
  }
};

exports.createDesignationManagerRule = async (req, res) => {
  try {
    await ensureManagerMappingSchema();
    const {
      child_designation_id,
      parent_designation_id,
      same_team_only,
      same_branch_only,
      same_zone_only,
      is_active,
    } = req.body;

    if (!child_designation_id || !parent_designation_id) {
      return res.status(400).json({ message: "Child and Parent designation are required" });
    }

    const [[childRow]] = await db.query(
      "SELECT id, team_id, level FROM designations WHERE id = ?",
      [child_designation_id]
    );
    const [[parentRow]] = await db.query(
      "SELECT id, team_id, level, is_manager FROM designations WHERE id = ?",
      [parent_designation_id]
    );

    if (!childRow || !parentRow) {
      return res.status(404).json({ message: "Designation not found" });
    }

    if (Number(childRow.id) === Number(parentRow.id)) {
      return res.status(400).json({ message: "Child and Parent designation cannot be the same" });
    }

    if (Number(parentRow.level) <= Number(childRow.level)) {
      return res.status(400).json({ message: "Parent designation must have a higher level than child designation" });
    }

    if (Number(parentRow.is_manager) !== 1) {
      await db.query(
        "UPDATE designations SET is_manager = 1 WHERE id = ?",
        [parent_designation_id]
      );
    }

    await db.query(
      `INSERT INTO designation_reporting_rules (
        child_designation_id,
        parent_designation_id,
        same_team_only,
        same_branch_only,
        same_zone_only,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        child_designation_id,
        parent_designation_id,
        toBoolFlag(same_team_only),
        toBoolFlag(same_branch_only),
        toBoolFlag(same_zone_only),
        is_active === undefined ? 1 : toBoolFlag(is_active),
      ]
    );

    res.json({ message: "Manager mapping created successfully" });
  } catch (err) {
    handleError(res, err, "Manager mapping already exists or failed");
  }
};

exports.updateDesignationManagerRule = async (req, res) => {
  try {
    await ensureManagerMappingSchema();
    const {
      child_designation_id,
      parent_designation_id,
      same_team_only,
      same_branch_only,
      same_zone_only,
      is_active,
    } = req.body;

    if (!child_designation_id || !parent_designation_id) {
      return res.status(400).json({ message: "Child and Parent designation are required" });
    }

    const [[childRow]] = await db.query(
      "SELECT id, level FROM designations WHERE id = ?",
      [child_designation_id]
    );
    const [[parentRow]] = await db.query(
      "SELECT id, level, is_manager FROM designations WHERE id = ?",
      [parent_designation_id]
    );

    if (!childRow || !parentRow) {
      return res.status(404).json({ message: "Designation not found" });
    }

    if (Number(parentRow.level) <= Number(childRow.level)) {
      return res.status(400).json({ message: "Parent designation must have a higher level than child designation" });
    }

    if (Number(parentRow.is_manager) !== 1) {
      await db.query(
        "UPDATE designations SET is_manager = 1 WHERE id = ?",
        [parent_designation_id]
      );
    }

    await db.query(
      `UPDATE designation_reporting_rules
       SET child_designation_id = ?,
           parent_designation_id = ?,
           same_team_only = ?,
           same_branch_only = ?,
           same_zone_only = ?,
           is_active = ?
       WHERE id = ?`,
      [
        child_designation_id,
        parent_designation_id,
        toBoolFlag(same_team_only),
        toBoolFlag(same_branch_only),
        toBoolFlag(same_zone_only),
        is_active === undefined ? 1 : toBoolFlag(is_active),
        req.params.id,
      ]
    );

    res.json({ message: "Manager mapping updated successfully" });
  } catch (err) {
    handleError(res, err, "Manager mapping update failed");
  }
};

exports.deleteDesignationManagerRule = async (req, res) => {
  try {
    await ensureManagerMappingSchema();
    await db.query("DELETE FROM designation_reporting_rules WHERE id = ?", [req.params.id]);
    res.json({ message: "Manager mapping deleted successfully" });
  } catch (err) {
    handleError(res, err, "Manager mapping delete failed");
  }
};
