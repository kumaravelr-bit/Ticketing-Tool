import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getManpowerById,
  updateManpowerAction,
  updateManpowerRequest,
} from "../../../services/manpowerService";
import {
  getTeams,
  getDesignations,
  getAllBranches,
  getZones,
  getManagers
} from "../../../services/employeeService";

import styles from "../../../css/hrd/RequestDetails.module.css";
import { getAuthUser } from "../../../utils/auth";

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [logs, setLogs] = useState([]);
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [actions, setActions] = useState({
    manager: false,
    hr: false,
    cto: false
  });

  const [selectedActions, setSelectedActions] = useState({
    manager: "",
    hr: "",
    cto: ""
  });

  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [zones, setZones] = useState([]);
  const [managers, setManagers] = useState([]); // ✅ NEW

  const [userRole, setUserRole] = useState("");

  const isEditable = request?.final_status === "Submitted";
  const isAdminOrSuperAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

    /* ✅ FIXED ROLE */
    useEffect(() => {
      const user = getAuthUser() || {};
      const role = user.role || user.userRole || "";
      setUserRole(role.toUpperCase());
    }, []);

  /* ✅ DROPDOWNS LOAD */
  useEffect(() => {
    const loadDropdowns = async () => {
      try {
        const [teamsRes, zonesRes, branchesRes] = await Promise.all([
          getTeams(),
          getZones(),
          getAllBranches()
        ]);

        setTeams(teamsRes?.data || []);
        setZones(zonesRes?.data || []);
        setBranches(branchesRes?.data || []);
      } catch (err) {
        console.error("Failed to load dropdown options:", err);
      }
    };

    loadDropdowns();
  }, []);

  /* ✅ DESIGNATIONS */
  useEffect(() => {
    if (request?.team_id) {
      getDesignations(request.team_id)
        .then(res => setDesignations(res?.data || []))
        .catch(() => setDesignations([]));
    }
  }, [request?.team_id]);

  /* ✅ MANAGERS */
  useEffect(() => {
    if (request?.team_id && request?.designation_id) {
      getManagers({
        team_id: Number(request.team_id),
        zone_id: Number(request.zone_id) || null,
        designation_id: Number(request.designation_id)
      })
        .then(res => setManagers(res?.data || []))
        .catch(() => setManagers([]));
    }
  }, [request?.team_id, request?.zone_id, request?.designation_id]);

  async function loadData() {
    try {
      setPageLoading(true);
      const res = await getManpowerById(id);
      const data = res?.data || {};
      setRequest(data.request || data);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setActions(data.actions || {});
    } catch (err) {
      console.error("LOAD ERROR:", err);
      setMessage("Failed to load request");
    } finally {
      setPageLoading(false);
    }
  }

  function handleChange(field, value) {
    setRequest((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  /* ✅ UPDATED - ALL FIELDS INCLUDED */
  async function handleUpdate() {
    try {
      setLoading(true);
      await updateManpowerRequest(id, {
        ...request,
        openings: Number(request.openings),
        salary_range: Number(request.salary_range || 0)
      });
      setMessage("Request updated successfully");
      loadData();
    } catch (err) {
      console.error("UPDATE ERROR:", err);
      setMessage("Update failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(type, value) {
    setSelectedActions(prev => ({
      ...prev,
      [type]: value
    }));
  }

  async function submitAction(type) {
    const action = selectedActions[type];
    if (!action) {
      return setMessage("Please select action");
    }

    if (action === "Rejected" && !comments.trim()) {
      return setMessage("Comments required for rejection");
    }

    try {
      setLoading(true);
      await updateManpowerAction(id, type, {
        action,
        comments: action === "Rejected" ? comments : ""
      });
      setMessage(`${type.toUpperCase()} ${action}`);
      setComments("");

      setSelectedActions(prev => ({
        ...prev,
        [type]: ""
      }));

      loadData();
    } catch (err) {
      console.error("ACTION ERROR:", err);
      setMessage("Action failed");
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (!request) {
    return <div className={styles.container}>No data found</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>

        <h2 className={styles.title}>Manpower Request Details</h2>

        {message && <div className={styles.message}>{message}</div>}

        <div className={styles.form}>

          <div className={styles.group}>
            <label>Request No</label>
            <input value={request.request_number || ""} readOnly className={styles.readonly}/>
          </div>

          <div className={styles.group}>
            <label>Employee Name</label>
            <input value={request.employee_name || ""} readOnly className={styles.readonly}/>
          </div>

          {/* ✅ FIXED DROPDOWNS */}
          <div className={styles.group}>
            <label>Team</label>
            <select
              value={request.team_id || ""}
              disabled={!isEditable || !isAdminOrSuperAdmin}
              onChange={(e) => handleChange("team_id", e.target.value)}
            >
              <option value="">Select Team</option>
              {teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.group}>
            <label>Designation</label>
            <select
              value={request.designation_id || ""}
              disabled={!isEditable || !isAdminOrSuperAdmin}
              onChange={(e) => handleChange("designation_id", e.target.value)}
            >
              <option value="">Select Designation</option>
              {designations.map((des) => (
                <option key={des.designation_id} value={des.designation_id}>
                  {des.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.group}>
            <label>Zone</label>
            <select
              value={request.zone_id || ""}
              disabled={!isEditable || !isAdminOrSuperAdmin}
              onChange={(e) => handleChange("zone_id", e.target.value)}
            >
              <option value="">Select Zone</option>
              {zones.map((zone) => (
                <option key={zone.zone_id} value={zone.zone_id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.group}>
            <label>Branch</label>
            <select
              value={request.branch_id || ""}
              disabled={!isEditable || !isAdminOrSuperAdmin}
              onChange={(e) => handleChange("branch_id", e.target.value)}
            >
              <option value="">Select Branch</option>
              {branches.map((branch) => (
                <option key={branch.branch_id} value={branch.branch_id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ NEW FIELD */}
          <div className={styles.group}>
            <label>Reporting Manager</label>
            <select
              value={request.reporting_manager || ""}
              onChange={(e) => handleChange("reporting_manager", e.target.value)}
            >
              <option value="">Select Manager</option>
              {managers.map((m) => (
                <option key={m.emp_id} value={m.emp_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* EXISTING */}
          <div className={styles.group}>
            <label>Openings</label>
            <input value={request.openings || ""} readOnly={!isEditable}
              onChange={(e) => handleChange("openings", e.target.value)} />
          </div>

          <div className={styles.group}>
            <label>Salary Range</label>
            <input value={request.salary_range || ""} readOnly={!isEditable}
              onChange={(e) => handleChange("salary_range", e.target.value)} />
          </div>

          {/* ✅ NEW FIELDS FROM NEW REQUEST */}
          <div className={styles.group}>
            <label>Experience</label>
            <input value={request.experience_required || ""}
              onChange={(e) => handleChange("experience_required", e.target.value)} />
          </div>

          <div className={`${styles.group} ${styles.full}`}>
            <label>Key Skills</label>
            <textarea value={request.key_skills || ""}
              onChange={(e) => handleChange("key_skills", e.target.value)} />
          </div>

          <div className={styles.group}>
            <label>Priority</label>
            <input value={request.priority_level || ""}
              readOnly={!isEditable || !isAdminOrSuperAdmin}
              onChange={(e) => handleChange("priority_level", e.target.value)} />
          </div>

          <div className={`${styles.group} ${styles.full}`}>
            <label>Reason</label>
            <textarea value={request.reason_for_requirement || ""}
              readOnly={!isEditable || !isAdminOrSuperAdmin}
              onChange={(e) => handleChange("reason_for_requirement", e.target.value)} />
          </div>

          {/* STATUS */}
          <div className={styles.group}>
            <label>Manager Status</label>
            <input value={request.manager_status || ""} readOnly className={styles.readonly}/>
          </div>

          <div className={styles.group}>
            <label>HR Status</label>
            <input value={request.hr_status || ""} readOnly className={styles.readonly}/>
          </div>

          <div className={styles.group}>
            <label>CTO Status</label>
            <input value={request.cto_status || ""} readOnly className={styles.readonly}/>
          </div>

          <div className={styles.group}>
            <label>Final Status</label>
            <input value={request.final_status || ""} readOnly className={styles.readonly}/>
          </div>

          {isEditable && (
            <div className={`${styles.full} ${styles.btnGroup}`}>
              <button onClick={handleUpdate} disabled={loading} className={styles.approveBtn}>
                Update Request
              </button>
            </div>
          )}

          {/* APPROVALS (UNCHANGED) */}
          {actions?.manager && (
            <div className={`${styles.group} ${styles.full}`}>
              <label>Manager Verification</label>
              <select value={selectedActions.manager}
                onChange={(e) => handleSelect("manager", e.target.value)}>
                <option value="">Select</option>
                <option value="Approved">Approval</option>
                <option value="Rejected">Rejected</option>
              </select>

              {selectedActions.manager === "Rejected" && (
                <textarea value={comments}
                  onChange={(e) => setComments(e.target.value)} />
              )}

              <button onClick={() => submitAction("manager")} className={styles.approveBtn}>
                Submit
              </button>
            </div>
          )}

          {actions?.hr && (
            <div className={`${styles.group} ${styles.full}`}>
              <label>HR Verification</label>
              <select value={selectedActions.hr}
                onChange={(e) => handleSelect("hr", e.target.value)}>
                <option value="">Select</option>
                <option value="Approved">Approval</option>
                <option value="Rejected">Rejected</option>
              </select>

              {selectedActions.hr === "Rejected" && (
                <textarea value={comments}
                  onChange={(e) => setComments(e.target.value)} />
              )}

              <button onClick={() => submitAction("hr")} className={styles.approveBtn}>
                Submit
              </button>
            </div>
          )}

          {actions?.cto && (
            <div className={`${styles.group} ${styles.full}`}>
              <label>CTO Verification</label>
              <select value={selectedActions.cto}
                onChange={(e) => handleSelect("cto", e.target.value)}>
                <option value="">Select</option>
                <option value="Approved">Approval</option>
                <option value="Rejected">Rejected</option>
              </select>

              {selectedActions.cto === "Rejected" && (
                <textarea value={comments}
                  onChange={(e) => setComments(e.target.value)} />
              )}

              <button onClick={() => submitAction("cto")} className={styles.approveBtn}>
                Submit
              </button>
            </div>
          )}

        </div>

        <h3 className={styles.title}>Logs</h3>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Action</th>
              <th>User</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.stage}</td>
                  <td>{l.action_taken}</td>
                  <td>{l.actor_name}</td>
                  <td>{l.comments}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">No logs available</td>
              </tr>
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
}
