import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/OfferLetterRequest.module.css";
import { getOfferLetterById, updateOfferLetter } from "../../../services/hrdService";
import {
  getZones,
  getBranchesByZone,
  getTeams,
  getDesignations
} from "../../../services/employeeService";

export default function OfferLetterEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

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
    insurance: ""
  };

  const [formData, setFormData] = useState(initialFormState);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChanged, setIsChanged] = useState(false);
  const [documentId, setDocumentId] = useState("");

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

  useEffect(() => {
    if (!id) return;

    const loadEditData = async () => {
      try {
        setIsLoading(true);

        const [offerRes, zoneRes, teamRes] = await Promise.all([
          getOfferLetterById(id),
          getZones(),
          getTeams()
        ]);

        const offer = offerRes.data || {};
        const zoneList = Array.isArray(zoneRes?.data) ? zoneRes.data : [];
        const teamList = Array.isArray(teamRes?.data) ? teamRes.data : [];

        setZones(zoneList);
        setTeams(teamList);
        setDocumentId(offer.document_id || "");

        const zoneId = String(offer.zone_id ?? "");
        const matchedTeam = teamList.find(
          (team) =>
            String(getTeamName(team)).trim().toUpperCase() ===
            String(offer.team_name || "").trim().toUpperCase()
        );
        const teamId = matchedTeam ? String(getTeamId(matchedTeam)) : "";

        let branchList = [];
        if (zoneId) {
          const branchRes = await getBranchesByZone(zoneId);
          branchList = Array.isArray(branchRes?.data) ? branchRes.data : [];
          setBranches(branchList);
        }

        let designationList = [];
        if (teamId) {
          const designationRes = await getDesignations(teamId);
          designationList = Array.isArray(designationRes?.data)
            ? designationRes.data
            : [];
          setDesignations(designationList);
        }

        setFormData({
          employee_name: offer.employee_name || "",
          email: offer.email || "",
          phone: offer.phone || "",
          zone_id: zoneId,
          branch_id: String(offer.branch_id ?? ""),
          designation: offer.designation || "",
          team_id: teamId,
          team_name: offer.team_name || "",
          doj: offer.doj ? String(offer.doj).split("T")[0] : "",
          gender: offer.gender || "",
          marital_status: offer.marital_status || "",
          grade: offer.grade || "",
          probation_period: String(offer.probation_period ?? "3"),
          grossPay: offer.gross_pay ?? "",
          insurance: offer.insurance ?? ""
        });

        setIsChanged(false);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load data");
        navigate("/hrd/offer-letter");
      } finally {
        setIsLoading(false);
      }
    };

    loadEditData();
  }, [id, navigate]);

  const handleChange = async ({ target: { name, value } }) => {
    setIsChanged(true);

    if (name === "grossPay" || name === "insurance") {
      if (value === "") {
        setFormData((prev) => ({ ...prev, [name]: "" }));
        return;
      }

      const normalizedValue = value.replace(/^0+(?=\d)/, "");
      let num = Number(normalizedValue);

      if (Number.isNaN(num)) {
        return;
      }

      if (num < 0) {
        toast.error(`${name} cannot be negative`);
        num = "";
      }

      setFormData((prev) => ({
        ...prev,
        [name]: num === "" ? "" : String(num)
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "zone_id") {
      try {
        const res = await getBranchesByZone(value);
        setBranches(Array.isArray(res?.data) ? res.data : []);
        setFormData((prev) => ({
          ...prev,
          zone_id: value,
          branch_id: ""
        }));
      } catch {
        toast.error("Failed to load branches");
        setBranches([]);
      }
      return;
    }

    if (name === "team_id") {
      try {
        const res = await getDesignations(value);
        const nextDesignations = Array.isArray(res?.data) ? res.data : [];
        const selectedTeam = teams.find(
          (team) => String(getTeamId(team)) === String(value)
        );

        setDesignations(nextDesignations);
        setFormData((prev) => ({
          ...prev,
          team_id: value,
          team_name: getTeamName(selectedTeam),
          designation: ""
        }));
      } catch {
        toast.error("Failed to load designations");
        setDesignations([]);
      }
    }
  };

  const preventInvalidKeys = (e) => {
    if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
  };

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

  const handleUpdate = async () => {
    try {
      if (!isChanged) {
        toast.info("No changes detected");
        return;
      }

      if (!formData.zone_id || !formData.branch_id) {
        toast.error("Zone & Branch are required");
        return;
      }

      const selectedBranch = branches.find(
        (branch) => String(getBranchId(branch)) === String(formData.branch_id)
      );

      await updateOfferLetter(id, {
        ...formData,
        location: getBranchName(selectedBranch)
      });

      toast.success("Updated & PDF Regenerated");
      navigate("/hrd/offer-letter");
    } catch (err) {
      console.error(err);
      toast.error("Update failed");
    }
  };

  const formatCurrency = (val) =>
    val
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0
        }).format(val)
      : "";

  if (isLoading) return <p>Loading...</p>;

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

      <h2 className={styles.title}>Edit Offer Letter</h2>
      <h3>Editing: {documentId}</h3>

      <div className={styles.grid}>
        <div className={styles.formGroup}>
          <label>Employee Name</label>
          <input
            name="employee_name"
            value={formData.employee_name}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Email</label>
          <input name="email" value={formData.email} onChange={handleChange} />
        </div>

        <div className={styles.formGroup}>
          <label>Phone</label>
          <input name="phone" value={formData.phone} onChange={handleChange} />
        </div>

        <div className={styles.formGroup}>
          <label>Zone</label>
          <select name="zone_id" value={formData.zone_id} onChange={handleChange}>
            <option value="">Select Zone</option>
            {zones.map((zone) => (
              <option key={getZoneId(zone)} value={getZoneId(zone)}>
                {getZoneName(zone)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Branch</label>
          <select
            name="branch_id"
            value={formData.branch_id}
            onChange={handleChange}
          >
            <option value="">Select Branch</option>
            {branches.map((branch) => (
              <option key={getBranchId(branch)} value={getBranchId(branch)}>
                {getBranchName(branch)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Team</label>
          <select name="team_id" value={formData.team_id} onChange={handleChange}>
            <option value="">Select Team</option>
            {teams.map((team) => (
              <option key={getTeamId(team)} value={getTeamId(team)}>
                {getTeamName(team)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Designation</label>
          <select
            name="designation"
            value={formData.designation}
            onChange={handleChange}
          >
            <option value="">Select Designation</option>
            {designations.map((designation) => (
              <option
                key={getDesignationId(designation)}
                value={getDesignationName(designation)}
              >
                {getDesignationName(designation)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>DOJ</label>
          <input
            type="date"
            name="doj"
            value={formData.doj}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Gender</label>
          <select name="gender" value={formData.gender} onChange={handleChange}>
            <option value="">Select</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHERS">Others</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Marital Status</label>
          <select
            name="marital_status"
            value={formData.marital_status}
            onChange={handleChange}
          >
            <option value="">Select</option>
            <option value="SINGLE">Single</option>
            <option value="MARRIED">Married</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Grade</label>
          <select name="grade" value={formData.grade} onChange={handleChange}>
            <option value="">Select</option>
            {["Trainee", "G08", "G07", "G06", "G05", "G04", "G03", "G02", "G01"].map(
              (grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              )
            )}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Probation Period</label>
          <div style={{ display: "flex", gap: "10px" }}>
            {["3", "6"].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setIsChanged(true);
                  setFormData((prev) => ({ ...prev, probation_period: val }));
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border:
                    String(formData.probation_period) === val
                      ? "2px solid #c2b280"
                      : "1px solid #ccc",
                  background:
                    String(formData.probation_period) === val ? "#c2b280" : "#fff",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                {val} Months
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Gross Pay</label>
          <input
            type="number"
            name="grossPay"
            value={formData.grossPay}
            onKeyDown={preventInvalidKeys}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Insurance</label>
          <input
            type="number"
            name="insurance"
            value={formData.insurance}
            onKeyDown={preventInvalidKeys}
            onChange={handleChange}
          />
        </div>

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
            <input value={formatCurrency(value)} disabled />
          </div>
        ))}

        <div className={styles.full}>
          <button className={styles.button} onClick={handleUpdate}>
            Update Offer Letter
          </button>
        </div>
      </div>
    </div>
  );
}
