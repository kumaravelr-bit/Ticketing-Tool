import { useState, useMemo, useEffect } from "react";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/OfferLetterRequest.module.css";
import { useNavigate } from "react-router-dom";
import { generateOfferLetter } from "../../../services/hrdService";

import {
  getZones,
  getBranchesByZone,
  getTeams,
  getDesignations,
} from "../../../services/employeeService";

export default function OfferLetterRequest() {
  const navigate = useNavigate();

  // ✅ STATE
  const initialFormState = {
    employee_name: "",
    email: "",
    phone: "",
    zone_id: "",
    branch_id: "",
    designation: "",
    team_id: "",
    team_name: "",
    doj: "",
    gender: "",
    marital_status: "",
    grade: "",
    probation_period: "3",
    grossPay: "",
    insurance: 0,
  };

  const [formData, setFormData] = useState(initialFormState);

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);

  const getZoneId = (zone) => zone?.zone_id ?? zone?.id ?? "";
  const getZoneName = (zone) => zone?.name ?? zone?.zone_name ?? "";
  const getBranchId = (branch) => branch?.branch_id ?? branch?.id ?? "";
  const getBranchName = (branch) => branch?.name ?? branch?.branch_name ?? "";
  const getTeamId = (team) => team?.team_id ?? team?.id ?? "";
  const getTeamName = (team) => team?.name ?? team?.team_name ?? "";
  const getDesignationId = (designation) =>
    designation?.designation_id ?? designation?.id ?? "";
  const getDesignationName = (designation) =>
    designation?.name ?? designation?.designation_name ?? "";

  // ✅ LOAD INITIAL DATA
  useEffect(() => {
    loadZones();
    loadTeams();
  }, []);

  const loadZones = async () => {
    try {
      const res = await getZones();
      setZones(res.data || []);
    } catch {
      toast.error("Failed to load zones");
    }
  };

  const loadTeams = async () => {
    try {
      const res = await getTeams();
      setTeams(res.data || []);
    } catch {
      toast.error("Failed to load teams");
    }
  };

  // ✅ HANDLE CHANGE (FIXED + CLEAN)
  const handleChange = async ({ target: { name, value } }) => {
    // ✅ NUMBER HANDLING
    if (name === "grossPay" || name === "insurance") {
      let num = Number(value);
      if (num < 0) {
        toast.error(`${name} cannot be negative`);
        num = 0;
      }
      setFormData((prev) => ({ ...prev, [name]: num }));
      return;
    }

    // ✅ NORMAL UPDATE
    setFormData((prev) => ({ ...prev, [name]: value }));

    // 🔥 ZONE → LOAD BRANCHES
    if (name === "zone_id") {
      try {
        const res = await getBranchesByZone(value);
        setBranches(res.data || []);
        setFormData((prev) => ({ ...prev, branch_id: "" }));
      } catch {
        toast.error("Failed to load branches");
      }
    }

    // 🔥 TEAM → LOAD DESIGNATIONS
    if (name === "team_id") {
      try {
        const res = await getDesignations(value);
        setDesignations(res.data || []);

        const selectedTeam = teams.find(
          (team) => String(getTeamId(team)) === String(value),
        );

        setFormData((prev) => ({
          ...prev,
          team_id: value,
          team_name: getTeamName(selectedTeam),
          designation: "",
        }));
      } catch {
        toast.error("Failed to load designations");
      }
    }
  };

  // 🚫 BLOCK INVALID KEYS
  const preventInvalidKeys = (e) => {
    if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
  };

  // ✅ SALARY CALCULATION
  const calc = useMemo(() => {
    const gp = Math.max(0, Number(formData.grossPay || 0));
    const insurance = Math.max(0, Number(formData.insurance || 0));

    if (!gp) return {};

    const round = (v) => Math.round(v);

    const basic = round(gp * 0.6);
    const hra = round(gp * 0.2);
    const other = round(gp - (basic + hra));
    const grossA = basic + hra + other;

    const esiEmp = grossA >= 21000 ? 0 : round((grossA * 0.75) / 100);

    const pfBase = basic + other;
    const pfEmp = pfBase >= 15000 ? 1800 : round((pfBase * 12) / 100);

    const totalA = esiEmp + pfEmp + insurance;
    const takeHome = grossA - totalA;

    const esiEmployer = grossA >= 21000 ? 0 : round((grossA * 3.25) / 100);
    const pfEmployer = pfBase >= 15000 ? 1800 : round((pfBase * 12) / 100);

    const totalB = esiEmployer + pfEmployer;
    const monthlyCTC = grossA + totalB;
    const annualCTC = monthlyCTC * 12;

    return {
      basic,
      hra,
      other,
      grossA,
      esiEmp,
      pfEmp,
      totalA,
      takeHome,
      esiEmployer,
      pfEmployer,
      totalB,
      monthlyCTC,
      annualCTC,
    };
  }, [formData]);

  // ✅ RESET
  const resetForm = () => {
    setFormData(initialFormState);
    setBranches([]);
    setDesignations([]);
  };

  // ✅ GENERATE
  const handleGenerate = async () => {
    try {
      if (!formData.zone_id || !formData.branch_id) {
        toast.error("Zone & Branch are required");
        return;
      }

      await generateOfferLetter(formData);

      toast.success("✅ Offer Letter Generated");

      resetForm();

      setTimeout(() => navigate("/hrd/offer-letter"), 1200);
    } catch (err) {
      console.error(err);
      toast.error("❌ Error generating offer letter");
    }
  };

  // ✅ FORMAT
  const formatCurrency = (val) =>
    val
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(val)
      : "";

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/hrd/offer-letter")}
        >
          ← Back to Dashboard
        </button>
      </div>

      <h2 className={styles.title}>Offer Letter Request</h2>

      <div className={styles.grid}>
        {/* BASIC */}
        <div className={styles.formGroup}>
          <label>Employee Name</label>
          <input name="employee_name" onChange={handleChange} />
        </div>

        <div className={styles.formGroup}>
          <label>Email</label>
          <input name="email" onChange={handleChange} />
        </div>

        <div className={styles.formGroup}>
          <label>Phone</label>
          <input name="phone" onChange={handleChange} />
        </div>

        {/* ZONE */}
        <div className={styles.formGroup}>
          <label>Zone</label>
          <select
            name="zone_id"
            value={formData.zone_id}
            onChange={handleChange}
          >
            <option value="">Select Zone</option>
            {zones.map((z) => (
              <option key={getZoneId(z)} value={getZoneId(z)}>
                {getZoneName(z)}
              </option>
            ))}
          </select>
        </div>

        {/* BRANCH */}
        <div className={styles.formGroup}>
          <label>Branch</label>
          <select
            name="branch_id"
            value={formData.branch_id}
            onChange={handleChange}
          >
            <option value="">Select Branch</option>
            {branches.map((b) => (
              <option key={getBranchId(b)} value={getBranchId(b)}>
                {getBranchName(b)}
              </option>
            ))}
          </select>
        </div>

        {/* TEAM */}
        <div className={styles.formGroup}>
          <label>Team</label>
          <select
            name="team_id"
            value={formData.team_id}
            onChange={handleChange}
          >
            <option value="">Select Team</option>
            {teams.map((t) => (
              <option key={getTeamId(t)} value={getTeamId(t)}>
                {getTeamName(t)}
              </option>
            ))}
          </select>
        </div>

        {/* DESIGNATION */}
        <div className={styles.formGroup}>
          <label>Designation</label>
          <select
            name="designation"
            value={formData.designation}
            onChange={handleChange}
          >
            <option value="">Select Designation</option>
            {designations.map((d) => (
              <option key={getDesignationId(d)} value={getDesignationName(d)}>
                {getDesignationName(d)}
              </option>
            ))}
          </select>
        </div>

        {/* DATE */}
        <div className={styles.formGroup}>
          <label>DOJ</label>
          <input type="date" name="doj" onChange={handleChange} />
        </div>

        {/* GENDER */}
        <div className={styles.formGroup}>
          <label>Gender</label>
          <select name="gender" onChange={handleChange}>
            <option value="">Select</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHERS">Others</option>
          </select>
        </div>

        {/* MARITAL */}
        <div className={styles.formGroup}>
          <label>Marital Status</label>
          <select name="marital_status" onChange={handleChange}>
            <option value="">Select</option>
            <option value="SINGLE">Single</option>
            <option value="MARRIED">Married</option>
          </select>
        </div>

        {/* GRADE */}
        <div className={styles.formGroup}>
          <label>Grade</label>
          <select name="grade" onChange={handleChange}>
            <option value="">Select</option>
            {[
              "Trainee",
              "G08",
              "G07",
              "G06",
              "G05",
              "G04",
              "G03",
              "G02",
              "G01",
            ].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* PROBATION */}
        <div className={styles.formGroup}>
          <label>Probation Period</label>
          <div style={{ display: "flex", gap: "10px" }}>
            {["3", "6"].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, probation_period: val }))
                }
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border:
                    formData.probation_period === val
                      ? "2px solid #c2b280"
                      : "1px solid #ccc",
                  background:
                    formData.probation_period === val ? "#c2b280" : "#fff",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                {val} Months
              </button>
            ))}
          </div>
        </div>

        {/* SALARY */}
        <div className={styles.formGroup}>
          <label>Gross Pay</label>
          <input
            type="number"
            name="grossPay"
            onKeyDown={preventInvalidKeys}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Insurance</label>
          <input
            type="number"
            name="insurance"
            onKeyDown={preventInvalidKeys}
            onChange={handleChange}
          />
        </div>

        {/* RESULT */}
        <div className={`${styles.section} ${styles.full}`}>
          Auto Calculated Salary
        </div>

        {Object.entries({
          Basic: calc.basic,
          HRA: calc.hra,
          "Other Allowance": calc.other,
          "Gross Salary A": calc.grossA,
          "Take Home": calc.takeHome,
          "Monthly CTC": calc.monthlyCTC,
          "Annual CTC": calc.annualCTC,
        }).map(([label, value]) => (
          <div className={styles.formGroup} key={label}>
            <label>{label}</label>
            <input value={formatCurrency(value)} disabled />
          </div>
        ))}

        {/* BUTTON */}
        <div className={styles.full}>
          <button className={styles.button} onClick={handleGenerate}>
            Generate Offer Letter
          </button>
        </div>
      </div>
    </div>
  );
}
