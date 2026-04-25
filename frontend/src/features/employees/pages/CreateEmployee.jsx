import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../../css/employees/CreateEmployee.module.css";
import {
  getZones,
  getTeams,
  getAllBranches,
  getDesignations,
  getManagers,
  createEmployee,
  getAreasByBranch,
} from "../../../services/employeeService";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getAuthItem } from "../../../utils/auth";

/* ═══════════════════════════════════════════════════════
   INITIAL FORM STATE
═══════════════════════════════════════════════════════ */
const initialForm = {
  joining_status:    "TRAINEE",
  name:              "",
  father_name:       "",
  gender:            "",
  email:             "",
  dob:               "",
  joining_date:      "",
  phone:             "",
  emergency_contact: "",
  marital_status:    "",
  experience_year:   "",
  experience_month:  "",
  qualification:     "",
  permanent_address: "",
  temporary_address: "",
  same_address:      false,
  zone_id:           "",
  primary_branch_id: "",
  crm_branch_ids:    [],
  ticket_branch_ids: [],
  area_ids:          [],
  branch_ids:        [],
  team_id:           "",
  designation_id:    "",
  manager_id:        "",
  role:              "USER_ACCOUNT",
  status:            "ACTIVE",
  profile_photo:     null,
};

const ensureSelectedId = (ids = [], id) => {
  const normalizedIds = (ids || []).map(String).filter(Boolean);
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return normalizedIds;
  return normalizedIds.includes(normalizedId)
    ? normalizedIds
    : [normalizedId, ...normalizedIds];
};

/* ═══════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════ */
export default function CreateEmployee() {
  const navigate = useNavigate();

  /* ── Master data ── */
  const [areas,        setAreas]        = useState([]);
  const [zones,        setZones]        = useState([]);
  const [branches,     setBranches]     = useState([]);
  const [teams,        setTeams]        = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers,     setManagers]     = useState([]);
  const [loading,      setLoading]      = useState(false);

  const [form, setForm] = useState(initialForm);

  /* ── Caller role (controls which roles can be assigned) ── */
  const myRole = (getAuthItem("role") || "").toUpperCase();

  /* ─────────────────────────────────────────────────────
     Role options the caller is allowed to assign:
       SUPER_ADMIN → all roles
       ADMIN       → USER_ACCOUNT only (cannot create ADMIN / SA)
       Others      → USER_ACCOUNT only
  ───────────────────────────────────────────────────── */
  const roleOptions =
    myRole === "SUPER_ADMIN"
      ? ["USER_ACCOUNT", "ADMIN", "SUPER_ADMIN"]
      : ["USER_ACCOUNT"];

  /* ═════════════════════════════════════════════════════
     MASTER DATA LOAD
  ═════════════════════════════════════════════════════ */
  useEffect(() => {
    loadZones();
    loadTeams();
    loadAllBranches();
  }, []);

  const loadZones = async () => {
    try { const res = await getZones(); setZones(res.data || []); }
    catch { setZones([]); }
  };

  const loadTeams = async () => {
    try { const res = await getTeams(); setTeams(res.data || []); }
    catch { setTeams([]); }
  };

  const loadAllBranches = async () => {
    try {
      const res  = await getAllBranches();
      const data = res.data || [];

      /* Normalise keys — handle both `id` and `branch_id` from API */
      const formatted = data.map(b => ({
        branch_id: b.branch_id ?? b.id,
        name:      b.name      ?? b.branch_name,
        zone_id:   Number(b.zone_id),
      }));

      setBranches(formatted);
    } catch {
      setBranches([]);
    }
  };

  /* ── Load ERP areas when primary branch changes ── */
  useEffect(() => {
    if (!form.primary_branch_id) { setAreas([]); return; }
    getAreasByBranch(form.primary_branch_id)
      .then(res => setAreas(res.data || []))
      .catch(() => setAreas([]));
  }, [form.primary_branch_id]);

  /* ── Clear CRM branch selection when zone changes ── */
  useEffect(() => {
    if (!form.zone_id) return;
    const filtered = branches.filter(b => Number(b.zone_id) === Number(form.zone_id));
    setForm(prev => ({
      ...prev,
      crm_branch_ids: prev.crm_branch_ids.filter(id =>
        filtered.some(b => Number(b.branch_id) === Number(id))
      ),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.zone_id, branches]);

  /* ── Load designations when team changes ── */
  useEffect(() => {
    if (!form.team_id) { setDesignations([]); return; }
    getDesignations(form.team_id)
      .then(res => setDesignations(res.data || []))
      .catch(() => setDesignations([]));
  }, [form.team_id]);

  /* ── Load managers when team + designation change ── */
  useEffect(() => {
    if (!form.team_id || !form.designation_id) return;
    getManagers({
      team_id:        Number(form.team_id),
      zone_id:        Number(form.zone_id) || null,
      designation_id: Number(form.designation_id),
    })
      .then(res => setManagers(res.data || []))
      .catch(() => setManagers([]));
  }, [form.team_id, form.zone_id, form.designation_id]);

  /* ═════════════════════════════════════════════════════
     HANDLE CHANGE
  ═════════════════════════════════════════════════════ */
  const handleChange = (field, value) => {

    /* Zone reset */
    if (field === "zone_id") {
      setForm(prev => ({
        ...prev,
        zone_id:          value,
        primary_branch_id: "",
        crm_branch_ids:   [],
      }));
      return;
    }

    /* Primary branch reset areas */
    if (field === "primary_branch_id") {
      setForm(prev => ({
        ...prev,
        primary_branch_id: value,
        area_ids: [],
        crm_branch_ids: ensureSelectedId(prev.crm_branch_ids, value),
      }));
      return;
    }

    /* Team reset designation + manager */
    if (field === "team_id") {
      setForm(prev => ({ ...prev, team_id: value, designation_id: "", manager_id: "" }));
      setDesignations([]);
      setManagers([]);
      return;
    }

    /* Designation reset manager */
    if (field === "designation_id") {
      setForm(prev => ({ ...prev, designation_id: value, manager_id: "" }));
      setManagers([]);
      return;
    }

    /* Same address checkbox */
    if (field === "same_address" && value === true) {
      setForm(prev => ({
        ...prev,
        same_address:      true,
        temporary_address: prev.permanent_address,
      }));
      return;
    }

    /* Sync temp address when same_address is on */
    if (field === "permanent_address" && form.same_address) {
      setForm(prev => ({
        ...prev,
        permanent_address: value,
        temporary_address: value,
      }));
      return;
    }

    setForm(prev => ({ ...prev, [field]: value }));
  };

  /* ═════════════════════════════════════════════════════
     SUBMIT
  ═════════════════════════════════════════════════════ */
  const submit = async () => {
    if (loading) return;

    /* ── Client-side validation ── */
    if (!form.name || !form.email || !form.dob) {
      toast.error("Name, Email and DOB are required");
      return;
    }

    if (!form.primary_branch_id) {
      toast.error("Please select a Primary Branch");
      return;
    }

    if (!form.team_id || !form.designation_id) {
      toast.error("Please select Team and Designation");
      return;
    }

    const data = new FormData();

    /* Append all scalar fields */
    Object.keys(form).forEach(key => {
      if (key === "profile_photo") return; // handled separately
      if (Array.isArray(form[key])) {
        data.append(key, JSON.stringify(form[key]));
      } else {
        data.append(key, form[key] ?? "");
      }
    });

    /* Experience as "year.month" */
    data.append(
      "experience",
      `${form.experience_year || 0}.${form.experience_month || 0}`
    );

    /* Profile photo */
    if (form.profile_photo) {
      data.append("profile_photo", form.profile_photo);
    }

    try {
      setLoading(true);
      const res = await createEmployee(data);

      toast.success(
        `✅ Created | ID: ${res.data.emp_id} | Password: ${res.data.password}`,
        { autoClose: 8000 }
      );

      /* Reset form */
      setForm({ ...initialForm });
      setAreas([]);
      setDesignations([]);
      setManagers([]);
      window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (err) {
      toast.error(err.response?.data?.message || "Error creating employee");
    } finally {
      setLoading(false);
    }
  };

  /* Max DOB: must be at least 18 years old */
  const maxDOB = new Date(
    new Date().setFullYear(new Date().getFullYear() - 18)
  ).toISOString().split("T")[0];

  /* Branches in selected zone */
  const branchesInZone = branches.filter(
    b => Number(b.zone_id) === Number(form.zone_id)
  );

  /* ═════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════ */
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.topNavBtn}
          onClick={() => navigate("/active")}
        >
          Active Employees
        </button>
        <h2>Create Employee</h2>
        <div className={styles.headerSpacer} />
      </div>

      {/* ── JOINING STATUS ── */}
      <div className={styles["form-group"]}>
        <label>Joining Status</label>
        <select
          value={form.joining_status}
          onChange={e => handleChange("joining_status", e.target.value)}
        >
          <option value="TRAINEE">TRAINEE</option>
          <option value="PERMANENT">PERMANENT</option>
        </select>
      </div>

      {/* ── JOINING DATE ── */}
      <div className={styles["form-group"]}>
        <label>Joining Date</label>
        <input
          type="date"
          value={form.joining_date}
          onChange={e => handleChange("joining_date", e.target.value)}
        />
      </div>

      {/* ── NAME ── */}
      <div className={styles["form-group"]}>
        <label>Name *</label>
        <input
          value={form.name}
          onChange={e => handleChange("name", e.target.value)}
        />
      </div>

      {/* ── FATHER NAME ── */}
      <div className={styles["form-group"]}>
        <label>Father Name</label>
        <input
          value={form.father_name}
          onChange={e => handleChange("father_name", e.target.value)}
        />
      </div>

      {/* ── GENDER ── */}
      <div className={styles["form-group"]}>
        <label>Gender</label>
        <select
          value={form.gender}
          onChange={e => handleChange("gender", e.target.value)}
        >
          <option value="">Select</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
          <option value="OTHERS">OTHERS</option>
        </select>
      </div>

      {/* ── EMAIL ── */}
      <div className={styles["form-group"]}>
        <label>Email *</label>
        <input
          type="email"
          value={form.email}
          onChange={e => handleChange("email", e.target.value)}
        />
      </div>

      {/* ── DOB ── */}
      <div className={styles["form-group"]}>
        <label>Date of Birth *</label>
        <input
          type="date"
          max={maxDOB}
          value={form.dob}
          onChange={e => handleChange("dob", e.target.value)}
        />
      </div>

      {/* ── PHONE ── */}
      <div className={styles["form-group"]}>
        <label>Phone</label>
        <input
          value={form.phone}
          onChange={e => handleChange("phone", e.target.value)}
        />
      </div>

      {/* ── EMERGENCY CONTACT ── */}
      <div className={styles["form-group"]}>
        <label>Emergency Contact</label>
        <input
          value={form.emergency_contact}
          onChange={e => handleChange("emergency_contact", e.target.value)}
        />
      </div>

      {/* ── MARITAL STATUS ── */}
      <div className={styles["form-group"]}>
        <label>Marital Status</label>
        <select
          value={form.marital_status}
          onChange={e => handleChange("marital_status", e.target.value)}
        >
          <option value="">Select</option>
          <option value="SINGLE">SINGLE</option>
          <option value="MARRIED">MARRIED</option>
        </select>
      </div>

      {/* ── EXPERIENCE ── */}
      <div className={styles["form-group"]}>
        <label>Experience</label>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="number"
            placeholder="Years"
            min="0"
            value={form.experience_year}
            onChange={e => handleChange("experience_year", e.target.value)}
          />
          <input
            type="number"
            placeholder="Months (0–11)"
            min="0"
            max="11"
            value={form.experience_month}
            onChange={e => handleChange("experience_month", e.target.value)}
          />
        </div>
      </div>

      {/* ── QUALIFICATION ── */}
      <div className={styles["form-group"]}>
        <label>Qualification</label>
        <select
          value={form.qualification}
          onChange={e => handleChange("qualification", e.target.value)}
        >
          <option value="">Select</option>
          <option>SSLC</option>
          <option>HSC</option>
          <option>DIPLOMA</option>
          <option>UG</option>
          <option>PG</option>
        </select>
      </div>

      {/* ── PERMANENT ADDRESS ── */}
      <div className={styles["form-group"]}>
        <label>Permanent Address</label>
        <textarea
          value={form.permanent_address}
          onChange={e => handleChange("permanent_address", e.target.value)}
        />
      </div>

      {/* ── SAME AS PERMANENT ── */}
      <div className={styles["form-group"]}>
        <label>
          <input
            type="checkbox"
            checked={form.same_address}
            onChange={e => handleChange("same_address", e.target.checked)}
          />
          {" "}Same as Permanent Address
        </label>
      </div>

      {/* ── TEMPORARY ADDRESS ── */}
      <div className={styles["form-group"]}>
        <label>Temporary Address</label>
        <textarea
          value={form.temporary_address}
          onChange={e => handleChange("temporary_address", e.target.value)}
          disabled={form.same_address}
        />
      </div>

      {/* ── ZONE ── */}
      <div className={styles["form-group"]}>
        <label>Zone</label>
        <select
          value={form.zone_id}
          onChange={e => handleChange("zone_id", Number(e.target.value))}
        >
          <option value="">Select Zone</option>
          {zones.map(z => (
            <option key={z.zone_id ?? z.id} value={z.zone_id ?? z.id}>
              {z.name ?? z.zone_name}
            </option>
          ))}
        </select>
      </div>

      {/* ── PRIMARY BRANCH ── */}
      <div className={styles["form-group"]}>
        <label>Primary Branch *</label>
        <select
          value={form.primary_branch_id}
          onChange={e => handleChange("primary_branch_id", e.target.value)}
        >
          <option value="">Select Branch</option>
          {branchesInZone.map(b => (
            <option key={b.branch_id} value={b.branch_id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── CRM BRANCH ACCESS (multi) ── */}
      <div className={styles["form-group"]}>
        <label>CRM Branch Access</label>
        <select
          multiple
          value={form.crm_branch_ids}
          onChange={e =>
            handleChange(
              "crm_branch_ids",
              Array.from(e.target.selectedOptions, o => o.value)
            )
          }
        >
          {form.zone_id === "" ? (
            <option disabled>Select Zone first</option>
          ) : branchesInZone.length === 0 ? (
            <option disabled>No branches in this zone</option>
          ) : (
            branchesInZone.map(b => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* ── TICKET / LEAD BRANCH ACCESS (multi) ── */}
      <div className={styles["form-group"]}>
        <label>Ticket / Lead Branch Access</label>
        <select
          multiple
          value={form.ticket_branch_ids}
          onChange={e =>
            handleChange(
              "ticket_branch_ids",
              Array.from(e.target.selectedOptions, o => o.value)
            )
          }
        >
          {branches.map(b => (
            <option key={b.branch_id} value={b.branch_id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── ERP AREA ACCESS (multi) ── */}
      <div className={styles["form-group"]}>
        <label>ERP Area Access</label>
        <select
          multiple
          value={form.area_ids}
          onChange={e =>
            handleChange(
              "area_ids",
              Array.from(e.target.selectedOptions, o => o.value)
            )
          }
        >
          {!form.primary_branch_id ? (
            <option disabled>Select Primary Branch first</option>
          ) : areas.length === 0 ? (
            <option disabled>No areas available</option>
          ) : (
            areas.map(a => (
              <option key={a.id} value={a.id}>
                {a.area_name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* ── BRANCHES (legacy multi — kept for backward compat) ── */}
      <div className={styles["form-group"]}>
        <label>Additional Branches</label>
        <select
          multiple
          value={form.branch_ids}
          onChange={e =>
            handleChange(
              "branch_ids",
              Array.from(e.target.selectedOptions, o => o.value)
            )
          }
        >
          {branches.map(b => (
            <option key={b.branch_id} value={String(b.branch_id)}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── TEAM ── */}
      <div className={styles["form-group"]}>
        <label>Team</label>
        <select
          value={form.team_id}
          onChange={e => handleChange("team_id", e.target.value)}
        >
          <option value="">Select Team</option>
          {teams.map(t => (
            <option key={t.team_id ?? t.id} value={t.team_id ?? t.id}>
              {t.name ?? t.team_name}
            </option>
          ))}
        </select>
      </div>

      {/* ── DESIGNATION ── */}
      <div className={styles["form-group"]}>
        <label>Designation</label>
        <select
          value={form.designation_id}
          onChange={e => handleChange("designation_id", e.target.value)}
          disabled={!form.team_id}
        >
          <option value="">Select Designation</option>
          {designations.map(d => (
            <option key={d.designation_id ?? d.id} value={d.designation_id ?? d.id}>
              {d.name ?? d.designation_name}
            </option>
          ))}
        </select>
      </div>

      {/* ── MANAGER ── */}
      <div className={styles["form-group"]}>
        <label>Reporting Manager</label>
        <select
          value={form.manager_id}
          onChange={e => handleChange("manager_id", e.target.value)}
          disabled={!form.designation_id}
        >
          <option value="">None</option>
          {managers.map(m => (
            <option key={m.id ?? m.emp_id} value={m.id ?? m.emp_id}>
              {m.name} — {m.designation_name} {m.zone_name ? `(${m.zone_name})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── ROLE ── */}
      <div className={styles["form-group"]}>
        <label>System Role</label>
        <select
          value={form.role}
          onChange={e => handleChange("role", e.target.value)}
        >
          {roleOptions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* ── PROFILE PHOTO ── */}
      <div className={styles["form-group"]}>
        <label>Profile Photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={e => handleChange("profile_photo", e.target.files[0])}
        />
      </div>

      {/* ── SUBMIT ── */}
      <button
        className={styles.button}
        onClick={submit}
        disabled={loading}
      >
        {loading ? "Creating..." : "Save Employee"}
      </button>
    </div>
  );
}
