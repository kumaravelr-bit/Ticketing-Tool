const db = require("../config/db");
const bcrypt = require("bcrypt");

async function initSuperAdmin() {
  try {

    const EMP_ID = "ICEEMP0001";
    const PASSWORD = "Info@123";

    /* ===============================
       CHECK IF SUPER ADMIN EXISTS
    =============================== */

    const [rows] = await db.query(
      "SELECT id FROM employees WHERE role = 'SUPER_ADMIN' LIMIT 1"
    );

    if (rows.length > 0) {
      console.log("✔ Super Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(PASSWORD, 10);

    /* ===============================
       FETCH REQUIRED MASTER IDS
    =============================== */

    const [zoneRows] = await db.query(
      "SELECT id FROM zones WHERE zone_name='HEAD OFFICE' LIMIT 1"
    );

    if (zoneRows.length === 0) {
      throw new Error("Zone 'HEAD OFFICE' not found in zones table");
    }
    const zone = zoneRows[0];
    const [branchRows] = await db.query(
      "SELECT id FROM branches WHERE branch_name='HEAD OFFICE' LIMIT 1"
    );

    if (branchRows.length === 0) {
      throw new Error("Branch 'HEAD OFFICE' not found in branches table");
    }
    const branch = branchRows[0];

    const [teamRows] = await db.query(
      "SELECT id FROM teams WHERE team_name='IT' LIMIT 1"
    );

    if (teamRows.length === 0) {
      throw new Error("Team 'IT' not found in teams table");
    }
    const team = teamRows[0];

    const [designationRows] = await db.query(
      "SELECT id FROM designations WHERE designation_name='IT' LIMIT 1"
    );

    if (designationRows.length === 0) {
      throw new Error("Designation 'IT' not found in designations table");
    }
    const designation = designationRows[0];

    /* ===============================
       INSERT SUPER ADMIN
    =============================== */
    const sql = `
      INSERT INTO employees (
        emp_id,
        name,
        email,
        password,
        dob,
        phone,
        role,
        team_id,
        designation_id,
        manager_id,
        branch_id,
        zone_id,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      EMP_ID,
      "Super Admin",
      "superadmin@system.local",
      hashedPassword,
      "1990-01-01",
      "9999999999",
      "SUPER_ADMIN",
      team.id,
      designation.id,
      null,
      branch.id,
      zone.id,
      "ACTIVE"
    ];

    await db.query(sql, values);

    console.log("🔥 Super Admin created successfully");
    console.log("EMP ID :", EMP_ID);
    console.log("PASS   :", PASSWORD);

  } catch (error) {

    console.error("❌ initSuperAdmin crashed:", error.message);

  }
}

module.exports = initSuperAdmin;
