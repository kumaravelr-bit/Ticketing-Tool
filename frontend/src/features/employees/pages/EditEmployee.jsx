import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaPen, FaTrash, FaUserCircle } from "react-icons/fa";
import styles from "../../../css/employees/EditEmployee.module.css";

import {
  getEmployeeById,
  getZones,
  getTeams,
  getAllBranches,
  getAreasByBranch,
  getDesignations,
  getManagers,
  updateEmployee as updateEmployeeAPI,
} from "../../../services/employeeService";
import { getAuthItem } from "../../../utils/auth";
import { resolveAssetUrl } from "../../../config/apiConfig";

const ensureSelectedId = (ids = [], id) => {
  const normalizedIds = (ids || []).map(String).filter(Boolean);
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return normalizedIds;
  return normalizedIds.includes(normalizedId)
    ? normalizedIds
    : [normalizedId, ...normalizedIds];
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const pad = (value) => String(value).padStart(2, "0");

const normalizeDateForInput = (value) => {
  if (!value) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
      value.getDate(),
    )}`;
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}`;
};

export default function EditEmployee() {
  const { empId } = useParams();
  const navigate = useNavigate();

  const callerRole = (getAuthItem("role") || "").toUpperCase();
  const isAdminUser = ["SUPER_ADMIN", "ADMIN"].includes(callerRole);

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [employee, setEmployee] = useState(null);
  const photoInputRef = useRef(null);

  const canEdit = isAdminUser && isEditing;
  const canEditEmpId = isAdminUser && isEditing;
  const canEditStatus = isAdminUser && isEditing;
  const canEditRole = isAdminUser && isEditing;

  const roleOptions =
    callerRole === "SUPER_ADMIN"
      ? ["USER_ACCOUNT", "ADMIN", "SUPER_ADMIN"]
      : ["USER_ACCOUNT"];

  useEffect(() => {
    (async () => {
      try {
        const res = await getEmployeeById(empId);
        const emp = { ...res.data };

        emp.joining_date = normalizeDateForInput(emp.joining_date);
        emp.dob = normalizeDateForInput(emp.dob);

        if (emp.experience) {
          const parts = String(emp.experience).split(".");
          emp.exp_year = parts[0] || "0";
          emp.exp_month = parts[1] || "0";
        } else {
          emp.exp_year = "0";
          emp.exp_month = "0";
        }

        emp.zone_id = emp.zone_id ? String(emp.zone_id) : "";
        emp.team_id = emp.team_id ? String(emp.team_id) : "";
        emp.designation_id = emp.designation_id ? String(emp.designation_id) : "";
        emp.manager_id = emp.manager_id ? String(emp.manager_id) : "";
        emp.primary_branch_id = emp.primary_branch_id ? String(emp.primary_branch_id) : "";
        emp.crm_branch_ids = ensureSelectedId((emp.crm_branch_ids || []).map(String), emp.primary_branch_id);
        emp.ticket_branch_ids = (emp.ticket_branch_ids || []).map(String);
        emp.area_ids = (emp.area_ids || []).map(String);
        emp.branch_ids = emp.branch_id ? [String(emp.branch_id)] : [];
        emp.password = "";

        setEmployee(emp);
      } catch (err) {
        console.error("Load employee error:", err);
        toast.error("Employee not found");
        navigate("/active");
      } finally {
        setLoading(false);
      }
    })();
  }, [empId, navigate]);

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [employee?.profile_photo, previewImage]);

  useEffect(() => {
    if (!isAdminUser) return;

    Promise.all([getZones(), getTeams()])
      .then(([z, t]) => {
        setZones(z.data || []);
        setTeams(t.data || []);
      })
      .catch(() => toast.error("Failed to load master data"));

    getAllBranches()
      .then((res) => {
        setBranches(
          (res.data || []).map((b) => ({
            branch_id: b.branch_id ?? b.id,
            name: b.name ?? b.branch_name,
            zone_id: String(b.zone_id),
          }))
        );
      })
      .catch(() => setBranches([]));
  }, [isAdminUser]);

  useEffect(() => {
    if (!isAdminUser || !employee?.team_id) {
      setDesignations([]);
      return;
    }
    getDesignations(employee.team_id)
      .then((res) => setDesignations(res.data || []))
      .catch(() => setDesignations([]));
  }, [employee?.team_id, isAdminUser]);

  useEffect(() => {
    if (!isAdminUser || !employee?.designation_id) {
      setManagers([]);
      return;
    }

    getManagers({
      team_id: employee.team_id || null,
      zone_id: employee.zone_id || null,
      designation_id: employee.designation_id || null,
    })
      .then((res) => {
        let list = res.data || [];
        if (employee.manager_id && !list.some((m) => String(m.id) === String(employee.manager_id))) {
          list = [{ id: employee.manager_id, name: `Manager (${employee.manager_id})` }, ...list];
        }
        setManagers(list);
      })
      .catch(() => setManagers([]));
  }, [employee?.team_id, employee?.zone_id, employee?.designation_id, employee?.manager_id, isAdminUser]);

  useEffect(() => {
    if (!isAdminUser || !employee?.primary_branch_id) {
      setAreas([]);
      return;
    }
    getAreasByBranch(employee.primary_branch_id)
      .then((res) => setAreas(res.data || []))
      .catch(() => setAreas([]));
  }, [employee?.primary_branch_id, isAdminUser]);

  useEffect(() => {
    setEmployee((prev) => {
      if (!prev || !areas.length) return prev;
      return {
        ...prev,
        area_ids: (prev.area_ids || []).map(String),
      };
    });
  }, [areas]);

  const setField = (field, value) => setEmployee((prev) => ({ ...prev, [field]: value }));

  const handleChange = (field, value) => {
    if (field === "zone_id") {
      setEmployee((prev) => ({
        ...prev,
        zone_id: value,
        primary_branch_id: "",
        crm_branch_ids: [],
        area_ids: [],
      }));
      return;
    }

    if (field === "primary_branch_id") {
      setEmployee((prev) => ({
        ...prev,
        primary_branch_id: value,
        area_ids: [],
        crm_branch_ids: ensureSelectedId(prev.crm_branch_ids, value),
      }));
      return;
    }

    if (field === "team_id") {
      setEmployee((prev) => ({ ...prev, team_id: value, designation_id: "", manager_id: "" }));
      setDesignations([]);
      setManagers([]);
      return;
    }

    if (field === "designation_id") {
      setEmployee((prev) => ({ ...prev, designation_id: value, manager_id: "" }));
      setManagers([]);
      return;
    }

    if (field === "same_address" && value === true) {
      setEmployee((prev) => ({ ...prev, same_address: true, temporary_address: prev.permanent_address }));
      return;
    }

    if (field === "permanent_address" && employee?.same_address) {
      setEmployee((prev) => ({ ...prev, permanent_address: value, temporary_address: value }));
      return;
    }

    setField(field, value);
  };

  const validatePassword = (pw) => {
    if (!pw) {
      setPasswordError("");
      return true;
    }
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!strong.test(pw)) {
      setPasswordError("Min 8 chars with Upper, Lower, Number & Special char");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleUpdate = async () => {
    if (!employee || !isAdminUser) return;
    if (employee.password && !validatePassword(employee.password)) return;

    try {
      const formData = new FormData();
      const scalars = [
        "emp_id", "name", "father_name", "gender", "email", "phone",
        "emergency_contact", "marital_status", "qualification",
        "permanent_address", "temporary_address",
        "joining_date", "joining_status", "role", "status", "dob",
        "team_id", "designation_id", "zone_id", "primary_branch_id",
      ];

      scalars.forEach((key) => formData.append(key, employee[key] || ""));

      formData.append("manager_id", employee.manager_id || "");
      formData.append("exp_year", employee.exp_year || 0);
      formData.append("exp_month", employee.exp_month || 0);
      if (employee.password) formData.append("password", employee.password);
      formData.append("crm_branch_ids", JSON.stringify(employee.crm_branch_ids || []));
      formData.append("ticket_branch_ids", JSON.stringify(employee.ticket_branch_ids || []));
      formData.append("area_ids", JSON.stringify(employee.area_ids || []));

      if (employee.new_profile_photo) formData.append("profile_photo", employee.new_profile_photo);
      if (employee.remove_photo) formData.append("remove_photo", "true");

      await updateEmployeeAPI(empId, formData);
      toast.success("Employee updated successfully");
      setIsEditing(false);
      setTimeout(() => navigate("/active"), 800);
    } catch (err) {
      console.error("Update error:", err);
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const getSelectedNames = (selectedIds = [], options = [], getId, getLabel) => {
    const selectedSet = new Set((selectedIds || []).map(String));
    return options
      .filter((option) => selectedSet.has(String(getId(option))))
      .map((option) => getLabel(option));
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!employee) return null;

  const branchesInZone = branches.filter((b) => String(b.zone_id) === String(employee.zone_id));
  const selectedCrmBranches = getSelectedNames(employee.crm_branch_ids, branchesInZone, (branch) => branch.branch_id, (branch) => branch.name);
  const selectedTicketBranches = getSelectedNames(employee.ticket_branch_ids, branches, (branch) => branch.branch_id, (branch) => branch.name);
  const selectedAreas = getSelectedNames(employee.area_ids, areas, (area) => area.id, (area) => area.area_name);
  const profilePhotoUrl = previewImage || resolveAssetUrl(employee.profile_photo, "uploads/profile");
  const hasVisiblePhoto = Boolean(profilePhotoUrl) && !photoLoadFailed;

  const normalEmployeeFields = [
    ["EMP ID", employee.emp_id],
    ["Name", employee.name],
    ["Date of Birth", employee.dob],
    ["Gender", employee.gender],
    ["Email", employee.email],
    ["Phone", employee.phone],
    ["Emergency Contact", employee.emergency_contact],
    ["Marital Status", employee.marital_status],
    ["Qualification", employee.qualification],
    ["Zone", employee.zone_name],
    ["Primary Branch", employee.branch_name],
    ["Team", employee.team_name],
    ["Designation", employee.designation_name],
    ["Status", employee.status],
  ];

  const renderReadOnlyRow = (label, value) => (
    <div className={styles.formRow} key={label}>
      <label>{label}</label>
      <div className={styles.readOnlyField}>{displayValue(value)}</div>
    </div>
  );

  return (
    <div className={styles.employeeEditContainer}>
      <div className={styles.topBar}>
        <button className={styles.btnBack} onClick={() => navigate("/active")}>
          Back
        </button>

        {isAdminUser && (
          <button
            className={styles.btnEdit}
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? "Cancel Edit" : "Edit"}
          </button>
        )}
      </div>

      <h2>{isAdminUser ? "Edit Employee" : "Employee Details"}</h2>

      {!isAdminUser ? (
        <div className={styles.viewGrid}>
          {normalEmployeeFields.map(([label, value]) => renderReadOnlyRow(label, value))}
        </div>
      ) : (
        <>
          <div className={styles.formRow}>
            <label>Employee ID</label>
            <input
              value={employee.emp_id || ""}
              disabled={!canEditEmpId}
              onChange={(e) => setField("emp_id", e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <label>Profile Photo</label>

            <div className={styles.photoWrap}>
              {hasVisiblePhoto ? (
                <img
                  src={profilePhotoUrl}
                  alt="profile"
                  className={styles.profilePreview}
                  onError={() => setPhotoLoadFailed(true)}
                />
              ) : (
                <div className={styles.profileFallback}>
                  <FaUserCircle size={56} />
                </div>
              )}

              {canEdit && (
                <div className={styles.photoActions}>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className={styles.iconBtn}
                    title="Change Photo"
                  >
                    <FaPen size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmployee((prev) => ({ ...prev, remove_photo: true, new_profile_photo: null, profile_photo: null }));
                      setPreviewImage(null);
                    }}
                    className={`${styles.iconBtn} ${styles.dangerIconBtn}`}
                    title="Remove Photo"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              )}
            </div>

            {canEdit && (
              <input
                ref={photoInputRef}
                className={styles.hiddenFileInput}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    alert("Image must be < 2MB");
                    return;
                  }
                  setPhotoLoadFailed(false);
                  setPreviewImage(URL.createObjectURL(file));
                  setEmployee((prev) => ({ ...prev, new_profile_photo: file, remove_photo: false }));
                  e.target.value = "";
                }}
              />
            )}
          </div>

          <div className={styles.formRow}>
            <label>Joining Status</label>
            <select value={employee.joining_status || ""} disabled={!canEdit} onChange={(e) => handleChange("joining_status", e.target.value)}>
              <option value="TRAINEE">TRAINEE</option>
              <option value="PERMANENT">PERMANENT</option>
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Joining Date</label>
            <input type="date" value={employee.joining_date || ""} disabled={!canEdit} onChange={(e) => handleChange("joining_date", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Name</label>
            <input value={employee.name || ""} disabled={!canEdit} onChange={(e) => handleChange("name", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Father Name</label>
            <input value={employee.father_name || ""} disabled={!canEdit} onChange={(e) => handleChange("father_name", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Date of Birth</label>
            <input type="date" value={employee.dob || ""} disabled={!canEdit} onChange={(e) => handleChange("dob", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Gender</label>
            <select value={employee.gender || ""} disabled={!canEdit} onChange={(e) => handleChange("gender", e.target.value)}>
              <option value="">Select</option>
              <option value="MALE">MALE</option>
              <option value="FEMALE">FEMALE</option>
              <option value="OTHERS">OTHERS</option>
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Email</label>
            <input type="email" value={employee.email || ""} disabled={!canEdit} onChange={(e) => handleChange("email", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Phone</label>
            <input value={employee.phone || ""} disabled={!canEdit} onChange={(e) => handleChange("phone", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Emergency Contact</label>
            <input value={employee.emergency_contact || ""} disabled={!canEdit} onChange={(e) => handleChange("emergency_contact", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Marital Status</label>
            <select value={employee.marital_status || ""} disabled={!canEdit} onChange={(e) => handleChange("marital_status", e.target.value)}>
              <option value="">Select</option>
              <option value="SINGLE">SINGLE</option>
              <option value="MARRIED">MARRIED</option>
              <option value="DIVORCED">DIVORCED</option>
              <option value="WIDOWED">WIDOWED</option>
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Experience</label>
            <div className={styles.inlineFields}>
              <input type="number" placeholder="Years" min="0" value={employee.exp_year || ""} disabled={!canEdit} onChange={(e) => handleChange("exp_year", e.target.value)} />
              <input type="number" placeholder="Months (0-11)" min="0" max="11" value={employee.exp_month || ""} disabled={!canEdit} onChange={(e) => handleChange("exp_month", Math.min(11, Number(e.target.value)))} />
            </div>
          </div>

          <div className={styles.formRow}>
            <label>Qualification</label>
            <select value={employee.qualification || ""} disabled={!canEdit} onChange={(e) => handleChange("qualification", e.target.value)}>
              <option value="">Select</option>
              <option>SSLC</option>
              <option>HSC</option>
              <option>DIPLOMA</option>
              <option>UG</option>
              <option>PG</option>
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Password</label>
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Leave blank to keep existing"
                className={`${styles.passwordInput} ${passwordError ? styles.passwordError : employee.password ? styles.passwordSuccess : ""}`}
                value={employee.password || ""}
                disabled={!canEdit}
                onChange={(e) => {
                  handleChange("password", e.target.value);
                  validatePassword(e.target.value);
                }}
              />
              {canEdit && (
                <span className={styles.passwordToggle} onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "Hide" : "Show"}
                </span>
              )}
            </div>
            <div className={styles.passwordHint}>Min 8 chars with Upper, Lower, Number &amp; Special char</div>
            {passwordError && <div className={styles.passwordErrorText}>{passwordError}</div>}
          </div>

          <div className={styles.formRow}>
            <label>Permanent Address</label>
            <textarea value={employee.permanent_address || ""} disabled={!canEdit} onChange={(e) => handleChange("permanent_address", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>
              <input
                type="checkbox"
                checked={employee.permanent_address === employee.temporary_address && !!employee.permanent_address}
                disabled={!canEdit}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleChange("same_address", true);
                  } else {
                    setEmployee((prev) => ({ ...prev, same_address: false, temporary_address: "" }));
                  }
                }}
              />
              {" "}Same as Permanent Address
            </label>
          </div>

          <div className={styles.formRow}>
            <label>Temporary Address</label>
            <textarea value={employee.temporary_address || ""} disabled={!canEdit || employee.same_address} onChange={(e) => handleChange("temporary_address", e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Zone</label>
            <select value={employee.zone_id || ""} disabled={!canEdit} onChange={(e) => handleChange("zone_id", e.target.value)}>
              <option value="">Select Zone</option>
              {zones.map((z) => (
                <option key={z.zone_id ?? z.id} value={String(z.zone_id ?? z.id)}>{z.name ?? z.zone_name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Primary Branch</label>
            <select value={employee.primary_branch_id || ""} disabled={!canEdit} onChange={(e) => handleChange("primary_branch_id", e.target.value)}>
              <option value="">Select Branch</option>
              {branchesInZone.map((b) => (
                <option key={b.branch_id} value={String(b.branch_id)}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <label>CRM Branch Access</label>
            <select multiple className={styles.multiSelect} value={employee.crm_branch_ids || []} disabled={!canEdit} onChange={(e) => handleChange("crm_branch_ids", Array.from(e.target.selectedOptions, (o) => o.value))}>
              {employee.zone_id === "" ? (
                <option disabled>Select Zone first</option>
              ) : branchesInZone.length === 0 ? (
                <option disabled>No branches in this zone</option>
              ) : (
                branchesInZone.map((b) => <option key={b.branch_id} value={String(b.branch_id)}>{b.name}</option>)
              )}
            </select>
            {selectedCrmBranches.length > 0 && <div className={styles.selectionText}>Selected: {selectedCrmBranches.join(", ")}</div>}
          </div>

          <div className={styles.formRow}>
            <label>Ticket / Lead Branch Access</label>
            <select multiple className={styles.multiSelect} value={employee.ticket_branch_ids || []} disabled={!canEdit} onChange={(e) => handleChange("ticket_branch_ids", Array.from(e.target.selectedOptions, (o) => o.value))}>
              {branches.map((b) => <option key={b.branch_id} value={String(b.branch_id)}>{b.name}</option>)}
            </select>
            {selectedTicketBranches.length > 0 && <div className={styles.selectionText}>Selected: {selectedTicketBranches.join(", ")}</div>}
          </div>

          <div className={styles.formRow}>
            <label>ERP Area Access</label>
            <select multiple className={styles.multiSelect} value={employee.area_ids || []} disabled={!canEdit} onChange={(e) => handleChange("area_ids", Array.from(e.target.selectedOptions, (o) => o.value))}>
              {!employee.primary_branch_id ? (
                <option disabled>Select Primary Branch first</option>
              ) : areas.length === 0 ? (
                <option disabled>No areas available</option>
              ) : (
                areas.map((a) => <option key={a.id} value={String(a.id)}>{a.area_name}</option>)
              )}
            </select>
            {selectedAreas.length > 0 && <div className={styles.selectionText}>Selected: {selectedAreas.join(", ")}</div>}
          </div>

          <div className={styles.formRow}>
            <label>Additional Branches</label>
            <select multiple className={styles.multiSelect} value={employee.branch_ids || []} disabled={!canEdit} onChange={(e) => handleChange("branch_ids", Array.from(e.target.selectedOptions, (o) => o.value))}>
              {branches.map((b) => <option key={b.branch_id} value={String(b.branch_id)}>{b.name}</option>)}
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Team</label>
            <select value={employee.team_id || ""} disabled={!canEdit} onChange={(e) => handleChange("team_id", e.target.value)}>
              <option value="">Select Team</option>
              {teams.map((t) => <option key={t.team_id ?? t.id} value={String(t.team_id ?? t.id)}>{t.name ?? t.team_name}</option>)}
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Designation</label>
            <select value={employee.designation_id || ""} disabled={!canEdit || !employee.team_id} onChange={(e) => handleChange("designation_id", e.target.value)}>
              <option value="">Select Designation</option>
              {designations.map((d) => <option key={d.designation_id ?? d.id} value={String(d.designation_id ?? d.id)}>{d.name ?? d.designation_name}</option>)}
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Reporting Manager</label>
            <select value={employee.manager_id || ""} disabled={!canEdit || !employee.designation_id} onChange={(e) => handleChange("manager_id", e.target.value || null)}>
              <option value="">No Manager</option>
              {managers.map((m) => (
                <option key={m.id ?? m.emp_id} value={String(m.id ?? m.emp_id)}>
                  {m.name} {m.designation_name ? `- ${m.designation_name}` : ""}{m.zone_name ? ` (${m.zone_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <label>System Role</label>
            <select value={employee.role || ""} disabled={!canEditRole} onChange={(e) => handleChange("role", e.target.value)}>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className={styles.formRow}>
            <label>Status</label>
            <select value={employee.status || ""} disabled={!canEditStatus} onChange={(e) => handleChange("status", e.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
              <option value="RELIEVED">RELIEVED</option>
            </select>
          </div>

          {canEdit && (
            <button className={styles.btnPrimary} onClick={handleUpdate}>
              Update Employee
            </button>
          )}
        </>
      )}
    </div>
  );
}
