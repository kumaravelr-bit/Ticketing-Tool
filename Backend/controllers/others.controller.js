const db = require("../config/db");

/* ===================== COMMON ERROR HANDLER ===================== */
const handleError = (res, err, msg = "Server Error") => {
  console.error(msg, err);
  return res.status(500).json({ message: msg });
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
  try {
    await db.query(`DELETE FROM zones WHERE id=?`, [req.params.id]);

    res.json({ message: "Zone deleted successfully" });

  } catch (err) {
    handleError(res, err, "Delete failed");
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
  try {
    await db.query(`DELETE FROM branches WHERE id=?`, [req.params.id]);

    res.json({ message: "Branch deleted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
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
  try {
    await db.query(`DELETE FROM teams WHERE id=?`, [req.params.id]);

    res.json({ message: "Team deleted successfully" });

  } catch (err) {
    handleError(res, err, "Delete failed");
  }
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
  try {
    await db.query(
      `DELETE FROM designations WHERE id=?`,
      [req.params.id]
    );

    res.json({ message: "Designation deleted successfully" });

  } catch (err) {
    handleError(res, err, "Delete failed");
  }
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
    await db.query(
      `DELETE FROM areas WHERE id=?`,
      [req.params.id]
    );

    res.json({ message: "Area deleted successfully" });

  } catch (err) {
    handleError(res, err, "Delete failed");
  }
};