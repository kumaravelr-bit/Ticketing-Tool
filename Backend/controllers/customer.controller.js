const pool = require("../config/db");

const CUSTOMER_FIELDS = [
  "customer_id",
  "zone",
  "branch",
  "first_name",
  "connection_mode",
  "status",
  "plan_name",
  "plan_value",
  "connection_starting_date",
  "payment_mode",
  "drop_date",
  "age",
  "lat_long",
  "connection_type",
  "customer_ip",
  "tower_id",
  "ap_name_ssid",
  "bridge_mode_ip_branch_entry",
  "lat_long_branch_entry",
  "area_name_branch_entry",
  "area_incharge_emp_id",
  "area_incharge_emp_name",
  "technical_emp_id",
  "technical_emp_name",
  "bi_name",
  "tl_name",
  "tower_name",
  "team_name",
  "current_bill",
  "outstanding",
  "total_bill",
  "total_paid",
  "old_balance_paid",
  "balance",
  "new_collection_paid",
  "excess_pay",
  "tower_type",
  "total_bw",
  "max_utilisation",
  "avg_utilisation",
  "tower_height",
  "device_name_ssid",
  "bridge_ip",
  "wep_key",
  "wireless_mac",
  "user_name",
  "password",
  "port_number",
  "device_product_name",
  "device_model",
  "nld_id",
  "tower_id_branch_entry",
  "ap_name_ssid_branch_entry",
  "code"
];

function parseIdParam(id) {
  const parsed = Number.parseInt(id, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function queryOrEmpty(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error("customer lookup query failed:", error.message);
    return [];
  }
}

async function getCustomers(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);
    const offset = (page - 1) * limit;

    const filters = [];
    const values = [];

    if (req.query.search) {
      filters.push(`
        (
          first_name LIKE ?
          OR customer_id LIKE ?
          OR zone LIKE ?
          OR branch LIKE ?
          OR user_name LIKE ?
          OR tower_name LIKE ?
        )
      `);
      const searchValue = `%${req.query.search}%`;
      values.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    if (req.query.first_name) {
      filters.push("first_name LIKE ?");
      values.push(`%${req.query.first_name}%`);
    }

    if (req.query.customer_id) {
      filters.push("customer_id LIKE ?");
      values.push(`%${req.query.customer_id}%`);
    }

    if (req.query.zone) {
      filters.push("zone = ?");
      values.push(req.query.zone);
    }

    if (req.query.branch) {
      filters.push("branch = ?");
      values.push(req.query.branch);
    }

    if (req.query.status) {
      filters.push("status = ?");
      values.push(req.query.status);
    }

    if (req.query.connection_type) {
      filters.push("connection_type = ?");
      values.push(req.query.connection_type);
    }

    if (req.query.connection_mode) {
      filters.push("connection_mode = ?");
      values.push(req.query.connection_mode);
    }

    if (req.query.payment_mode) {
      filters.push("payment_mode = ?");
      values.push(req.query.payment_mode);
    }

    if (req.query.plan_name) {
      filters.push("plan_name = ?");
      values.push(req.query.plan_name);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        customer_id,
        zone,
        branch,
        first_name,
        connection_type,
        connection_mode,
        status,
        plan_name,
        plan_value,
        connection_starting_date,
        payment_mode,
        drop_date,
        age,
        lat_long,
        customer_ip,
        tower_id,
        ap_name_ssid,
        bridge_mode_ip_branch_entry,
        lat_long_branch_entry,
        area_name_branch_entry,
        area_incharge_emp_id,
        area_incharge_emp_name,
        technical_emp_id,
        technical_emp_name,
        bi_name,
        tl_name,
        tower_name,
        team_name,
        current_bill,
        outstanding,
        total_bill,
        total_paid,
        old_balance_paid,
        balance,
        new_collection_paid,
        excess_pay,
        tower_type,
        total_bw,
        max_utilisation,
        avg_utilisation,
        tower_height,
        device_name_ssid,
        bridge_ip,
        wep_key,
        wireless_mac,
        user_name,
        password,
        port_number,
        device_product_name,
        device_model,
        nld_id,
        tower_id_branch_entry,
        ap_name_ssid_branch_entry,
        code
      FROM customer_master
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset]
    );

    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM customer_master
      ${whereClause}
      `,
      values
    );

    const totalRecords = countRows[0].total;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    res.json({
      rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
    });
  } catch (error) {
    console.error("getCustomers error:", error);
    res.status(500).json({
      message: "Failed to fetch customers"
    });
  }
}

async function getCustomerById(req, res) {
  try {
    const id = parseIdParam(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "Invalid customer id"
      });
    }

    const [rows] = await pool.query(
      `
      SELECT *
      FROM customer_master
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("getCustomerById error:", error);
    res.status(500).json({
      message: "Failed to fetch customer"
    });
  }
}

async function getFilterOptions(req, res) {
  try {
    const zones = await queryOrEmpty(
      "SELECT zone_name AS value FROM zones ORDER BY zone_name"
    );

    const branches = await queryOrEmpty(`
      SELECT z.zone_name, b.branch_name
      FROM branches b
      JOIN zones z ON z.id = b.zone_id
      ORDER BY z.zone_name, b.branch_name
    `);

    const connectionTypes = await queryOrEmpty(
      "SELECT connection_type_name AS value FROM connection_type_master WHERE is_active = 1 ORDER BY connection_type_name"
    );

    const connectionModes = await queryOrEmpty(
      "SELECT connection_mode_name AS value FROM connection_mode_master WHERE is_active = 1 ORDER BY connection_mode_name"
    );

    const plans = await queryOrEmpty(
      "SELECT plan_name AS value FROM plan_master WHERE is_active = 1 ORDER BY plan_name"
    );

    const paymentModes = await queryOrEmpty(
      "SELECT payment_mode_name AS value FROM payment_mode_master WHERE is_active = 1 ORDER BY payment_mode_name"
    );

    const statuses = await queryOrEmpty(
      "SELECT status_name AS value FROM status_master WHERE is_active = 1 ORDER BY status_name"
    );

    const planRows = await queryOrEmpty(`
      SELECT plan_name, MAX(plan_value) AS plan_value
      FROM customer_master
      WHERE plan_name IS NOT NULL AND plan_name <> ''
      GROUP BY plan_name
    `);

    const towerTypeRows = await queryOrEmpty(`
      SELECT DISTINCT tower_type AS value
      FROM customer_master
      WHERE tower_type IS NOT NULL AND tower_type <> ''
      ORDER BY tower_type
    `);

    const towerNameRows = await queryOrEmpty(`
      SELECT DISTINCT tower_name AS value
      FROM customer_master
      WHERE tower_name IS NOT NULL AND tower_name <> ''
      ORDER BY tower_name
    `);

    const teamNameRows = await queryOrEmpty(`
      SELECT DISTINCT team_name AS value
      FROM customer_master
      WHERE team_name IS NOT NULL AND team_name <> ''
      ORDER BY team_name
    `);

    const apNameRows = await queryOrEmpty(`
      SELECT DISTINCT ap_name_ssid AS value
      FROM customer_master
      WHERE ap_name_ssid IS NOT NULL AND ap_name_ssid <> ''
      ORDER BY ap_name_ssid
    `);

    const branchEntryApNameRows = await queryOrEmpty(`
      SELECT DISTINCT ap_name_ssid_branch_entry AS value
      FROM customer_master
      WHERE ap_name_ssid_branch_entry IS NOT NULL AND ap_name_ssid_branch_entry <> ''
      ORDER BY ap_name_ssid_branch_entry
    `);

    const nldIdRows = await queryOrEmpty(`
      SELECT DISTINCT nld_id AS value
      FROM customer_master
      WHERE nld_id IS NOT NULL AND nld_id <> ''
      ORDER BY nld_id
    `);

    const branchMap = {};
    branches.forEach((item) => {
      if (!branchMap[item.zone_name]) {
        branchMap[item.zone_name] = [];
      }
      branchMap[item.zone_name].push(item.branch_name);
    });

    const zoneList =
      zones.length > 0
        ? zones.map((x) => x.value)
        : (await queryOrEmpty(`
            SELECT DISTINCT zone AS value
            FROM customer_master
            WHERE zone IS NOT NULL AND zone <> ''
            ORDER BY zone
          `)).map((x) => x.value);

    const branchResult =
      Object.keys(branchMap).length > 0
        ? branchMap
        : (await queryOrEmpty(`
            SELECT zone, branch
            FROM customer_master
            WHERE zone IS NOT NULL AND zone <> '' AND branch IS NOT NULL AND branch <> ''
            ORDER BY zone, branch
          `)).reduce((acc, item) => {
            if (!acc[item.zone]) acc[item.zone] = [];
            if (!acc[item.zone].includes(item.branch)) acc[item.zone].push(item.branch);
            return acc;
          }, {});

    const connectionTypeList =
      connectionTypes.length > 0
        ? connectionTypes.map((x) => x.value)
        : (await queryOrEmpty(`
            SELECT DISTINCT connection_type AS value
            FROM customer_master
            WHERE connection_type IS NOT NULL AND connection_type <> ''
            ORDER BY connection_type
          `)).map((x) => x.value);

    const connectionModeList =
      connectionModes.length > 0
        ? connectionModes.map((x) => x.value)
        : (await queryOrEmpty(`
            SELECT DISTINCT connection_mode AS value
            FROM customer_master
            WHERE connection_mode IS NOT NULL AND connection_mode <> ''
            ORDER BY connection_mode
          `)).map((x) => x.value);

    const planList =
      plans.length > 0
        ? plans.map((x) => x.value)
        : planRows.map((x) => x.plan_name).filter(Boolean);

    const paymentModeList =
      paymentModes.length > 0
        ? paymentModes.map((x) => x.value)
        : (await queryOrEmpty(`
            SELECT DISTINCT payment_mode AS value
            FROM customer_master
            WHERE payment_mode IS NOT NULL AND payment_mode <> ''
            ORDER BY payment_mode
          `)).map((x) => x.value);

    const statusList =
      statuses.length > 0
        ? statuses.map((x) => x.value)
        : (await queryOrEmpty(`
            SELECT DISTINCT status AS value
            FROM customer_master
            WHERE status IS NOT NULL AND status <> ''
            ORDER BY status
          `)).map((x) => x.value);

    const planAmountByName = {};
    planRows.forEach((item) => {
      if (item.plan_name) {
        planAmountByName[item.plan_name] = item.plan_value;
      }
    });

    res.json({
      zones: zoneList,
      branches: branchResult,
      connectionTypes: connectionTypeList,
      connectionModes: connectionModeList,
      plans: planList,
      paymentModes: paymentModeList,
      ipTypes: [],
      deviceModes: [],
      statuses: statusList,
      towerTypes: towerTypeRows.map((x) => x.value),
      towerNames: towerNameRows.map((x) => x.value),
      teamNames: teamNameRows.map((x) => x.value),
      apNames: apNameRows.map((x) => x.value),
      branchEntryApNames: branchEntryApNameRows.map((x) => x.value),
      nldIds: nldIdRows.map((x) => x.value),
      connectedBranches: [],
      planAmountByName,
      branchMailByName: {},
      zoneMailByName: {},
      branchDepartmentByName: {}
    });
  } catch (error) {
    console.error("getFilterOptions error:", error);
    res.status(500).json({
      message: "Failed to load filter options"
    });
  }
}

async function createCustomer(req, res) {
  try {
    const payload = req.body;

    if (!payload.customer_id) {
      return res.status(400).json({
        message: "customer_id is required"
      });
    }

    const toNull = (value) => {
      if (value === undefined || value === null || value === "") return null;
      return value;
    };

    const sql = `
      INSERT INTO customer_master (
        ${CUSTOMER_FIELDS.join(",\n        ")}
      ) VALUES (
        ${CUSTOMER_FIELDS.map(() => "?").join(", ")}
      )
    `;

    const values = CUSTOMER_FIELDS.map((field) => toNull(payload[field]));

    const [result] = await pool.query(sql, values);

    res.status(201).json({
      message: "Customer created successfully",
      id: result.insertId
    });
  } catch (error) {
    console.error("createCustomer error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Customer ID already exists"
      });
    }

    res.status(500).json({
      message: error.message || "Failed to create customer"
    });
  }
}

async function updateCustomer(req, res) {
  try {
    const id = parseIdParam(req.params.id);
    const payload = req.body;

    if (!id) {
      return res.status(400).json({
        message: "Invalid customer id"
      });
    }

    if (!payload.customer_id) {
      return res.status(400).json({
        message: "customer_id is required"
      });
    }

    const toNull = (value) => {
      if (value === undefined || value === null || value === "") return null;
      return value;
    };

    const sql = `
      UPDATE customer_master
      SET
        ${CUSTOMER_FIELDS.map((field) => `${field} = ?`).join(",\n        ")}
      WHERE id = ?
    `;

    const values = [...CUSTOMER_FIELDS.map((field) => toNull(payload[field])), id];

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    res.json({
      message: "Customer updated successfully"
    });
  } catch (error) {
    console.error("updateCustomer error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Customer ID already exists"
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update customer"
    });
  }
}

module.exports = {
  getCustomers,
  getCustomerById,
  getFilterOptions,
  createCustomer,
  updateCustomer
};
