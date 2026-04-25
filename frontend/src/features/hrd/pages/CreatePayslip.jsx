import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/CreatePayslip.module.css";
import { getEmployees, createPayslip } from "../../../services/payslipService";
import { getTeams, getZones, getBranchesByZone, getDesignations } from "../../../services/employeeService";
import {
  PAYSLIP_COMPONENTS,
  PAYSLIP_MONTHS,
  buildInitialComponents,
  calculatePayableSalaryDays,
  calculatePayslipTotals,
  safeNumber,
  formatCurrency,
} from "./payslipUtils";

const initialState = {
  employee_id: "",
  emp_id: "",
  employee_name: "",
  email: "",
  department: "",
  designation_id: "",
  designation_name: "",
  doj: "",
  location: "",
  zone_id: "",
  branch_id: "",
  team_id: "",
  salary_month: new Date().getMonth() + 1,
  salary_year: new Date().getFullYear(),
  salary_date: "",
  account_number: "",
  lop: 0,
  salary_days: 30,
  remarks: "",
  components: buildInitialComponents(),
};

export default function CreatePayslip() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(initialState);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [zonesRes, teamsRes] = await Promise.all([getZones(), getTeams()]);
        setZones(zonesRes.data || []);
        setTeams(teamsRes.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load master data");
      }
    };

    loadMasterData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!employeeSearch.trim()) {
        setEmployees([]);
        return;
      }
      try {
        setLoadingEmployees(true);
        const res = await getEmployees({ search: employeeSearch, limit: 10 });
        setEmployees(res.data?.data || []);
      } catch (error) {
        console.error(error);
        toast.error("Failed to search employees");
      } finally {
        setLoadingEmployees(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [employeeSearch]);

  const totals = useMemo(
    () => calculatePayslipTotals(formData.components),
    [formData.components],
  );
  const payableSalaryDays = useMemo(
    () => calculatePayableSalaryDays(formData.salary_days, formData.lop),
    [formData.salary_days, formData.lop],
  );

  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateComponent = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      components: {
        ...prev.components,
        [key]: value === "" ? "" : safeNumber(value),
      },
    }));
  };

  const handleZoneChange = async (value) => {
    updateField("zone_id", value);
    updateField("branch_id", "");
    if (!value) {
      setBranches([]);
      return;
    }
    try {
      const res = await getBranchesByZone(value);
      setBranches(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load branches");
    }
  };

  const handleTeamChange = async (value) => {
    updateField("team_id", value);
    updateField("designation_id", "");
    updateField("designation_name", "");
    if (!value) {
      setDesignations([]);
      return;
    }
    try {
      const res = await getDesignations(value);
      setDesignations(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load designations");
    }
  };

  const handleEmployeeSelect = async (employee) => {
    setFormData((prev) => ({
      ...prev,
      employee_id: employee.id,
      emp_id: employee.emp_id || "",
      employee_name: employee.employee_name || "",
      email: employee.email || "",
      account_number: employee.account_number || "",
      department: employee.department || "",
      designation_id: employee.designation_id || "",
      designation_name: employee.designation_name || "",
      doj: employee.doj || "",
      location: employee.location || "",
      zone_id: employee.zone_id || "",
      branch_id: employee.branch_id || "",
      team_id: employee.team_id || "",
    }));

    setEmployeeSearch(`${employee.emp_id} - ${employee.employee_name}`);
    setEmployees([]);

    if (employee.zone_id) {
      try {
        const branchRes = await getBranchesByZone(employee.zone_id);
        setBranches(branchRes.data || []);
      } catch (error) {
        console.error(error);
      }
    }

    if (employee.team_id) {
      try {
        const designationRes = await getDesignations(employee.team_id);
        setDesignations(designationRes.data || []);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.employee_id) {
        toast.error("Please select an employee");
        return;
      }
      if (!formData.salary_month || !formData.salary_year || !formData.salary_date) {
        toast.error("Salary month, year and salary date are required");
        return;
      }

      setSubmitting(true);

      const payload = {
        employee_id: formData.employee_id,
        salary_month: Number(formData.salary_month),
        salary_year: Number(formData.salary_year),
        salary_date: formData.salary_date,
        account_number: String(formData.account_number || "").trim(),
        lop: safeNumber(formData.lop),
        salary_days: payableSalaryDays,
        remarks: formData.remarks,
        total_earnings: totals.totalEarnings,
        total_deductions: totals.totalDeductions,
        net_pay: totals.netPay,
        components: PAYSLIP_COMPONENTS.map((item) => ({
          component_key: item.key,
          component_label: item.label,
          component_type: item.type,
          amount: safeNumber(formData.components[item.key]),
        })),
      };

      await createPayslip(payload);
      toast.success("Payslip created successfully");
      navigate("/hrd/payslip");
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Failed to create payslip");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate("/hrd/payslip")}>Back to Dashboard</button>
      </div>

      <h2 className={styles.title}>Create Payslip</h2>

      <div className={styles.grid}>
        <div className={`${styles.formGroup} ${styles.full}`}>
          <label>Search Employee</label>
          <input
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            placeholder="Search by EMP ID / Name / Email"
          />
          {loadingEmployees && <small>Searching...</small>}
          {!loadingEmployees && employees.length > 0 && (
            <div className={styles.searchResults}>
              {employees.map((emp) => (
                <button
                  type="button"
                  key={emp.id}
                  className={styles.searchItem}
                  onClick={() => handleEmployeeSelect(emp)}
                >
                  {emp.emp_id} - {emp.employee_name} - {emp.email}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.formGroup}><label>EMP ID</label><input value={formData.emp_id} disabled /></div>
        <div className={styles.formGroup}><label>Employee Name</label><input value={formData.employee_name} disabled /></div>
        <div className={styles.formGroup}><label>Email</label><input value={formData.email} disabled /></div>
        <div className={styles.formGroup}><label>Account Number</label><input value={formData.account_number} onChange={(e) => updateField("account_number", e.target.value)} placeholder="Enter account number" /></div>
        <div className={styles.formGroup}><label>Department</label><input value={formData.department} disabled /></div>
        <div className={styles.formGroup}><label>DOJ</label><input value={formData.doj ? new Date(formData.doj).toLocaleDateString("en-IN") : ""} disabled /></div>
        <div className={styles.formGroup}><label>Location</label><input value={formData.location} disabled /></div>

        <div className={styles.formGroup}>
          <label>Zone</label>
          <select value={formData.zone_id} onChange={(e) => handleZoneChange(e.target.value)}>
            <option value="">Select Zone</option>
            {zones.map((zone) => (
              <option key={zone.id ?? zone.zone_id} value={zone.id ?? zone.zone_id}>
                {zone.zone_name ?? zone.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Branch</label>
          <select value={formData.branch_id} onChange={(e) => updateField("branch_id", e.target.value)}>
            <option value="">Select Branch</option>
            {branches.map((branch) => (
              <option key={branch.id ?? branch.branch_id} value={branch.id ?? branch.branch_id}>
                {branch.branch_name ?? branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Team</label>
          <select value={formData.team_id} onChange={(e) => handleTeamChange(e.target.value)}>
            <option value="">Select Team</option>
            {teams.map((team) => (
              <option key={team.id ?? team.team_id} value={team.id ?? team.team_id}>
                {team.team_name ?? team.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Designation</label>
          <select
            value={formData.designation_id}
            onChange={(e) => {
              const selected = designations.find((item) => String(item.id ?? item.designation_id) === String(e.target.value));
              updateField("designation_id", e.target.value);
              updateField("designation_name", selected?.designation_name ?? selected?.name ?? "");
            }}
          >
            <option value="">Select Designation</option>
            {designations.map((designation) => (
              <option key={designation.id ?? designation.designation_id} value={designation.id ?? designation.designation_id}>
                {designation.designation_name ?? designation.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Salary Month</label>
          <select value={formData.salary_month} onChange={(e) => updateField("salary_month", e.target.value)}>
            {PAYSLIP_MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Salary Year</label>
          <input type="number" value={formData.salary_year} onChange={(e) => updateField("salary_year", e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label>Salary Date</label>
          <input type="date" value={formData.salary_date} onChange={(e) => updateField("salary_date", e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label>LOP</label>
          <input type="number" min="0" step="0.5" value={formData.lop} onChange={(e) => updateField("lop", e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label>Total Salary Days</label>
          <input type="number" min="0" step="0.5" value={formData.salary_days} onChange={(e) => updateField("salary_days", e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label>Payable Salary Days</label>
          <input type="number" min="0" step="0.5" value={payableSalaryDays} disabled />
        </div>

        <div className={`${styles.section} ${styles.full}`}>Salary Components</div>

        {PAYSLIP_COMPONENTS.map((item) => (
          <div className={styles.formGroup} key={item.key}>
            <label>{item.label}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.components[item.key]}
              placeholder="Enter amount"
              onChange={(e) => updateComponent(item.key, e.target.value)}
            />
          </div>
        ))}

        <div className={`${styles.section} ${styles.full}`}>Totals</div>

        <div className={styles.formGroup}><label>Total Earnings</label><input value={formatCurrency(totals.totalEarnings)} disabled /></div>
        <div className={styles.formGroup}><label>Total Deductions</label><input value={formatCurrency(totals.totalDeductions)} disabled /></div>
        <div className={styles.formGroup}><label>Net Pay</label><input value={formatCurrency(totals.netPay)} disabled /></div>

        <div className={`${styles.formGroup} ${styles.full}`}>
          <label>Remarks</label>
          <textarea value={formData.remarks} onChange={(e) => updateField("remarks", e.target.value)} rows="4" />
        </div>

        <div className={styles.full}>
          <button className={styles.button} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Payslip"}
          </button>
        </div>
      </div>
    </div>
  );
}
