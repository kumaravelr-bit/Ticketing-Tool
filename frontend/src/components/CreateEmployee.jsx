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
    branch_ids: [],
    team_id: "",
    designation_id: "",
    manager_id: "",
    role: "USER_ACCOUNT",
    status: "ACTIVE",
    profile_photo: null
  });

  const myRole = localStorage.getItem("role");

  const roles =
    myRole === "SUPER_ADMIN"
      ? ["USER_ACCOUNT", "ADMIN", "SUPER_ADMIN"]
      : ["USER_ACCOUNT"];

  /* ---------------- LOAD MASTER DATA ---------------- */

  useEffect(() => {
    loadZones();
    loadTeams();
  }, []);

  const loadZones = async () => {
    try {
      const res = await api.get("/others/zones");
      setZones(res.data || []);
    } catch {
      setZones([]);
    }
  };

  const loadTeams = async () => {
    try {
      const res = await api.get("/others/teams");
      setTeams(res.data || []);
    } catch {
      setTeams([]);
    }
  };

  /* ---------------- LOAD BRANCH BY ZONE ---------------- */

  useEffect(() => {

    if (!form.zone_id) {
      setBranches([]);
      setForm(prev => ({ ...prev, branch_ids: [] }));
      return;
    }

    api
      .get(`/others/branches/by-zone/${form.zone_id}`)
      .then(res => setBranches(res.data || []))
      .catch(() => setBranches([]));

  }, [form.zone_id]);

  /* ---------------- LOAD DESIGNATION BY TEAM ---------------- */

  useEffect(() => {

    if (!form.team_id) {
      setDesignations([]);
      setForm(prev => ({ ...prev, designation_id: "" }));
      return;
    }

    api
      .get(`/others/designations/by-team/${form.team_id}`)
      .then(res => setDesignations(res.data || []))
      .catch(() => setDesignations([]));

  }, [form.team_id]);

  /* ---------------- LOAD MANAGERS ---------------- */

useEffect(() => {
  if (
    form.zone_id &&
    form.branch_ids.length > 0 &&
    form.team_id &&
    form.designation_id
  ) {
    api
      .get("/employee/managers", {
        params: {
          zone_id: form.zone_id,
          branch_id: form.branch_ids[0], // first selected branch
          team_id: form.team_id,
          designation_id: form.designation_id
        }
      })
      .then(res => setManagers(res.data || []))
      .catch(() => setManagers([]));
  } else {
    setManagers([]); // reset if fields missing
  }
}, [form.zone_id, form.branch_ids, form.team_id, form.designation_id]);

  /* ---------------- HANDLE INPUT ---------------- */

  const handleChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /* ---------------- SUBMIT ---------------- */

  const submit = async () => {

    if (!form.emp_id || !form.name || !form.email || !form.password) {
      toast.error("Please fill all required fields");
      return;
    }

    if (form.branch_ids.length === 0) {
      toast.error("Please select at least one branch");
      return;
    }

    const data = new FormData();

    Object.keys(form).forEach(key => {

      if (key === "branch_ids") {
        data.append("branch_ids", JSON.stringify(form.branch_ids));
      }
      else if (form[key] !== "" && form[key] !== null) {
        data.append(key, form[key]);
      }

    });

    try {

      await api.post("/employee/employees", data);

      toast.success("Employee Created Successfully");

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {

      toast.error(
        err.response?.data?.message || "Error creating employee"
      );

    }

  };

  return (
    <>
      <Menu />

      <div className={styles.container}>
        <h2>Create Employee</h2>

        {/* EMP ID */}
        <div className={styles["form-group"]}>
          <label>Employee ID *</label>
          <input
            type="text"
            value={form.emp_id}
            onChange={e => handleChange("emp_id", e.target.value)}
          />
        </div>

        {/* NAME */}
        <div className={styles["form-group"]}>
          <label>Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => handleChange("name", e.target.value)}
          />
        </div>

        {/* EMAIL */}
        <div className={styles["form-group"]}>
          <label>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => handleChange("email", e.target.value)}
          />
        </div>

        {/* PASSWORD */}
        <div className={styles["form-group"]}>
          <label>Password *</label>
          <input
            type="password"
            value={form.password}
            onChange={e => handleChange("password", e.target.value)}
          />
        </div>

        {/* DOB */}
        <div className={styles["form-group"]}>
          <label>DOB</label>
          <input
            type="date"
            value={form.dob}
            onChange={e => handleChange("dob", e.target.value)}
          />
        </div>

        {/* PHONE */}
        <div className={styles["form-group"]}>
          <label>Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={e => handleChange("phone", e.target.value)}
          />
        </div>

        {/* ZONE */}
        <div className={styles["form-group"]}>
          <label>Zone</label>
          <select
            value={form.zone_id}
            onChange={e => handleChange("zone_id", e.target.value)}
          >
            <option value="">Select Zone</option>

            {zones.map(z => (
              <option key={z.zone_id} value={z.zone_id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        {/* BRANCH MULTI SELECT */}
        <div className={styles["form-group"]}>
          <label>Branches *</label>

          <select
            multiple
            value={form.branch_ids}
            onChange={e => {
              const values = Array.from(
                e.target.selectedOptions,
                option => option.value
              );
              handleChange("branch_ids", values);
            }}
          >
            {branches.length === 0 && (
              <option disabled>Select Zone First</option>
            )}

            {branches.map(b => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* TEAM */}
        <div className={styles["form-group"]}>
          <label>Team</label>

          <select
            value={form.team_id}
            onChange={e => handleChange("team_id", e.target.value)}
          >
            <option value="">Select Team</option>

            {teams.map(t => (
              <option key={t.team_id} value={t.team_id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* DESIGNATION */}
        <div className={styles["form-group"]}>
          <label>Designation</label>

          <select
            value={form.designation_id}
            onChange={e =>
              handleChange("designation_id", e.target.value)
            }
          >
            <option value="">Select Designation</option>

            {designations.map(d => (
              <option
                key={d.designation_id}
                value={d.designation_id}
              >
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* MANAGER */}
        <div className={styles["form-group"]}>
          <label>Manager</label>

          <select
            value={form.manager_id}
            onChange={e =>
              handleChange("manager_id", e.target.value)
            }
          >
            <option value="">None</option>

            {managers.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* ROLE */}
        <div className={styles["form-group"]}>
          <label>Role</label>

          <select
            value={form.role}
            onChange={e => handleChange("role", e.target.value)}
          >
            {roles.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* PROFILE PHOTO */}
        <div className={styles["form-group"]}>
          <label>Profile Photo</label>

          <input
            type="file"
            onChange={e =>
              handleChange("profile_photo", e.target.files[0])
            }
          />
        </div>

        <button className={styles.button} onClick={submit}>
          Save Employee
        </button>
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}