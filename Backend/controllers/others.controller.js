const db = require("../config/db");

/* ===================== ZONES ===================== */

exports.getZones = (req, res) => {

  const sql = `
    SELECT 
      id AS zone_id,
      zone_name AS name
    FROM zones
    ORDER BY zone_name
  `;

  db.query(sql, (err, rows) => {

    if (err)
      return res.status(500).json({
        message: "Failed to load zones"
      });

    res.json(rows);

  });

};

exports.createZone = (req, res) => {

  const { zone_name } = req.body;

  if (!zone_name)
    return res.status(400).json({
      message: "Zone name required"
    });

  const sql = `
    INSERT INTO zones (zone_name)
    VALUES (?)
  `;

  db.query(sql, [zone_name], err => {

    if (err)
      return res.status(400).json({
        message: "Zone already exists"
      });

    res.json({
      message: "Zone created successfully"
    });

  });

};

/* ===================== BRANCHES ===================== */

exports.getBranches = (req, res) => {

  const sql = `
    SELECT 
      b.id AS branch_id,
      b.branch_name AS name,
      z.zone_name
    FROM branches b
    LEFT JOIN zones z 
      ON b.zone_id = z.id
    ORDER BY b.branch_name
  `;

  db.query(sql, (err, rows) => {

    if (err)
      return res.status(500).json({
        message: "Failed to load branches"
      });

    res.json(rows);

  });

};

exports.getBranchesByZone = (req, res) => {

  const sql = `
    SELECT 
      id AS branch_id,
      branch_name AS name
    FROM branches
    WHERE zone_id = ?
    ORDER BY branch_name
  `;

  db.query(sql, [req.params.zoneId], (err, rows) => {

    if (err)
      return res.status(500).json({
        message: "Failed to load branches"
      });

    res.json(rows);

  });

};

exports.createBranch = (req, res) => {

  const { branch_name, zone_id } = req.body;

  if (!branch_name || !zone_id)
    return res.status(400).json({
      message: "Branch & Zone required"
    });

  const sql = `
    INSERT INTO branches (branch_name, zone_id)
    VALUES (?,?)
  `;

  db.query(sql, [branch_name, zone_id], err => {

    if (err)
      return res.status(400).json({
        message: "Branch already exists"
      });

    res.json({
      message: "Branch created successfully"
    });

  });

};

/* ===================== TEAMS (GLOBAL) ===================== */

exports.getTeams = (req, res) => {

  const sql = `
    SELECT 
      id AS team_id,
      team_name AS name
    FROM teams
    ORDER BY team_name
  `;

  db.query(sql, (err, rows) => {

    if (err)
      return res.status(500).json({
        message: "Failed to load teams"
      });

    res.json(rows);

  });

};

exports.createTeam = (req, res) => {

  const { team_name } = req.body;

  if (!team_name)
    return res.status(400).json({
      message: "Team name required"
    });

  const sql = `
    INSERT INTO teams (team_name)
    VALUES (?)
  `;

  db.query(sql, [team_name], err => {

    if (err)
      return res.status(400).json({
        message: "Team already exists"
      });

    res.json({
      message: "Team created successfully"
    });

  });

};

/* ===================== EMPLOYEES FILTER ===================== */

exports.getEmployeesByBranchTeam = (req, res) => {

  const { branch_id, team_id } = req.query;

  if (!branch_id || !team_id)
    return res.status(400).json({
      message: "Branch and Team required"
    });

  const sql = `
    SELECT 
      id,
      name
    FROM employees
    WHERE branch_id = ?
    AND team_id = ?
    AND status = 'ACTIVE'
    ORDER BY name
  `;

  db.query(sql, [branch_id, team_id], (err, rows) => {

    if (err)
      return res.status(500).json({
        message: "Failed to load employees"
      });

    res.json(rows);

  });

};

/* ===================== DESIGNATIONS ===================== */

exports.getDesignationsByTeam = (req, res) => {

  const sql = `
    SELECT 
      id AS designation_id,
      designation_name AS name,
      level
    FROM designations
    WHERE team_id = ?
    ORDER BY level
  `;

  db.query(sql, [req.params.teamId], (err, rows) => {

    if (err)
      return res.status(500).json({
        message: "Failed to load designations"
      });

    res.json(rows);

  });

};

exports.createDesignation = (req, res) => {

  const { designation_name, team_id, level } = req.body;

  if (!designation_name || !team_id || !level)
    return res.status(400).json({
      message: "All fields required"
    });

  const sql = `
    INSERT INTO designations
    (designation_name, team_id, level)
    VALUES (?,?,?)
  `;

  db.query(sql, [designation_name, team_id, level], err => {

    if (err)
      return res.status(400).json({
        message: "Designation already exists"
      });

    res.json({
      message: "Designation created successfully"
    });

  });

};