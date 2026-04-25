import { getAuthItem, getAuthUser } from "../../utils/auth";

export const getLoggedInLeadOwner = () => {
  const user = getAuthUser() || {};
  const today = new Date().toISOString().slice(0, 10);

  return {
    empId: user.emp_id || user.employee_id || getAuthItem("emp_id") || "",
    empName: user.name || user.emp_name || user.employee_name || "",
    date: today,
  };
};

export const getLoggedInLeadAccess = () => {
  const user = getAuthUser() || {};
  const role = String(user.role || getAuthItem("role") || "")
    .trim()
    .toUpperCase();
  const team = String(user.team_name || user.team || getAuthItem("team") || "")
    .trim()
    .toUpperCase();
  const designation = String(
    user.designation_name ||
      user.designation ||
      getAuthItem("designation_name") ||
      getAuthItem("designation") ||
      ""
  )
    .trim()
    .toUpperCase();

  return {
    role,
    team,
    designation,
    canDelete: ["ADMIN", "SUPER_ADMIN"].includes(role),
    isSalesBdeLike:
      team === "SALES" && ["BDE", "BDM", "BDO"].includes(designation),
  };
};

const getLoggedInEmpId = () => {
  return getAuthUser()?.emp_id || getAuthUser()?.employee_id || getAuthItem("emp_id") || "";
};

const getLoggedInEmpName = () => {
  return getAuthUser()?.name || getAuthUser()?.emp_name || "";
};

export const createEmptyLead = () => {
  const owner = getLoggedInLeadOwner();

  return {
    activityType: "TELECALLS",
    customerType: "NEW CUSTOMER",
    interestedIn: "INTERNET",
    connectionType: "BB",
    connectionStage: "HOT",
    customerName: "",
    mobileNo: "",
    mail: "",
    address: "",
    latLong: "",
    leadRef: "SELF",
    exCustomerId: "",
    exCustomerName: "",
    techId: "",
    techName: "",
    remarks: "",
    status: "FOLLOWUP",
    nextFollowDate: "",
    currentUpdates: "",
    customerId: "",
    plan: "",
    planValueWithoutGst: "",
    totalRevenueWithoutGst: "",
    feedback: "",
    paymentMode: "MONTHLY",
    otcWithoutGst: "",
    depositWithoutGst: "",
    empId: owner.empId,
    empName: owner.empName,
    vendorMovement: "",
    moveToAsm: "",
    connectionBranch: "",
    zone: "",
    branch: "",
    date: owner.date,
  };
};

export const DB_ACTIVITY_TYPES = ["TELECALLS", "DIRECT VISIT"];
export const DB_CUSTOMER_TYPES = ["NEW CUSTOMER", "EXISTING CUSTOMER"];
export const DB_INTEREST_OPTIONS = ["INTERNET", "IOT"];
export const DB_CONNECTION_TYPES = ["BB", "ILL", "LIVE EVENT", "SME"];
export const DB_CONNECTION_STAGES = ["HOT", "COLD", "WARM"];
export const DB_LEAD_REFS = [
  "CUSTOMER",
  "SELF",
  "TECH TEAM",
  "IVR",
  "FACEBOOK",
  "WEBSITE",
  "GOOGLE BUSINESS",
  "INSTAGRAM",
];
export const DB_STATUS_OPTIONS = ["FOLLOWUP", "ID CREATED", "CANCELLED", "ORDER WIN"];
export const DB_PAYMENT_MODES = ["MONTHLY", "QUARTERLY", "HALF YEARLY", "YEARLY"];

export const getEmployeeDirectory = () => {
  const empId = getLoggedInEmpId();
  const empName = getLoggedInEmpName();

  if (!empId && !empName) {
    return [];
  }

  return [
    {
      empId,
      empName,
      vendorMovement: "",
    },
  ];
};

export const normalizeLeadForForm = (lead) => {
  if (!lead) {
    return createEmptyLead();
  }

  return {
    ...createEmptyLead(),
    ...lead,
    date: lead.date ? String(lead.date).slice(0, 10) : createEmptyLead().date,
    nextFollowDate: lead.nextFollowDate ? String(lead.nextFollowDate).slice(0, 10) : "",
  };
};

export const getMonthLabel = (dateValue) => {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
};

export const syncEmployeeFields = (employeeName) => {
  const selectedEmployee = getEmployeeDirectory().find(
    (employee) => employee.empName === employeeName
  );

  if (!selectedEmployee) {
    return {};
  }

  return {
    empId: selectedEmployee.empId || "",
    empName: selectedEmployee.empName,
    vendorMovement: selectedEmployee.vendorMovement,
  };
};

export const syncEmployeeByVendorMovement = (vendorMovement) => {
  const selectedEmployee = getEmployeeDirectory().find(
    (employee) => employee.vendorMovement === vendorMovement
  );

  if (!selectedEmployee) {
    return {
      vendorMovement,
    };
  }

  return {
    empId: selectedEmployee.empId,
    empName: selectedEmployee.empName,
    vendorMovement: selectedEmployee.vendorMovement,
  };
};

export const validateLeadForm = (form) => {
  const errors = {};
  const requireField = (key, label) => {
    if (!String(form[key] || "").trim()) {
      errors[key] = `${label} is required`;
    }
  };

  requireField("customerName", "Customer name");
  requireField("mobileNo", "Mobile no");
  requireField("address", "Address");
  requireField("latLong", "Lat/Long");
  requireField("connectionBranch", "Connection branch");
  requireField("zone", "Zone");
  requireField("branch", "Branch");
  requireField("date", "Date");
  requireField("empId", "Employee ID");
  requireField("empName", "Employee name");
  if (form.leadRef === "CUSTOMER") {
    requireField("exCustomerId", "Ex.Customer ID");
    requireField("exCustomerName", "Ex.Customer Name");
  }

  if (form.leadRef === "TECH TEAM") {
    requireField("techId", "Tech ID");
    requireField("techName", "Tech Name");
  }

  if (form.status === "FOLLOWUP") {
    requireField("nextFollowDate", "Next follow date");
    requireField("currentUpdates", "Current updates");
  }

  if (form.status === "ID CREATED") {
    requireField("customerId", "Customer ID");
    requireField("plan", "Plan");
    requireField("planValueWithoutGst", "Plan value");
    requireField("paymentMode", "Payment mode");
    requireField("otcWithoutGst", "OTC");
    requireField("depositWithoutGst", "Deposit");
    requireField("totalRevenueWithoutGst", "Total revenue");
  }

  if (form.status === "CANCELLED") {
    requireField("feedback", "Feedback");
  }

  if (form.status === "ORDER WIN") {
    requireField("paymentMode", "Payment mode");
    requireField("otcWithoutGst", "OTC");
    requireField("depositWithoutGst", "Deposit");
  }

  if (form.mail && !/^\S+@\S+\.\S+$/.test(form.mail)) {
    errors.mail = "Enter a valid mail address";
  }

  if (form.mobileNo && !/^[0-9+\-\s]{10,15}$/.test(form.mobileNo)) {
    errors.mobileNo = "Enter a valid mobile number";
  }

  return errors;
};
