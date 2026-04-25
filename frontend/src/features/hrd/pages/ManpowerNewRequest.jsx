import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../../css/hrd/NewRequest.module.css";
import { toast } from "react-toastify";
import { createManpowerRequest } from "../../../services/manpowerService";
import {
  getZones,
  getTeams,
  getBranchesByZone,
  getDesignations,
  getManagers
} from "../../../services/employeeService";

export default function NewRequest() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);

  const [form, setForm] = useState({
    zone_id: "",
    branch_id: "",
    request_type: "New Openings",
    team_id: "",
    designation_id: "",
    reporting_manager: "",
    openings: 1,
    experience_required: "",
    salary_range: "",
    key_skills: "",
    preferred_education: "",
    additional_skills: "",
    replaced_emp_id: "",
    replaced_emp_name: "",
    reason_for_requirement: "",
    priority_level: "Urgent",
    required_joining_date: ""
  });

  /* ---------------- INITIAL LOAD ---------------- */
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
      setZones([]);
    }
  };

  const loadTeams = async () => {
    try {
      const res = await getTeams();
      setTeams(res.data || []);
    } catch {
      toast.error("Failed to load teams");
      setTeams([]);
    }
  };

  /* ---------------- LOAD BRANCHES ---------------- */
  useEffect(() => {
    if (!form.zone_id) {
      setBranches([]);
      setForm(prev => ({ ...prev, branch_id: "" }));
      return;
    }

    const loadBranches = async () => {
      try {
        const res = await getBranchesByZone(Number(form.zone_id));

        const formatted = (res.data || []).map(b => ({
          branch_id: b.branch_id,
          name: b.name
        }));

        setBranches(formatted);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load branches");
        setBranches([]);
      }
    };

    loadBranches();
  }, [form.zone_id]);

  /* ---------------- DESIGNATIONS ---------------- */
  useEffect(() => {
    if (!form.team_id) {
      setDesignations([]);
      return;
    }

    getDesignations(form.team_id)
      .then(res => setDesignations(res.data || []))
      .catch(() => {
        toast.error("Failed to load designations");
        setDesignations([]);
      });
  }, [form.team_id]);

  /* ---------------- MANAGERS ---------------- */
  useEffect(() => {
    if (form.team_id && form.designation_id) {
      getManagers({
        team_id: Number(form.team_id),
        zone_id: Number(form.zone_id) || null,
        designation_id: Number(form.designation_id)
      })
        .then(res => setManagers(res.data || []))
        .catch(() => {
          toast.error("Failed to load managers");
          setManagers([]);
        });
    }
  }, [form.team_id, form.zone_id, form.designation_id]);

  /* ---------------- INPUT CHANGE ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  /* ---------------- VALIDATION ---------------- */
  const validateForm = () => {
    if (!form.zone_id) return "Zone required";
    if (!form.branch_id) return "Branch required";
    if (!form.team_id) return "Department required";
    if (!form.designation_id) return "Designation required";

    if (
      form.request_type === "Replacement" &&
      (!form.replaced_emp_id || !form.replaced_emp_name)
    ) {
      return "Fill replacement details";
    }

    return "";
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errMsg = validateForm();
    if (errMsg) {
      return toast.error(errMsg);
    }

    const toastId = toast.loading("Submitting request...");

    try {
      setLoading(true);

      await createManpowerRequest({
        ...form,
        zone_id: Number(form.zone_id),
        branch_id: Number(form.branch_id),
        team_id: Number(form.team_id),
        designation_id: Number(form.designation_id),
        openings: Number(form.openings),
        salary_range: Number(form.salary_range || 0)
      });

      toast.update(toastId, {
        render: "Request created successfully",
        type: "success",
        isLoading: false,
        autoClose: 2000
      });

      setTimeout(() => navigate("/hrd/manpower"), 1000);

    } catch (err) {
      console.error("SUBMIT ERROR:", err);

      const errorMsg =
        err.response?.data?.message || "Failed to submit request";

      toast.update(toastId, {
        render: errorMsg,
        type: "error",
        isLoading: false,
        autoClose: 3000
      });

    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className={styles.card}>

      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate("/hrd/manpower")}
        >
          ← Back
        </button>

        <h2>New Manpower Request</h2>
      </div>

      <form className={styles.formGrid} onSubmit={handleSubmit}>

        {/* ZONE */}
        <select name="zone_id" value={form.zone_id} onChange={handleChange}>
          <option value="">Select Zone</option>
          {zones.map(z => (
            <option key={z.zone_id} value={z.zone_id}>
              {z.name}
            </option>
          ))}
        </select>

        {/* BRANCH */}
        <select name="branch_id" value={form.branch_id} onChange={handleChange}>
          <option value="">Select Branch</option>
          {branches.map(b => (
            <option key={b.branch_id} value={b.branch_id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* REQUEST TYPE */}
        <select name="request_type" value={form.request_type} onChange={handleChange}>
          <option>New Openings</option>
          <option>Replacement</option>
        </select>

        {/* TEAM */}
        <select name="team_id" value={form.team_id} onChange={handleChange}>
          <option value="">Select Department</option>
          {teams.map(t => (
            <option key={t.team_id} value={t.team_id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* DESIGNATION */}
        <select name="designation_id" value={form.designation_id} onChange={handleChange}>
          <option value="">Select Designation</option>
          {designations.map(d => (
            <option key={d.designation_id} value={d.designation_id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* MANAGER */}
        <select name="reporting_manager" value={form.reporting_manager} onChange={handleChange}>
          <option value="">Select Manager</option>
          {managers.map(m => (
            <option key={m.emp_id} value={m.emp_id}>{m.name}</option>
          ))}
        </select>

        <input type="number" name="openings" value={form.openings} onChange={handleChange} />
        <input name="experience_required" value={form.experience_required} onChange={handleChange} placeholder="Experience" />
        <input type="number" name="salary_range" value={form.salary_range} onChange={handleChange} placeholder="Salary" />

        <select name="priority_level" value={form.priority_level} onChange={handleChange}>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
          <option>Urgent</option>
        </select>

        <div className={styles.field}>
          <label htmlFor="required_joining_date">Required Joining Date</label>
          <input
            id="required_joining_date"
            className={styles.dateInput}
            type="date"
            name="required_joining_date"
            value={form.required_joining_date}
            onChange={handleChange}
          />
        </div>

        <textarea className={styles.full} name="key_skills" placeholder="Key Skills" onChange={handleChange} />

        {form.request_type === "Replacement" && (
          <>
            <input name="replaced_emp_id" placeholder="Old Emp ID" onChange={handleChange} />
            <input name="replaced_emp_name" placeholder="Old Name" onChange={handleChange} />
          </>
        )}

        <textarea className={styles.full} name="reason_for_requirement" placeholder="Reason" onChange={handleChange} />

        <div className={styles.full}>
          <button className={styles.primaryBtn} disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>

      </form>
    </div>
  );
}
