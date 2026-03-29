import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "../css/EditEmployee.module.css";

import {
  getEmployeeById,
  getZones,
  getTeams,
  getAllBranches,
  getAreasByBranch,
  getDesignations,
  getManagers,
  updateEmployee as updateEmployeeAPI
} from "../services/employeeService";

export default function EditEmployee() {

  const { empId } = useParams();
  const navigate = useNavigate();

const [showPassword, setShowPassword] = useState(false);
const [passwordError, setPasswordError] = useState("");
  const role = localStorage.getItem("role");
  const team = localStorage.getItem("team");
  const [areas, setAreas] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);

  /* ================= PERMISSIONS ================= */

  const canEditFields = (status) => {
    if (role === "SUPER_ADMIN") return true;
    if (role === "ADMIN") return true;
    if (
      role === "USER_ACCOUNT" &&
      ["IT", "CRM"].includes(team) &&
      status === "ACTIVE"
    ) return true;

    return false;
  };

  const canEditEmpId = () => {
    return role === "SUPER_ADMIN" || role === "ADMIN";
  };

  const canEditStatus = () => {
    return role === "SUPER_ADMIN" || role === "ADMIN";
  };

  const validatePassword = (password) => {
  if (!password) {
    setPasswordError(""); // allow empty (means no change)
    return true;
  }

  const strongRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

  if (!strongRegex.test(password)) {
    setPasswordError(
      "Min 8 chars, include Upper, Lower, Number & Special char"
    );
    return false;
  }

  setPasswordError("");
  return true;
};

  /* ================= LOAD EMPLOYEE ================= */
  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const res = await getEmployeeById(empId);
        const emp = res.data;

        console.log("RAW EMPLOYEE:", emp);

        /* FORMAT DATE */
        emp.joining_date = emp.joining_date
          ? emp.joining_date.split("T")[0]
          : "";

        /* EXPERIENCE */
        if (emp.experience) {
          let exp = String(emp.experience);

          if (exp.includes(".")) {
            const parts = exp.split(".");
            emp.exp_year = parts[0] || "";
            emp.exp_month = parts[1] || "";
          } else {
            emp.exp_year = exp;
            emp.exp_month = "";
          }
        } else {
          emp.exp_year = "";
          emp.exp_month = "";
        }

        /* NORMALIZE */
        emp.area_ids = (emp.area_ids || []).map(String);
        emp.crm_branch_ids = (emp.crm_branch_ids || []).map(String);
        emp.ticket_branch_ids = (emp.ticket_branch_ids || []).map(String);

        emp.primary_branch_id = emp.primary_branch_id
          ? String(emp.primary_branch_id)
          : "";
        emp.password = ""; // 🔥 FORCE EMPTY
        emp.zone_id = emp.zone_id ? String(emp.zone_id) : "";
        emp.team_id = emp.team_id ? String(emp.team_id) : "";
        emp.designation_id = emp.designation_id
          ? String(emp.designation_id)
          : "";
        emp.manager_id = emp.manager_id ? String(emp.manager_id) : "";

        emp.branch_ids = emp.branch_ids
          ? emp.branch_ids.map(String)
          : emp.branch_id
            ? [String(emp.branch_id)]
            : [];

        console.log("NORMALIZED EMPLOYEE:", emp);

        setEmployee(emp);
      } catch (err) {
        console.error("EMP LOAD ERROR:", err);
        toast.error("Employee not found");
        navigate("/active");
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [empId, navigate]);


  useEffect(() => {
    if (!employee?.primary_branch_id) {
      setAreas([]);
      return;
    }

    getAreasByBranch(employee.primary_branch_id)
      .then(res => {
        console.log("AREAS:", res.data);
        setAreas(res.data || []);
      })
      .catch(err => {
        console.error("AREA ERROR:", err);
        setAreas([]);
      });
  }, [employee?.primary_branch_id]);

  useEffect(() => {
    if (!areas.length || !employee) return;

    console.log("Rebinding AREA selection");
    console.log("Employee Area IDs:", employee.area_ids);
    console.log("Available Areas:", areas);

    setEmployee(prev => ({
      ...prev,
      area_ids: (prev.area_ids || []).map(String)
    }));

  }, [areas]);

  /* ================= LOAD MASTER ================= */

  useEffect(() => {
    const loadMaster = async () => {
      try {
        const [z, t] = await Promise.all([
          getZones(),
          getTeams()
        ]);

        setZones(z.data || []);
        setTeams(t.data || []);
      } catch (err) {
        console.error("MASTER LOAD ERROR:", err);
        toast.error("Failed to load master data");
      }
    };

    loadMaster();
  }, []);

  useEffect(() => {
    getAllBranches()
      .then(res => {
        const formatted = (res.data || []).map(b => ({
          branch_id: b.branch_id || b.id,
          name: b.name || b.branch_name,
          zone_id: String(b.zone_id)
        }));

        console.log("BRANCHES:", formatted);

        setBranches(formatted);
      })
      .catch(err => {
        console.error("BRANCH ERROR:", err);
        setBranches([]);
      });
  }, []);

  /* ================= DESIGNATION ================= */

  useEffect(() => {
    if (!employee?.team_id) {
      setDesignations([]);
      return;
    }

    getDesignations(employee.team_id)
      .then(res => {
        console.log("Designations:", res.data);
        setDesignations(res.data || []);
      })
      .catch(err => {
        console.error("DESIGNATION ERROR:", err);
        setDesignations([]);
      });
  }, [employee?.team_id]);

  /* ================= MANAGER ================= */

  useEffect(() => {
    if (!employee) return;

    const loadManagers = async () => {
      try {
        const res = await getManagers({
          team_id: employee.team_id || null,
          zone_id: employee.zone_id || null,
          designation_id: employee.designation_id || null
        });

        let list = res.data || [];

        if (
          employee.manager_id &&
          !list.some(m => Number(m.id) === Number(employee.manager_id))
        ) {
          list.unshift({
            id: Number(employee.manager_id),
            name:
              employee.manager_name ||
              `Manager ID (${employee.manager_id})`
          });
        }

        console.log("MANAGERS:", list);

        setManagers(list);
      } catch (err) {
        console.error("MANAGER ERROR:", err);
        setManagers([]);
      }
    };

    loadManagers();
  }, [
    employee?.team_id,
    employee?.zone_id,
    employee?.designation_id,
    employee?.manager_id
  ]);

  /* ================= UPDATE ================= */

  const updateEmployee = async () => {
    try {
      const payload = {
        ...employee,

        experience: `${employee.exp_year || 0}.${employee.exp_month || 0}`,

        primary_branch_id: Number(employee.primary_branch_id),

        crm_branch_ids: employee.crm_branch_ids.map(Number),
        ticket_branch_ids: employee.ticket_branch_ids.map(Number),
        area_ids: employee.area_ids.map(Number),
        branch_ids: employee.branch_ids.map(Number),

        team_id: Number(employee.team_id),
        designation_id: Number(employee.designation_id),
        zone_id: Number(employee.zone_id),
        manager_id: employee.manager_id
          ? Number(employee.manager_id)
          : null
      };

      console.log("UPDATE PAYLOAD:", payload);

      await updateEmployeeAPI(empId, payload);

      toast.success("Employee updated successfully");
      setTimeout(() => navigate("/active"), 800);
    } catch (err) {
      console.error("UPDATE ERROR:", err);
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!employee) return null;

  const editable = canEditFields(employee.status);

  /* ================= UI ================= */

  return (


    <div className={styles.employeeEditContainer}>

      <button
        className={styles.btnBack}
        onClick={() => navigate("/active")}
      >
        ← Back
      </button>

      <h2>Edit Employee</h2>

      <div className={styles.formRow}>
        <label>Employee ID</label>
        <input
          value={employee.emp_id}
          disabled={!canEditEmpId()}   // ✅ CONTROL HERE
          onChange={(e) =>
            setEmployee({ ...employee, emp_id: e.target.value })
          }
        />
      </div>

      <div className={styles.formRow}>
        <label>Name</label>
        <input
          value={employee.name || ""}
          disabled={!editable}
          onChange={e =>
            setEmployee({ ...employee, name: e.target.value })
          }
        />
      </div>

      <div className={styles.formRow}>
        <label>Father Name</label>
        <input
          value={employee.father_name || ""}
          onChange={e =>
            setEmployee({ ...employee, father_name: e.target.value })
          }
        />
      </div>

      <div className={styles.formRow}>
        <label>Joining Date</label>
        <input
          type="date"
          value={employee.joining_date || ""}
          onChange={e =>
            setEmployee({ ...employee, joining_date: e.target.value })
          }
        />
      </div>

      <div className={styles.formRow}>
        <label>Joining Status</label>
        <select
          value={employee.joining_status || ""}
          onChange={e =>
            setEmployee({
              ...employee,
              joining_status: e.target.value
            })
          }
        >
          <option value="">Select</option>
          <option value="TRAINEE">TRAINEE</option>
          <option value="PERMANENT">PERMANENT</option>
        </select>
      </div>

      <div className={styles.formRow}>
        <label>Gender</label>
        <select
          value={employee.gender || ""}
          onChange={e =>
            setEmployee({ ...employee, gender: e.target.value })
          }
        >
          <option value="">Select</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
          <option value="OTHERS">OTHERS</option>
        </select>
      </div>

      <div className={styles.formRow}>
        <label>Phone</label>
        <input
          value={employee.phone || ""}
          onChange={e =>
            setEmployee({ ...employee, phone: e.target.value })
          }
        />
      </div>

      <div className={styles.formRow}>
        <label>Emergency Contact</label>
        <input
          value={employee.emergency_contact || ""}
          onChange={e =>
            setEmployee({
              ...employee,
              emergency_contact: e.target.value
            })
          }
        />
      </div>


      <div className={styles.formRow}>
        <label>Marital Status</label>
        <select
          value={employee.marital_status || ""}
          onChange={e =>
            setEmployee({ ...employee, marital_status: e.target.value })
          }
        >
          <option value="">Select</option>
          <option value="SINGLE">SINGLE</option>
          <option value="MARRIED">MARRIED</option>
        </select>
      </div>

      <div className={styles.formRow}>
        <label>Qualification</label>
        <input
          value={employee.qualification || ""}
          onChange={e =>
            setEmployee({ ...employee, qualification: e.target.value })
          }
        />
      </div>

      <div className={styles.formRow}>
        <label>Experience</label>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="number"
            placeholder="Years"
            value={employee.exp_year || ""}
            onChange={e =>
              setEmployee({
                ...employee,
                exp_year: e.target.value
              })
            }
          />

          <input
            type="number"
            placeholder="Months"
            value={employee.exp_month || ""}
            onChange={e =>
              setEmployee({
                ...employee,
                exp_month: Math.min(11, e.target.value)
              })
            }
          />
        </div>
      </div>

      <div className={styles.formRow}>
  <label>Email</label>
  <input
    type="email"
    value={employee.email || ""}
    disabled={!editable}
    onChange={(e) =>
      setEmployee({ ...employee, email: e.target.value })
    }
  />
</div>

<div className={styles.formRow}>
  <label>Password</label>

  <div className={styles.passwordWrapper}>
    <input
      type={showPassword ? "text" : "password"}
      placeholder="Leave blank to keep existing password"
      className={`${styles.passwordInput} ${
        passwordError
          ? styles.passwordError
          : employee.password
          ? styles.passwordSuccess
          : ""
      }`}
      value={employee.password ?? ""}
      onChange={(e) => {
        const value = e.target.value;

        setEmployee({ ...employee, password: value });
        validatePassword(value);
      }}
    />

    {/* 👁️ Toggle */}
    <span
      className={styles.passwordToggle}
      onClick={() => setShowPassword(!showPassword)}
    >
      {showPassword ? "🙈" : "👁️"}
    </span>
  </div>

  {/* Hint */}
  <div className={styles.passwordHint}>
    Use strong password (8+ chars, Upper, Lower, Number, Special)
  </div>

  {/* Error */}
  {passwordError && (
    <div className={styles.passwordErrorText}>
      {passwordError}
    </div>
  )}
</div>

      <div className={styles.formRow}>
        <label>Permanent Address</label>
        <textarea
          value={employee.permanent_address || ""}
          onChange={e =>
            setEmployee({
              ...employee,
              permanent_address: e.target.value
            })
          }
        />
      </div>

      <div className={styles.formRow}>
        <label>
          <input
            type="checkbox"
            checked={employee.permanent_address === employee.temporary_address}
            onChange={(e) => {
              if (e.target.checked) {
                setEmployee({
                  ...employee,
                  temporary_address: employee.permanent_address
                });
              } else {
                setEmployee({
                  ...employee,
                  temporary_address: ""
                });
              }
            }}
          />
          Same as Permanent
        </label>
      </div>

      <div className={styles.formRow}>
        <label>Temporary Address</label>
        <textarea
          value={employee.temporary_address || ""}
          onChange={e =>
            setEmployee({
              ...employee,
              temporary_address: e.target.value
            })
          }
        />
      </div>

      {/* ZONE */}
      <div className={styles.formRow}>
        <label>Zone</label>
        <select
          value={employee.zone_id || ""}
          onChange={e =>
            setEmployee({ ...employee, zone_id: Number(e.target.value) })
          }
        >
          <option value="">Select Zone</option>
          {zones.map(z => (
            <option key={z.zone_id} value={z.zone_id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formRow}>
        <label>Primary Branch</label>

        <select
          value={employee.primary_branch_id || ""}
          onChange={e =>
            setEmployee({
              ...employee,
              primary_branch_id: e.target.value,
              area_ids: []
            })
          }
        >
          <option value="">Select</option>

          {branches
            .filter(b => String(b.zone_id) === String(employee.zone_id))
            .map(b => (
              <option key={b.branch_id} value={String(b.branch_id)}>
                {b.name}
              </option>
            ))}
        </select>
      </div>

      {/* CRM ACCESS */}
      <div className={styles.formRow}>
        <label>CRM Access</label>

        <select
          multiple
          className={styles.multiSelect}
          value={employee.crm_branch_ids || []}
          onChange={(e) =>
            setEmployee({
              ...employee,
              crm_branch_ids: Array.from(
                e.target.selectedOptions,
                (o) => String(o.value) // ✅ IMPORTANT
              ),
            })
          }
        >
          {branches
            .filter(
              (b) => String(b.zone_id) === String(employee.zone_id)
            )
            .map((b) => (
              <option key={b.branch_id} value={String(b.branch_id)}>
                {b.name}
              </option>
            ))}
        </select>
      </div>

      {/* AREA */}
      <div className={styles.formRow}>
        <label>Area Access</label>

        <select
          multiple
          className={styles.multiSelect}
          value={employee.area_ids || []}
          onChange={(e) =>
            setEmployee({
              ...employee,
              area_ids: Array.from(
                e.target.selectedOptions,
                (o) => String(o.value) // ✅ IMPORTANT
              ),
            })
          }
        >
          {areas.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.area_name}
            </option>
          ))}
        </select>
      </div>

      {/* BRANCH */}
      <div className={styles.formRow}>
        <label>Branches</label>
        <select
          multiple
          className={styles.multiSelect}
          value={employee.branch_ids || []}
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
            <option key={b.branch_id} value={String(b.branch_id)}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* TEAM */}
      <div className={styles.formRow}>
        <label>Team</label>
        <select
          value={employee.team_id || ""}
          onChange={e =>
            setEmployee({ ...employee, team_id: Number(e.target.value) })
          }
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
      <div className={styles.formRow}>
        <label>Designation</label>
        <select
          value={employee.designation_id || ""}
          onChange={e =>
            setEmployee({
              ...employee,
              designation_id: Number(e.target.value)
            })
          }
        >
          <option value="">Select Designation</option>
          {designations.map(d => (
            <option key={d.designation_id} value={d.designation_id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* MANAGER */}
      <div className={styles.formRow}>
        <label>Manager</label>
        <select
          value={employee.manager_id || ""}
          onChange={e =>
            setEmployee({
              ...employee,
              manager_id: e.target.value ? Number(e.target.value) : null
            })
          }
        >
          <option value="">No Manager</option>

          {managers.map(m => (
            <option key={m.id} value={Number(m.id)}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {["SUPER_ADMIN", "ADMIN"].includes(role) && (
        <div className={styles.formRow}>
          <label>Role</label>
          <select
            value={employee.role || ""}
            onChange={e =>
              setEmployee({ ...employee, role: e.target.value })
            }
          >
            <option value="USER_ACCOUNT">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER ADMIN</option>
          </select>
        </div>
      )}

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
          <option value="DEACTIVATED">DEACTIVATED</option>
          <option value="RELIEVED">RELIEVED</option>
        </select>
      </div>

      {editable && (
        <button
          className={styles.btnPrimary}
          onClick={updateEmployee}
        >
          Update Employee
        </button>
      )}

    </div>

  );
}