const db = require("../config/db");
const bcrypt = require("bcrypt");

async function initSuperAdmin() {
  const EMP_ID = "ICEEMP0001";
  const PASSWORD = "Admin@123";

  db.query(
    "SELECT id FROM employees WHERE role = 'SUPER_ADMIN' LIMIT 1",
    async (err, rows) => {
      if (err) {
        console.error("❌ Super Admin check failed:", err);
        return;
      }

      if (rows.length > 0) {
        console.log("✔ Super Admin already exists");
        return;
      }

      try {
        const hashedPassword = await bcrypt.hash(PASSWORD, 10);

        const [[zone]] = await db.promise().query(
          "SELECT id FROM zones WHERE zone_name='Head Office'"
        );
        const [[branch]] = await db.promise().query(
          "SELECT id FROM branches WHERE branch_name='Head Office'"
        );
        const [[team]] = await db.promise().query(
          "SELECT id FROM teams WHERE team_name='IT'"
        );
        const [[designation]] = await db.promise().query(
          "SELECT id FROM designations WHERE designation_name='IT'"
        );

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
          null,                // no manager
          branch.id,
          zone.id,
          "ACTIVE"
        ];

        db.query(sql, values, (err) => {
          if (err) {
            console.error("❌ Failed to create Super Admin:", err);
            return;
          }

          console.log("🔥 Super Admin created successfully");
          console.log("EMP ID :", EMP_ID);
          console.log("PASS   :", PASSWORD);
        });

      } catch (error) {
        console.error("❌ initSuperAdmin crashed:", error);
      }
    }
  );
}

module.exports = initSuperAdmin;
