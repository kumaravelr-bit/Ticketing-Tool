import { useEffect, useState } from "react";
import Menu from "../components/Menu";
import api from "../services/api";
import styles from "../css/CreateEmployee.module.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function CreateEmployee() {
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);

const [form, setForm] = useState({
  emp_id: "",
  name: "",
  email: "",
  password: "",
  dob: "",
  phone: "",
  zone_id: "",
  branch_ids: [],        // 👈 MULTIPLE
  team_id: "",
  designation_id: "",
  manager_id: "",
  role: "USER_ACCOUNT",
  status: "ACTIVE",
  profile_photo: null
});

  const myRole = localStorage.getItem("role");
  const roles = myRole === "SUPER_ADMIN"
    ? ["USER_ACCOUNT","ADMIN","SUPER_ADMIN"]
    : ["USER_ACCOUNT"];

  // Load zones and teams
  useEffect(() => {
    api.get("/employee/zones").then(res => setZones(res.data));
    api.get("/employee/teams").then(res => setTeams(res.data));
  }, []);

  // Load branches by zone
  useEffect(() => {
    if (form.zone_id) {
      api.get(`/employee/branches/by-zone/${form.zone_id}`)
        .then(res => setBranches(res.data))
        .catch(() => setBranches([]));
    } else setBranches([]);
  }, [form.zone_id]);

  // Load designations by team
  useEffect(() => {
    if (form.team_id) {
      api.get(`/employee/designations/by-team/${form.team_id}`)
        .then(res => setDesignations(res.data))
        .catch(() => setDesignations([]));
    } else setDesignations([]);
  }, [form.team_id]);

  // Load managers by designation & branch
useEffect(() => {
  if (
    form.team_id &&
    form.designation_id &&
    form.branch_ids.length > 0
  ) {
    api.get("/employee/managers", {
      params: {
        team_id: form.team_id,
        designation_id: form.designation_id,
        branch_id: form.branch_ids[0]   // 👈 PRIMARY
      }
    })
    .then(res => setManagers(res.data))
    .catch(() => setManagers([]));
  } else {
    setManagers([]);
  }
}, [form.team_id, form.designation_id, form.branch_ids]);

const submit = async () => {
  if (!form.emp_id || !form.name || !form.email || !form.password) {
    toast.error("Please fill all required fields");
    return;
  }

  if (!Array.isArray(form.branch_ids) || form.branch_ids.length === 0) {
    toast.error("Please select at least one branch");
    return;
  }

  const data = new FormData();

  Object.keys(form).forEach(k => {
    if (k === "branch_ids") {
      // ✅ SEND FULL ARRAY (IMPORTANT)
      data.append("branch_ids", JSON.stringify(form.branch_ids));
    } else if (form[k] !== null && form[k] !== "") {
      data.append(k, form[k]);
    }
  });

  try {
    await api.post("/employee/employees", data);
    toast.success("Employee Created Successfully");
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    toast.error(err.response?.data?.message || "Error creating employee");
  }
};

  return (
    <>
      <Menu />
      <div className={styles.container}>
        <h2>Create Employee</h2>

        <div className={styles["form-group"]}>
          <label>Employee ID *</label>
          <input
            type="text"
            value={form.emp_id}
            onChange={e => setForm({ ...form, emp_id: e.target.value })}
          />
        </div>

        <div className={styles["form-group"]}>
          <label>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className={styles["form-group"]}>
          <label>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className={styles["form-group"]}>
          <label>Password *</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <div className={styles["form-group"]}>
          <label>DOB</label>
          <input
            type="date"
            value={form.dob}
            onChange={e => setForm({ ...form, dob: e.target.value })}
          />
        </div>

        <div className={styles["form-group"]}>
          <label>Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        <div className={styles["form-group"]}>
          <label>Zone</label>
          <select
            value={form.zone_id}
            onChange={e => setForm({ ...form, zone_id: e.target.value })}
          >
            <option value="">Select Zone</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.zone_name}</option>
            ))}
          </select>
        </div>

<div className={styles["form-group"]}>
  <label>Branches *</label>
  <select
    multiple
    value={form.branch_ids}
    onChange={e => {
      const values = Array.from(e.target.selectedOptions, o => o.value);
      setForm({ ...form, branch_ids: values });
    }}
  >
    {branches.length === 0 && (
      <option disabled>First select a zone</option>
    )}
    {branches.map(b => (
      <option key={b.id} value={b.id}>
        {b.branch_name}
      </option>
    ))}
  </select>
</div>

        <div className={styles["form-group"]}>
          <label>Team</label>
          <select
            value={form.team_id}
            onChange={e => setForm({ ...form, team_id: e.target.value })}
          >
            <option value="">Select Team</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.team_name}</option>
            ))}
          </select>
        </div>

        <div className={styles["form-group"]}>
          <label>Designation</label>
          <select
            value={form.designation_id}
            onChange={e => setForm({ ...form, designation_id: e.target.value })}
          >
            <option value="">Select Designation</option>
            {designations.map(d => (
              <option key={d.id} value={d.id}>{d.designation_name}</option>
            ))}
          </select>
        </div>

        <div className={styles["form-group"]}>
          <label>Manager</label>
          <select
            value={form.manager_id}
            onChange={e => setForm({ ...form, manager_id: e.target.value })}
          >
            <option value="">None</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className={styles["form-group"]}>
          <label>Role</label>
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
          >
            {roles.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className={styles["form-group"]}>
          <label>Profile Photo</label>
          <input
            type="file"
            onChange={e => setForm({ ...form, profile_photo: e.target.files[0] })}
          />
        </div>

        <button className={styles.button} onClick={submit}>
          Save Employee
        </button>
      </div>

      {/* Toast Container */}
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}
