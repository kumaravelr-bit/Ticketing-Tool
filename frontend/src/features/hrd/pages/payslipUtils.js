export const PAYSLIP_COMPONENTS = [
  { key: "basicPay", label: "Basic Pay", type: "EARNING" },
  { key: "hra", label: "HRA", type: "EARNING" },
  { key: "otherAllowance", label: "Other Allowance", type: "EARNING" },
  { key: "foodAllowance", label: "Food Allowance", type: "EARNING" },
  { key: "vehicleAllowance", label: "Vehicle Allowance", type: "EARNING" },
  { key: "ot", label: "OT", type: "EARNING" },
  { key: "positionAllowance", label: "Position Allowance", type: "EARNING" },
  { key: "arrear", label: "Arrear", type: "EARNING" },
  { key: "holidayPay", label: "Holiday Pay", type: "EARNING" },
  { key: "esi", label: "ESI", type: "DEDUCTION" },
  { key: "pf", label: "PF", type: "DEDUCTION" },
  { key: "insurance", label: "Insurance", type: "DEDUCTION" },
  { key: "uniform", label: "Uniform", type: "DEDUCTION" },
  { key: "specialDeductions", label: "Special Deductions", type: "DEDUCTION" },
  { key: "salaryAdvance", label: "Salary Advance", type: "DEDUCTION" },
  { key: "tds", label: "TDS", type: "DEDUCTION" },
];

export const safeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
};

export const buildInitialComponents = () =>
  PAYSLIP_COMPONENTS.reduce((acc, component) => {
    acc[component.key] = "";
    return acc;
  }, {});

export const mapComponentsFromApi = (components = []) => {
  const initial = buildInitialComponents();

  for (const item of components) {
    if (item?.component_key && Object.prototype.hasOwnProperty.call(initial, item.component_key)) {
      initial[item.component_key] = safeNumber(item.amount);
    }
  }

  return initial;
};

export const calculatePayslipTotals = (components = {}) => {
  const totals = PAYSLIP_COMPONENTS.reduce(
    (acc, component) => {
      const amount = safeNumber(components[component.key]);
      if (component.type === "EARNING") {
        acc.totalEarnings += amount;
      } else {
        acc.totalDeductions += amount;
      }
      return acc;
    },
    { totalEarnings: 0, totalDeductions: 0 },
  );

  totals.totalEarnings = safeNumber(totals.totalEarnings);
  totals.totalDeductions = safeNumber(totals.totalDeductions);
  totals.netPay = safeNumber(totals.totalEarnings - totals.totalDeductions);
  return totals;
};

export const calculatePayableSalaryDays = (salaryDays, lop) =>
  safeNumber(Math.max(safeNumber(salaryDays) - safeNumber(lop), 0));

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));

export const PAYSLIP_MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2000, index, 1).toLocaleString("en-IN", { month: "long" }),
}));
