import { getAuthItem, getAuthUser } from "../../utils/auth";

const buildEmployeeDirectory = () => {
  const user = getAuthUser() || {};
  const empId = user.emp_id || user.employee_id || getAuthItem("emp_id") || "";
  const empName = user.name || user.emp_name || "";

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

export const ACTIVITY_TYPES = ["TELECALLS", "DIRECT VISIT"];
export const CUSTOMER_TYPES = ["NEW CUSTOMER", "EXISTING CUSTOMER"];
export const INTEREST_OPTIONS = ["INTERNET", "IOT"];
export const CONNECTION_TYPES = ["BB", "ILL", "LIVE EVENT", "SME"];
export const CONNECTION_STAGES = ["HOT", "COLD", "WARM"];
export const LEAD_REFS = [
  "CUSTOMER",
  "SELF",
  "TECH TEAM",
  "IVR",
  "FACEBOOK",
  "WEBSITE",
  "GOOGLE BUSINESS",
  "INSTAGRAM",
];
export const STATUS_OPTIONS = ["FOLLOWUP", "ID CREATED", "CANCELLED", "ORDER WIN"];
export const PAYMENT_MODES = ["MONTHLY", "QUARTERLY", "HALF YEARLY", "YEARLY"];
export const EMPLOYEE_DIRECTORY = buildEmployeeDirectory();

export const ZONE_OPTIONS = [];
export const BRANCH_OPTIONS = [];
export const CONNECTION_BRANCH_OPTIONS = [];
export const ASM_OPTIONS = [];
export const VENDOR_MOVEMENT_OPTIONS = [];
