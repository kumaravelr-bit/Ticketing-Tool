const pool = require("../config/db");

const NLD_FIELDS = [
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
  "code",
];

const normalizeValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return value;
};

const getPayloadValues = (body) =>
  NLD_FIELDS.map((field) => normalizeValue(body[field]));

const getLinkdownById = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM nld_linkdown WHERE id = ?`, [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get record error:", error);
    res.status(500).json({ message: "Failed to get record", error: error.message });
  }
};

const createLinkdown = async (req, res) => {
  try {
    const body = req.body;
    if (!normalizeValue(body.customer_id)) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const sql = `
      INSERT INTO nld_linkdown (
        ${NLD_FIELDS.join(",\n        ")}
      ) VALUES (${NLD_FIELDS.map(() => "?").join(", ")})
    `;

    const values = getPayloadValues(body);

    const [result] = await pool.query(sql, values);

    res.status(201).json({
      message: "Record created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Create error:", error);
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to create record",
      error: error.message,
    });
  }
};

const updateLinkdown = async (req, res) => {
  try {
    const body = req.body;
    const { id } = req.params;
    if (!normalizeValue(body.customer_id)) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const sql = `
      UPDATE nld_linkdown
      SET
        ${NLD_FIELDS.map((field) => `${field} = ?`).join(",\n        ")}
      WHERE id = ?
    `;

    const values = [...getPayloadValues(body), id];

    const [result] = await pool.query(sql, values);

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json({
      message: "Record updated successfully",
    });
  } catch (error) {
    console.error("Update error:", error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.statusCode ? error.message : "Failed to update record", error: error.message });
  }
};

module.exports = {
  getLinkdownById,
  createLinkdown,
  updateLinkdown,
};
