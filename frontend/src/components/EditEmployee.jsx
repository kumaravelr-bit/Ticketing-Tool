import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import Menu from "./Menu";
import { toast } from "react-toastify";
import styles from "../css/EditEmployee.module.css";

export default function EditEmployee() {
  const { empId } = useParams();
  const navigate = useNavigate();

  const role = localStorage.getItem("role");
  const team = localStorage.getItem("team");

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);

  /* ===============================
     PERMISSIONS
  ================================*/
  const canEditFields = (status) => {
    if (role === "SUPER_ADMIN") return true;
    if (role === "ADMIN") return true;
    if (
      role === "USER_ACCOUNT" &&
      ["IT", "CRM"].includes(team) &&
      status === "ACTIVE"
    ) {
      return true;
    }
    return false;
  };

  const canEditStatus = () => {
    if (role === "SUPER_ADMIN") return true;
    if (role === "ADMIN") return true;
    return false;
  };

  /* ===============================
     LOAD EMPLOYEE
  ================================*/
  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const res = await api.get(`/employee/employees/${empId}`);

        // 🔐 Ensure branch_ids always array of strings
        res.data.branch_ids = (res.data.branch_ids || []).map(String);

        setEmployee(res.data);
      } catch {
        toast.error("Employee not found");
        navigate("/active");
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, [empId, navigate]);

  /* ===============================
     MASTER DATA
  ================================*/
  useEffect(() => {
    api.get("/employee/zones").then(r => setZones(r.data));
    api.get("/employee/teams").then(r => setTeams(r.data));
  }, []);


  useEffect(() => {
    if (employee?.zone_id) {
      api
        .get(`/employee/branches/by-zone/${employee.zone_id}`)
        .then(r => setBranches(r.data));
    }
  }, [employee?.zone_id]);

  useEffect(() => {
    if (employee?.team_id) {
      api
        .get(`/employee/designations/by-team/${employee.team_id}`)
        .then(r => setDesignations(r.data));
    }
  }, [employee?.team_id]);

  useEffect(() => {
    if (
      !employee?.team_id ||
      !employee?.designation_id ||
      !employee?.branch_ids?.length
    ) return;

    api
      .get("/employee/managers", {
        params: {
          team_id: employee.team_id,
          designation_id: employee.designation_id,
          branch_id: employee.branch_ids[0], // primary branch
          zone_id: employee.zone_id
        }
      })
      .then(r => setManagers(r.data))
      .catch(() => toast.error("Failed to load managers"));
  }, [
    employee?.team_id,
    employee?.designation_id,
    employee?.branch_ids,
    employee?.zone_id
  ]);

  /* ===============================
     UPDATE
  ================================*/
  const updateEmployee = async () => {
    try {
      const payload = {
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        zone_id: employee.zone_id,
        team_id: employee.team_id,
        designation_id: employee.designation_id,
        manager_id: employee.manager_id,
        status: employee.status,
        branch_ids: employee.branch_ids
      };

      await api.put(`/employee/employees/${empId}`, payload);
      toast.success("Employee updated successfully");
      setTimeout(() => {navigate("/active");}, 800);
      //navigate("/active");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!employee) return null;

  const editable = canEditFields(employee.status);

  /* ===============================
     RENDER
  ================================*/
  return (
    <>
      <Menu />

      <div className={styles.employeeEditContainer}>
        <div className={styles.backBtn}>
<div style={{ marginBottom: 15 }}>
  <button
    onClick={() => navigate("/active")}
    style={{
      background: "transparent",
      border: "none",
      color: "#1976d2",
      cursor: "pointer",
      fontWeight: 600
    }}
  >
    ← Back to Active Employees
  </button>
</div>

        </div>

        <h2>Edit Employee</h2>

        <div className={styles.formRow}>
          <label>Employee ID</label>
          <input value={employee.emp_id} disabled />
        </div>

        <div className={styles.formRow}>
          <label>Name</label>
          <input
            value={employee.name || ""}
            disabled={!editable}
            onChange={e => setEmployee({ ...employee, name: e.target.value })}
          />
        </div>

        <div className={styles.formRow}>
          <label>Email</label>
          <input
            value={employee.email || ""}
            disabled={!editable}
            onChange={e => setEmployee({ ...employee, email: e.target.value })}
          />
        </div>

        <div className={styles.formRow}>
          <label>Phone</label>
          <input
            value={employee.phone || ""}
            disabled={!editable}
            onChange={e => setEmployee({ ...employee, phone: e.target.value })}
          />
        </div>

        <div className={styles.formRow}>
          <label>Zone</label>
          <select
            value={employee.zone_id || ""}
            disabled={!editable}
            onChange={e => setEmployee({ ...employee, zone_id: e.target.value })}
          >
            <option value="">Select Zone</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>
                {z.zone_name}
              </option>
            ))}
          </select>
        </div>

        {/* ⭐ BRANCH MULTI SELECT WITH HIGHLIGHT */}
        <div className={styles.formRow}>
          <label>Branches</label>
          <select
            multiple
            className={styles.multiSelect}
            value={employee.branch_ids}
            disabled={!editable}
            onChange={e =>
              setEmployee({
                ...employee,
                branch_ids: Array.from(
                  e.target.selectedOptions,
                  o => o.value
                )
              })
            }
          >
            {branches.map(b => (
              <option key={b.id} value={String(b.id)}>
                {b.branch_name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <label>Team</label>
          <select
            value={employee.team_id || ""}
            disabled={!editable}
            onChange={e => setEmployee({ ...employee, team_id: e.target.value })}
          >
            <option value="">Select Team</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                {t.team_name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <label>Designation</label>
          <select
            value={employee.designation_id || ""}
            disabled={!editable}
            onChange={e =>
              setEmployee({ ...employee, designation_id: e.target.value })
            }
          >
            <option value="">Select Designation</option>
            {designations.map(d => (
              <option key={d.id} value={d.id}>
                {d.designation_name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <label>Reporting Manager</label>
          <select
            value={employee.manager_id || ""}
            disabled={!editable}
            onChange={e =>
              setEmployee({ ...employee, manager_id: e.target.value })
            }
          >
            <option value="">Select Manager</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* STATUS */}
        <div className={styles.formRow}>
          <label>Status</label>
          <select
            value={employee.status}
            disabled={!canEditStatus()}
            onChange={e =>
              setEmployee({ ...employee, status: e.target.value })
            }
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="DEACTIVE">DEACTIVE</option>
            <option value="RELIEVED">RELIEVED</option>
          </select>
        </div>

        {editable && (
          <button className={styles.btnPrimary} onClick={updateEmployee}>
            Update Employee
          </button>
        )}
      </div>
    </>
  );
}
