import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaPen } from "react-icons/fa";
import {
  getManpowerById,
  updateManpowerAction,
  updateManpowerRequest,
} from "../../../services/manpowerService";
import {
  getAllBranches,
  getDesignations,
  getManagers,
  getTeams,
  getZones,
} from "../../../services/employeeService";
import styles from "../../../css/hrd/RequestDetails.module.css";
import { getAuthItem, getAuthUser } from "../../../utils/auth";

const normalize = (value) => (value ?? "").toString().trim().toUpperCase();

const STAGES = {
  manager: {
    statusKey: "manager_status",
    statusLabel: "Manager Status",
    logStage: "Manager",
  },
  hr: {
    statusKey: "hr_status",
    statusLabel: "HR Status",
    logStage: "HRD",
  },
  cto: {
    statusKey: "cto_status",
    statusLabel: "Management Status",
    logStage: "Management",
  },
};

function getStoredUser() {
  const user = getAuthUser() || {};
  return {
    ...user,
    role: normalize(user.role || user.userRole || getAuthItem("role")),
    team: normalize(
      user.team || user.team_name || user.department || getAuthItem("team")
    ),
    designation: normalize(
      user.designation || user.designation_name || getAuthItem("designation")
    ),
    name: user.name || user.employee_name || "",
  };
}

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [allowedActions, setAllowedActions] = useState({
    manager: false,
    hr: false,
    cto: false,
  });
  const [editableActions, setEditableActions] = useState({
    manager: false,
    hr: false,
    cto: false,
  });

  const [selectedActions, setSelectedActions] = useState({
    manager: "",
    hr: "",
    cto: "",
  });
  const [actionComments, setActionComments] = useState({
    manager: "",
    hr: "",
    cto: "",
  });

  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [zones, setZones] = useState([]);
  const [managers, setManagers] = useState([]);

  const currentUser = useMemo(() => getStoredUser(), []);
  const isAdminOrSuperAdmin = ["ADMIN", "SUPER_ADMIN"].includes(currentUser.role);

  const isEditable =
    normalize(request?.final_status) === "SUBMITTED" && isAdminOrSuperAdmin;

  const loadData = useCallback(async () => {
    try {
      setPageLoading(true);
      const res = await getManpowerById(id);
      const data = res?.data || {};
      setRequest(data.request || data);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setAllowedActions({
        manager: Boolean(data.actions?.manager),
        hr: Boolean(data.actions?.hr),
        cto: Boolean(data.actions?.cto),
      });
      setEditableActions({
        manager: Boolean(data.editActions?.manager),
        hr: Boolean(data.editActions?.hr),
        cto: Boolean(data.editActions?.cto),
      });
      setSelectedActions({
        manager: "",
        hr: "",
        cto: "",
      });
      setActionComments({
        manager: "",
        hr: "",
        cto: "",
      });
    } catch (err) {
      console.error("LOAD ERROR:", err);
      toast.error("Failed to load request");
    } finally {
      setPageLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const initializeRequest = async () => {
      try {
        setPageLoading(true);
        const res = await getManpowerById(id);
        const data = res?.data || {};
        setRequest(data.request || data);
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setAllowedActions({
          manager: Boolean(data.actions?.manager),
          hr: Boolean(data.actions?.hr),
          cto: Boolean(data.actions?.cto),
        });
        setEditableActions({
          manager: Boolean(data.editActions?.manager),
          hr: Boolean(data.editActions?.hr),
          cto: Boolean(data.editActions?.cto),
        });
        setSelectedActions({
          manager: "",
          hr: "",
          cto: "",
        });
        setActionComments({
          manager: "",
          hr: "",
          cto: "",
        });
      } catch (err) {
        console.error("LOAD ERROR:", err);
        toast.error("Failed to load request");
      } finally {
        setPageLoading(false);
      }
    };

    initializeRequest();
  }, [id]);

  useEffect(() => {
    const loadDropdowns = async () => {
      try {
        const [teamsRes, zonesRes, branchesRes] = await Promise.all([
          getTeams(),
          getZones(),
          getAllBranches(),
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

  useEffect(() => {
    if (!request?.team_id) {
      setDesignations([]);
      return;
    }

    getDesignations(request.team_id)
      .then((res) => setDesignations(res?.data || []))
      .catch(() => setDesignations([]));
  }, [request?.team_id]);

  useEffect(() => {
    if (!request?.team_id || !request?.designation_id) {
      setManagers([]);
      return;
    }

    getManagers({
      team_id: Number(request.team_id),
      zone_id: Number(request.zone_id) || null,
      designation_id: Number(request.designation_id),
    })
      .then((res) => setManagers(res?.data || []))
      .catch(() => setManagers([]));
  }, [request?.team_id, request?.zone_id, request?.designation_id]);

  function handleChange(field, value) {
    setRequest((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleUpdate() {
    try {
      setLoading(true);
      await updateManpowerRequest(id, {
        zone_id: Number(request.zone_id) || null,
        branch_id: Number(request.branch_id) || null,
        team_id: Number(request.team_id) || null,
        designation_id: Number(request.designation_id) || null,
        reporting_manager: request.reporting_manager || "",
        openings: Number(request.openings || 0),
        experience_required: request.experience_required || "",
        salary_range: Number(request.salary_range || 0),
        key_skills: request.key_skills || "",
        priority_level: request.priority_level || "",
        reason_for_requirement: request.reason_for_requirement || "",
      });
      toast.success("Request updated successfully");
      loadData();
    } catch (err) {
      console.error("UPDATE ERROR:", err);
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  }

  function getStageStatus(type) {
    const status = request?.[STAGES[type].statusKey];
    return status || "Pending";
  }

  function getStageReason(type) {
    const stageNames =
      type === "cto" ? [STAGES[type].logStage, "CTO/CEO"] : [STAGES[type].logStage];

    const latestRejectedLog = logs.find(
      (log) =>
        stageNames.map(normalize).includes(normalize(log.stage)) &&
        normalize(log.action_taken) === "REJECTED"
    );

    return latestRejectedLog?.comments?.trim() || "";
  }

  function canActOnStage(type) {
    const currentStageStatus = normalize(getStageStatus(type));

    if (currentStageStatus !== "PENDING") return false;
    return Boolean(allowedActions[type]);
  }

  function canReviseStage(type) {
    const currentStageStatus = normalize(getStageStatus(type));
    if (!["APPROVED", "REJECTED"].includes(currentStageStatus)) return false;
    return Boolean(editableActions[type]);
  }

  function openRejectBox(type) {
    setSelectedActions((prev) => ({
      ...prev,
      [type]: "Rejected",
    }));
  }

  function openReviseBox(type) {
    setSelectedActions((prev) => ({
      ...prev,
      [type]: "Revise",
    }));
    setActionComments((prev) => ({
      ...prev,
      [type]: "",
    }));
  }

  function closeRejectBox(type) {
    setSelectedActions((prev) => ({
      ...prev,
      [type]: "",
    }));
    setActionComments((prev) => ({
      ...prev,
      [type]: "",
    }));
  }

  async function submitAction(type, action) {
    const rejectionComment = actionComments[type]?.trim() || "";

    if (action === "Rejected" && !rejectionComment) {
      toast.error("Reason is required for rejection");
      return;
    }

    try {
      setLoading(true);
      await updateManpowerAction(id, type, {
        action,
        comments: action === "Rejected" ? rejectionComment : "",
      });

      toast.success(`${STAGES[type].statusLabel} ${action}`);
      closeRejectBox(type);
      loadData();
    } catch (err) {
      console.error("ACTION ERROR:", err);
      toast.error(err?.response?.data?.message || "Action failed");
    } finally {
      setLoading(false);
    }
  }

  function renderStageSection(type) {
    const status = getStageStatus(type);
    const statusNormalized = normalize(status);
    const rejectionReason = getStageReason(type);
    const canAct = canActOnStage(type);
    const canRevise = canReviseStage(type);
    const showRejectReasonBox = selectedActions[type] === "Rejected";
    const showReviseBox = selectedActions[type] === "Revise";
    const showActionControls = canAct || showReviseBox || showRejectReasonBox;

    return (
      <div key={type} className={`${styles.group} ${styles.full} ${styles.stageCard}`}>
        <label>{STAGES[type].statusLabel}</label>
        <input value={status} readOnly className={styles.readonly} />

        {showActionControls ? (
          <>
            <div className={styles.stageActionRow}>
              <button
                type="button"
                className={styles.approveBtn}
                disabled={loading}
                onClick={() => submitAction(type, "Approved")}
              >
                Approve
              </button>
              <button
                type="button"
                className={styles.rejectBtn}
                disabled={loading}
                onClick={() => openRejectBox(type)}
              >
                Reject
              </button>
              {showReviseBox && !showRejectReasonBox && (
                <button
                  type="button"
                  className={styles.button}
                  disabled={loading}
                  onClick={() => closeRejectBox(type)}
                >
                  Cancel
                </button>
              )}
            </div>

            {showRejectReasonBox && (
              <>
                <textarea
                  value={actionComments[type]}
                  onChange={(e) =>
                    setActionComments((prev) => ({
                      ...prev,
                      [type]: e.target.value,
                    }))
                  }
                  placeholder={`Enter ${STAGES[type].statusLabel.toLowerCase()} rejection reason`}
                />
                <div className={styles.stageActionRow}>
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    disabled={loading}
                    onClick={() => submitAction(type, "Rejected")}
                  >
                    Submit Rejection
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={loading}
                    onClick={() => closeRejectBox(type)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </>
        ) : statusNormalized === "REJECTED" ? (
          <>
            <div className={styles.stageStatusRow}>
              <div className={styles.reasonBox}>
                {rejectionReason || "Rejected without a recorded reason"}
              </div>
              {canRevise && (
                <button
                  type="button"
                  className={styles.iconBtn}
                  title={`Edit ${STAGES[type].statusLabel}`}
                  disabled={loading}
                  onClick={() => openReviseBox(type)}
                >
                  <FaPen />
                </button>
              )}
            </div>
          </>
        ) : statusNormalized === "APPROVED" ? (
          <div className={styles.stageStatusRow}>
            <div className={styles.helperText}>Approved</div>
            {canRevise && (
              <button
                type="button"
                className={styles.iconBtn}
                title={`Edit ${STAGES[type].statusLabel}`}
                disabled={loading}
                onClick={() => openReviseBox(type)}
              >
                <FaPen />
              </button>
            )}
          </div>
        ) : statusNormalized === "PENDING" ? (
          <div className={styles.helperText}>Approval Pending</div>
        ) : (
          <div className={styles.helperText}>Approved</div>
        )}
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>Loading...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>No data found</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            Back
          </button>
        </div>

        <h2 className={styles.title}>Manpower Request Details</h2>

        <div className={styles.form}>
          <div className={styles.group}>
            <label>Request No</label>
            <input
              value={request.request_number || ""}
              readOnly
              className={styles.readonly}
            />
          </div>

          <div className={styles.group}>
            <label>Employee Name</label>
            <input
              value={request.employee_name || ""}
              readOnly
              className={styles.readonly}
            />
          </div>

          <div className={styles.group}>
            <label>Team</label>
            <select
              value={request.team_id || ""}
              disabled={!isEditable}
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
              disabled={!isEditable}
              onChange={(e) => handleChange("designation_id", e.target.value)}
            >
              <option value="">Select Designation</option>
              {designations.map((designation) => (
                <option
                  key={designation.designation_id}
                  value={designation.designation_id}
                >
                  {designation.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.group}>
            <label>Zone</label>
            <select
              value={request.zone_id || ""}
              disabled={!isEditable}
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
              disabled={!isEditable}
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

          <div className={styles.group}>
            <label>Reporting Manager</label>
            <select
              value={request.reporting_manager || ""}
              disabled={!isEditable}
              onChange={(e) => handleChange("reporting_manager", e.target.value)}
            >
              <option value="">Select Manager</option>
              {managers.map((manager) => (
                <option key={manager.emp_id} value={manager.emp_id}>
                  {manager.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.group}>
            <label>Openings</label>
            <input
              value={request.openings || ""}
              readOnly={!isEditable}
              onChange={(e) => handleChange("openings", e.target.value)}
            />
          </div>

          <div className={styles.group}>
            <label>Salary Range</label>
            <input
              value={request.salary_range || ""}
              readOnly={!isEditable}
              onChange={(e) => handleChange("salary_range", e.target.value)}
            />
          </div>

          <div className={styles.group}>
            <label>Experience</label>
            <input
              value={request.experience_required || ""}
              readOnly={!isEditable}
              onChange={(e) => handleChange("experience_required", e.target.value)}
            />
          </div>

          <div className={`${styles.group} ${styles.full}`}>
            <label>Key Skills</label>
            <textarea
              value={request.key_skills || ""}
              readOnly={!isEditable}
              onChange={(e) => handleChange("key_skills", e.target.value)}
            />
          </div>

          <div className={styles.group}>
            <label>Priority</label>
            <input
              value={request.priority_level || ""}
              readOnly={!isEditable}
              onChange={(e) => handleChange("priority_level", e.target.value)}
            />
          </div>

          <div className={`${styles.group} ${styles.full}`}>
            <label>Reason</label>
            <textarea
              value={request.reason_for_requirement || ""}
              readOnly={!isEditable}
              onChange={(e) => handleChange("reason_for_requirement", e.target.value)}
            />
          </div>

          {renderStageSection("manager")}
          {renderStageSection("hr")}
          {renderStageSection("cto")}

          <div className={`${styles.group} ${styles.full}`}>
            <label>Final Status</label>
            <input value={request.final_status || "Submitted"} readOnly className={styles.readonly} />
          </div>

          {isEditable && (
            <div className={`${styles.full} ${styles.btnGroup}`}>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={loading}
                className={styles.approveBtn}
              >
                Update Request
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
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.stage}</td>
                  <td>{log.action_taken}</td>
                  <td>{log.actor_name}</td>
                  <td>{log.comments}</td>
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
