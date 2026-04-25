const XLSX = require("xlsx");
const db = require("../config/leadsDb");

const normalizeText = (value) => String(value || "").trim();

const normalizeDate = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

const normalizeNullableText = (value) => {
  const text = normalizeText(value);
  return text === "" ? null : text;
};

const normalizeNullableNumber = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const formatDateValue = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLatLong = (value) => {
  const text = normalizeText(value);
  if (!text) {
    return {
      latitude: null,
      longitude: null,
      latLong: "",
    };
  }

  const parts = text.split(",").map((item) => item.trim());
  if (parts.length !== 2) {
    return {
      latitude: null,
      longitude: null,
      latLong: text,
    };
  }

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      latitude: null,
      longitude: null,
      latLong: text,
    };
  }

  return {
    latitude,
    longitude,
    latLong: `${latitude}, ${longitude}`,
  };
};

const formatLatLong = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return "";
  }

  return `${latitude}, ${longitude}`;
};

const getLeadTypeCode = (connectionType) => {
  const normalized = normalizeText(connectionType).toUpperCase();

  switch (normalized) {
    case "LIVE EVENT":
      return "LIVE";
    case "BB":
    case "ILL":
    case "SME":
      return normalized;
    default:
      return normalized.replace(/\s+/g, "") || "GEN";
  }
};

const getLeadSequenceType = ({ interestedIn, connectionType, plan }) => {
  const normalizedInterest = normalizeText(interestedIn).toUpperCase();

  if (normalizedInterest === "IOT") {
    return "IOT";
  }

  return normalizeText(connectionType || plan);
};

const buildLeadNumber = ({ empId, connectionType, sequence }) =>
  `${empId}/${getLeadTypeCode(connectionType)}${sequence}`;

const LEAD_SELECT = `
  SELECT
    id,
    lead_number AS leadNumber,
    activity_type AS activityType,
    customer_type AS customerType,
    interested_in AS interestedIn,
    connection_type AS connectionType,
    connection_stage AS connectionStage,
    customer_name AS customerName,
    mobile_no AS mobileNo,
    mail,
    address,
    latitude,
    longitude,
    lead_ref AS leadRef,
    ex_customer_id AS exCustomerId,
    ex_customer_name AS exCustomerName,
    tech_id AS techId,
    tech_name AS techName,
    remarks,
    status,
    next_follow_date AS nextFollowDate,
    current_updates AS currentUpdates,
    customer_id AS customerId,
    plan,
    plan_value_without_gst AS planValueWithoutGst,
    total_revenue_without_gst AS totalRevenueWithoutGst,
    feedback,
    payment_mode AS paymentMode,
    otc_without_gst AS otcWithoutGst,
    deposit_without_gst AS depositWithoutGst,
    emp_id AS empId,
    emp_name AS empName,
    vendor_movement AS vendorMovement,
    move_to_asm AS moveToAsm,
    connection_branch AS connectionBranch,
    zone,
    branch,
    lead_date AS date,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM leads
`;

const LEAD_MUTATION_COLUMNS = [
  "activity_type",
  "customer_type",
  "interested_in",
  "connection_type",
  "connection_stage",
  "customer_name",
  "mobile_no",
  "mail",
  "address",
  "latitude",
  "longitude",
  "lead_ref",
  "ex_customer_id",
  "ex_customer_name",
  "tech_id",
  "tech_name",
  "remarks",
  "status",
  "next_follow_date",
  "current_updates",
  "customer_id",
  "plan",
  "plan_value_without_gst",
  "total_revenue_without_gst",
  "feedback",
  "payment_mode",
  "otc_without_gst",
  "deposit_without_gst",
  "emp_id",
  "emp_name",
  "vendor_movement",
  "move_to_asm",
  "connection_branch",
  "zone",
  "branch",
  "lead_date",
];

const mapLeadRow = (row) => ({
  id: String(row.id),
  leadNumber: row.leadNumber,
  activityType: row.activityType,
  customerType: row.customerType,
  interestedIn: row.interestedIn,
  connectionType: row.connectionType || "",
  connectionStage: row.connectionStage,
  customerName: row.customerName,
  mobileNo: row.mobileNo,
  mail: row.mail || "",
  address: row.address,
  latLong: formatLatLong(row.latitude, row.longitude),
  leadRef: row.leadRef,
  exCustomerId: row.exCustomerId || "",
  exCustomerName: row.exCustomerName || "",
  techId: row.techId || "",
  techName: row.techName || "",
  remarks: row.remarks || "",
  status: row.status,
  nextFollowDate: formatDateValue(row.nextFollowDate),
  currentUpdates: row.currentUpdates || "",
  customerId: row.customerId || "",
  plan: row.plan || "",
  planValueWithoutGst: row.planValueWithoutGst ?? "",
  totalRevenueWithoutGst: row.totalRevenueWithoutGst ?? "",
  feedback: row.feedback || "",
  paymentMode: row.paymentMode || "",
  otcWithoutGst: row.otcWithoutGst ?? "",
  depositWithoutGst: row.depositWithoutGst ?? "",
  empId: row.empId,
  empName: row.empName,
  vendorMovement: row.vendorMovement,
  moveToAsm: row.moveToAsm,
  connectionBranch: row.connectionBranch,
  zone: row.zone,
  branch: row.branch,
  date: formatDateValue(row.date),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const sanitizeLead = (payload, existingLead = {}, user = {}) => {
  const date = normalizeDate(payload.date || existingLead.date || new Date().toISOString());
  const fallbackEmpId = normalizeText(user.emp_id || user.employee_id);
  const fallbackEmpName = normalizeText(user.name || user.emp_name || user.employee_name);
  const interestedIn = normalizeText(payload.interestedIn || existingLead.interestedIn);
  const connectionType = interestedIn === "INTERNET"
    ? normalizeNullableText(payload.connectionType ?? existingLead.connectionType)
    : null;
  const parsedLatLong = parseLatLong(payload.latLong ?? existingLead.latLong);

  return {
    id: existingLead.id || null,
    leadNumber: existingLead.leadNumber || "",
    activityType: normalizeText(payload.activityType || existingLead.activityType),
    customerType: normalizeText(payload.customerType || existingLead.customerType),
    interestedIn,
    connectionType,
    connectionStage: normalizeText(payload.connectionStage || existingLead.connectionStage),
    customerName: normalizeText(payload.customerName || existingLead.customerName),
    mobileNo: normalizeText(payload.mobileNo || existingLead.mobileNo),
    mail: normalizeNullableText(payload.mail ?? existingLead.mail),
    address: normalizeText(payload.address || existingLead.address),
    latLong: parsedLatLong.latLong,
    latitude: parsedLatLong.latitude,
    longitude: parsedLatLong.longitude,
    leadRef: normalizeText(payload.leadRef || existingLead.leadRef),
    exCustomerId: normalizeNullableText(payload.exCustomerId ?? existingLead.exCustomerId),
    exCustomerName: normalizeNullableText(payload.exCustomerName ?? existingLead.exCustomerName),
    techId: normalizeNullableText(payload.techId ?? existingLead.techId),
    techName: normalizeNullableText(payload.techName ?? existingLead.techName),
    remarks: normalizeNullableText(payload.remarks ?? existingLead.remarks),
    status: normalizeText(payload.status || existingLead.status),
    nextFollowDate: normalizeDate(payload.nextFollowDate || existingLead.nextFollowDate),
    currentUpdates: normalizeNullableText(payload.currentUpdates ?? existingLead.currentUpdates),
    customerId: normalizeNullableText(payload.customerId ?? existingLead.customerId),
    plan: normalizeNullableText(payload.plan ?? existingLead.plan),
    planValueWithoutGst: normalizeNullableNumber(
      payload.planValueWithoutGst ?? existingLead.planValueWithoutGst
    ),
    totalRevenueWithoutGst: normalizeNullableNumber(
      payload.totalRevenueWithoutGst ?? existingLead.totalRevenueWithoutGst
    ),
    feedback: normalizeNullableText(payload.feedback ?? existingLead.feedback),
    paymentMode: normalizeNullableText(payload.paymentMode ?? existingLead.paymentMode),
    otcWithoutGst: normalizeNullableNumber(payload.otcWithoutGst ?? existingLead.otcWithoutGst),
    depositWithoutGst: normalizeNullableNumber(
      payload.depositWithoutGst ?? existingLead.depositWithoutGst
    ),
    empId: normalizeText(payload.empId || existingLead.empId || fallbackEmpId),
    empName: normalizeText(payload.empName || existingLead.empName || fallbackEmpName),
    vendorMovement: normalizeText(payload.vendorMovement || existingLead.vendorMovement),
    moveToAsm: normalizeText(payload.moveToAsm || existingLead.moveToAsm),
    connectionBranch: normalizeText(payload.connectionBranch || existingLead.connectionBranch),
    zone: normalizeText(payload.zone || existingLead.zone),
    branch: normalizeText(payload.branch || existingLead.branch),
    date,
    createdAt: existingLead.createdAt || null,
    updatedAt: existingLead.updatedAt || null,
  };
};

const validateLead = (lead) => {
  const errors = [];
  const requireField = (key, label) => {
    if (!normalizeText(lead[key])) {
      errors.push(`${label} is required`);
    }
  };

  [
    ["activityType", "Activity type"],
    ["customerType", "Customer type"],
    ["interestedIn", "Customer interested in"],
    ["connectionStage", "Connection stage"],
    ["customerName", "Customer name"],
    ["mobileNo", "Mobile no"],
    ["address", "Address"],
    ["latLong", "LatLong"],
    ["leadRef", "Lead ref"],
    ["status", "Status"],
    ["empId", "Emp ID"],
    ["empName", "Emp name"],
    ["connectionBranch", "Connection branch"],
    ["zone", "Zone"],
    ["branch", "Branch"],
    ["date", "Date"],
  ].forEach(([key, label]) => requireField(key, label));

  if (lead.interestedIn === "INTERNET") {
    requireField("connectionType", "Connection type");
  }

  if (lead.leadRef === "CUSTOMER") {
    requireField("exCustomerId", "Ex.Customer ID");
    requireField("exCustomerName", "Ex.Customer Name");
  }

  if (lead.leadRef === "TECH TEAM") {
    requireField("techId", "Tech ID");
    requireField("techName", "Tech Name");
  }

  if (lead.status === "FOLLOWUP") {
    requireField("nextFollowDate", "Next follow date");
    requireField("currentUpdates", "Current updates");
  }

  if (lead.status === "ID CREATED") {
    requireField("customerId", "Customer ID");
    requireField("plan", "Plan");
    requireField("planValueWithoutGst", "Plan value");
    requireField("paymentMode", "Payment mode");
    requireField("otcWithoutGst", "OTC");
    requireField("depositWithoutGst", "Deposit");
    requireField("totalRevenueWithoutGst", "Total revenue");
  }

  if (lead.status === "CANCELLED") {
    requireField("feedback", "Feedback");
  }

  if (lead.status === "ORDER WIN") {
    requireField("paymentMode", "Payment mode");
    requireField("otcWithoutGst", "OTC");
    requireField("depositWithoutGst", "Deposit");
  }

  if (lead.mail && !/^\S+@\S+\.\S+$/.test(lead.mail)) {
    errors.push("Valid mail address is required");
  }

  if (lead.mobileNo && !/^[0-9+\-\s]{10,15}$/.test(lead.mobileNo)) {
    errors.push("Valid mobile number is required");
  }

  return errors;
};

const getLeadMutationValues = (lead) => [
  lead.activityType,
  lead.customerType,
  lead.interestedIn,
  lead.connectionType,
  lead.connectionStage,
  lead.customerName,
  lead.mobileNo,
  lead.mail,
  lead.address,
  lead.latitude,
  lead.longitude,
  lead.leadRef,
  lead.exCustomerId,
  lead.exCustomerName,
  lead.techId,
  lead.techName,
  lead.remarks,
  lead.status,
  lead.nextFollowDate || null,
  lead.currentUpdates,
  lead.customerId,
  lead.plan,
  lead.planValueWithoutGst,
  lead.totalRevenueWithoutGst,
  lead.feedback,
  lead.paymentMode,
  lead.otcWithoutGst,
  lead.depositWithoutGst,
  lead.empId,
  lead.empName,
  lead.vendorMovement,
  lead.moveToAsm,
  lead.connectionBranch,
  lead.zone,
  lead.branch,
  lead.date,
];

const buildLeadWhereClause = (query = {}) => {
  const clauses = [];
  const params = [];

  const search = normalizeText(query.search);
  if (search) {
    const like = `%${search}%`;
    clauses.push(`(
      customer_name LIKE ?
      OR lead_number LIKE ?
      OR zone LIKE ?
      OR branch LIKE ?
      OR connection_branch LIKE ?
      OR activity_type LIKE ?
      OR status LIKE ?
      OR emp_name LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }

  const employee = normalizeText(query.employee);
  if (employee) {
    clauses.push("emp_name = ?");
    params.push(employee);
  }

  const status = normalizeText(query.status);
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }

  const activityType = normalizeText(query.activityType);
  if (activityType) {
    clauses.push("activity_type = ?");
    params.push(activityType);
  }

  return {
    whereClause: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
};

const getLeads = async (req, res) => {
  try {
    const { whereClause, params } = buildLeadWhereClause(req.query);
    const [rows] = await db.query(
      `${LEAD_SELECT}${whereClause} ORDER BY updated_at DESC, id DESC`,
      params
    );

    res.json(rows.map(mapLeadRow));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leads", error: error.message });
  }
};

const exportLeads = async (req, res) => {
  try {
    const { whereClause, params } = buildLeadWhereClause(req.query);
    const [rows] = await db.query(
      `${LEAD_SELECT}${whereClause} ORDER BY updated_at DESC, id DESC`,
      params
    );

    const exportRows = rows.map(mapLeadRow).map((row) => ({
      ID: row.id,
      "LEAD NUMBER": row.leadNumber,
      "ACTIVITY TYPE": row.activityType,
      "CUSTOMER TYPE": row.customerType,
      "INTERESTED IN": row.interestedIn,
      "CONNECTION TYPE": row.connectionType,
      "CONNECTION STAGE": row.connectionStage,
      "CUSTOMER NAME": row.customerName,
      "MOBILE NO": row.mobileNo,
      MAIL: row.mail,
      ADDRESS: row.address,
      "LAT LONG": row.latLong,
      "LEAD REF": row.leadRef,
      "EX CUSTOMER ID": row.exCustomerId,
      "EX CUSTOMER NAME": row.exCustomerName,
      "TECH ID": row.techId,
      "TECH NAME": row.techName,
      REMARKS: row.remarks,
      STATUS: row.status,
      "NEXT FOLLOW DATE": row.nextFollowDate,
      "CURRENT UPDATES": row.currentUpdates,
      "CUSTOMER ID": row.customerId,
      PLAN: row.plan,
      "PLAN VALUE WITHOUT GST": row.planValueWithoutGst,
      "TOTAL REVENUE WITHOUT GST": row.totalRevenueWithoutGst,
      FEEDBACK: row.feedback,
      "PAYMENT MODE": row.paymentMode,
      "OTC WITHOUT GST": row.otcWithoutGst,
      "DEPOSIT WITHOUT GST": row.depositWithoutGst,
      "EMP ID": row.empId,
      "EMP NAME": row.empName,
      "VENDOR MOVEMENT": row.vendorMovement,
      "MOVE TO ASM": row.moveToAsm,
      "CONNECTION BRANCH": row.connectionBranch,
      ZONE: row.zone,
      BRANCH: row.branch,
      "LEAD DATE": row.date,
      "CREATED AT": row.createdAt ? new Date(row.createdAt).toLocaleString() : "",
      "UPDATED AT": row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "New Connections");
    const workbookBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=new_connection_requests.xlsx"
    );
    return res.send(workbookBuffer);
  } catch (error) {
    res.status(500).json({
      message: "Failed to export leads Excel",
      error: error.message,
    });
  }
};

const getLeadById = async (req, res) => {
  try {
    const [rows] = await db.query(`${LEAD_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);
    const lead = rows[0];

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.json(mapLeadRow(lead));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch lead", error: error.message });
  }
};

const createLead = async (req, res) => {
  try {
    const lead = sanitizeLead(req.body, {}, req.user || {});
    const errors = validateLead(lead);

    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const placeholders = LEAD_MUTATION_COLUMNS.map(() => "?").join(", ");
    const insertSql = `
      INSERT INTO leads (${LEAD_MUTATION_COLUMNS.join(", ")})
      VALUES (${placeholders})
    `;

    const [result] = await db.query(insertSql, getLeadMutationValues(lead));
    const leadSequenceType = getLeadSequenceType({
      interestedIn: lead.interestedIn,
      connectionType: lead.connectionType,
      plan: lead.plan,
    });
    const [[sequenceRow]] = await db.query(
      `
        SELECT COUNT(*) AS raisedCount
        FROM leads
        WHERE emp_id = ?
          AND (
            CASE
              WHEN UPPER(TRIM(interested_in)) = 'IOT' THEN 'IOT'
              ELSE COALESCE(connection_type, '')
            END
          ) = ?
          AND id <= ?
      `,
      [lead.empId, leadSequenceType, result.insertId]
    );
    const leadNumber = buildLeadNumber({
      empId: lead.empId,
      connectionType: leadSequenceType,
      sequence: Number(sequenceRow?.raisedCount || 0) || 1,
    });
    await db.query(
      "UPDATE leads SET lead_number = COALESCE(lead_number, ?) WHERE id = ?",
      [leadNumber, result.insertId]
    );
    const [rows] = await db.query(`${LEAD_SELECT} WHERE id = ? LIMIT 1`, [result.insertId]);

    return res.status(201).json(mapLeadRow(rows[0]));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const duplicateField = error.message.includes("uq_lead_number")
        ? "Lead number"
        : error.message.includes("uq_mobile")
          ? "Mobile number"
          : "Lead data";
      return res.status(400).json({
        message: `${duplicateField} already exists`,
        error: error.message,
      });
    }

    return res.status(500).json({ message: "Failed to create lead", error: error.message });
  }
};

const updateLead = async (req, res) => {
  try {
    const [existingRows] = await db.query(`${LEAD_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);
    const existingLead = existingRows[0];

    if (!existingLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const updatedLead = sanitizeLead(req.body, mapLeadRow(existingLead), req.user || {});
    const errors = validateLead(updatedLead);

    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const assignments = LEAD_MUTATION_COLUMNS.map((column) => `${column} = ?`).join(", ");
    await db.query(
      `UPDATE leads SET ${assignments} WHERE id = ?`,
      [...getLeadMutationValues(updatedLead), req.params.id]
    );

    const [rows] = await db.query(`${LEAD_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);
    return res.json(mapLeadRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: "Failed to update lead", error: error.message });
  }
};

const deleteLead = async (req, res) => {
  try {
    const [rows] = await db.query(`${LEAD_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);
    const lead = rows[0];

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await db.query("DELETE FROM leads WHERE id = ?", [req.params.id]);

    return res.json({
      message: "Lead deleted successfully",
      lead: mapLeadRow(lead),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete lead", error: error.message });
  }
};

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  exportLeads,
};
