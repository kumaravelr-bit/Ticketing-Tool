import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import styles from "../css/OfferLetterRequest.module.css";
import { useNavigate } from "react-router-dom";
import { generateOfferLetter } from "../services/hrdService";

export default function OfferLetterRequest() {

  const navigate = useNavigate();

  // ✅ SINGLE SOURCE OF TRUTH
  const initialFormState = {
    employee_name: "",
    email: "",
    phone: "",
    location: "",
    designation: "",
    team_name: "",
    doj: "",
    gender: "",
    marital_status: "",
    grade: "",
    probation_period: "3",
    grossPay: "",
    insurance: 0
  };

  const [formData, setFormData] = useState(initialFormState);

  // ✅ HANDLE INPUT (OPTIMIZED)
  const handleChange = ({ target: { name, value } }) => {
    setFormData((prev) => {
      if (name === "grossPay" || name === "insurance") {
        let num = Number(value);
        if (num < 0) {
          toast.error(`${name} cannot be negative`);
          num = 0;
        }
        return { ...prev, [name]: num };
      }
      return { ...prev, [name]: value };
    });
  };

  // 🚫 BLOCK INVALID KEYS
  const preventInvalidKeys = (e) => {
    if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
  };

  // ✅ CALCULATION (OPTIMIZED WITH useMemo)
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
      annualCTC
    };

  }, [formData]);

  // ✅ RESET
  const resetForm = () => setFormData(initialFormState);

  // ✅ GENERATE OFFER LETTER
const handleGenerate = async () => {
  try {
    await generateOfferLetter(formData); // ✅ just call API

    toast.success("✅ Offer Letter Generated");

    resetForm();

    setTimeout(() => navigate("/hrd/offer-letter"), 1200);

  } catch (err) {
    console.error(err);
    toast.error("❌ Error generating offer letter");
  }
};

  // ✅ FORMAT ₹
  const formatCurrency = (val) =>
    val
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0
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
        {[
          { label: "Employee Name", name: "employee_name" },
          { label: "Email", name: "email" },
          { label: "Phone", name: "phone" },
          { label: "Location", name: "location" },
          { label: "Designation", name: "designation" },
          { label: "Team Name", name: "team_name" }
        ].map((field) => (
          <div className={styles.formGroup} key={field.name}>
            <label>{field.label}</label>
            <input name={field.name} onChange={handleChange} />
          </div>
        ))}

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
            {["Trainee","G08","G07","G06","G05","G04","G03","G02","G01"].map(g => (
              <option key={g} value={g}>{g}</option>
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
                    formData.probation_period === val
                      ? "#c2b280"
                      : "#fff",
                  cursor: "pointer",
                  fontWeight: "600"
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
            min="0"
            onKeyDown={preventInvalidKeys}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Insurance</label>
          <input
            type="number"
            name="insurance"
            min="0"
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
          "Annual CTC": calc.annualCTC
        }).map(([label, value]) => (
          <div className={styles.formGroup} key={label}>
            <label>{label}</label>
            <input
              value={formatCurrency(value)}
              disabled
              className={styles.disabled}
            />
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