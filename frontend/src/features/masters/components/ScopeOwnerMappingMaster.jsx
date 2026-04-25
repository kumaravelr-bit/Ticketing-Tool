import { useEffect, useMemo, useState } from "react";
import styles from "../../../css/masters/ItemMaster.module.css";
import * as masterService from "../../../services/masterServices";
import EmployeeBulkUpload from "./EmployeeBulkUpload";

const toNumber = (value) => (value === "" || value === null || value === undefined ? "" : Number(value));

const initialForm = {
  team_id: "",
  zone_id: "",
  branch_id: "",
  designation_id: "",
  employee_id: "",
  is_active: true,
};

export default function ScopeOwnerMappingMaster({ isOpen, onToggle, showToast }) {
  const [mappings, setMappings] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const managerDesignationOptions = useMemo(
    () =>
      (Array.isArray(designations) ? designations : [])
        .map((row) => ({
          id: row.designation_id,
          teamId: row.team_id,
          teamName: row.team_name,
          level: Number(row.level) || 0,
          label: `${row.team_name} - ${row.name} (L${row.level})`,
        })),
    [designations]
  );

  const filteredManagerDesignationOptions = useMemo(
    () =>
      managerDesignationOptions.filter((option) => {
        if (form.team_id && Number(option.teamId) !== Number(form.team_id)) {
          return false;
        }
        return true;
      }).sort((a, b) => a.label.localeCompare(b.label)),
    [form.team_id, managerDesignationOptions]
  );

  const employeeOptions = useMemo(
    () => {
      const source = Array.isArray(employees) ? employees : [];

      const filterRows = ({ strictBranch = true, strictZone = true }) =>
        source.filter((row) => {
          if (form.designation_id && Number(row.designation_id) !== Number(form.designation_id)) {
            return false;
          }
          if (form.team_id && Number(row.team_id) !== Number(form.team_id)) {
            return false;
          }
          if (strictZone && form.zone_id && Number(row.zone_id) !== Number(form.zone_id)) {
            return false;
          }
          if (strictBranch && form.branch_id && Number(row.branch_id) !== Number(form.branch_id)) {
            return false;
          }
          return true;
        });

      let matchedRows = filterRows({ strictBranch: true, strictZone: true });

      // Zone-level posts like Tech Lead / ASM are often not branch-bound.
      if (!matchedRows.length && form.branch_id) {
        matchedRows = filterRows({ strictBranch: false, strictZone: true });
      }

      // Global posts like CTO / CMO / CEO / MD may not be tied to one zone.
      if (!matchedRows.length && form.zone_id) {
        matchedRows = filterRows({ strictBranch: false, strictZone: false });
      }

      return matchedRows.map((row) => ({
        id: row.id,
        label: `${row.emp_id} - ${row.name} (${row.designation_name || "No Designation"})`,
      }));
    },
    [employees, form.branch_id, form.designation_id, form.team_id, form.zone_id]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        mappingRes,
        designationRes,
        employeeRes,
        teamRes,
        zoneRes,
        branchRes,
      ] = await Promise.all([
        masterService.getScopeOwnerMappings(),
        masterService.getAllDesignations(),
        masterService.getScopeOwnerEmployees(),
        masterService.getTeams(),
        masterService.getZones(),
        masterService.getBranches(),
      ]);

      setMappings(mappingRes.data || []);
      setDesignations(designationRes.data || []);
      setEmployees(employeeRes.data || []);
      setTeams(teamRes.data || []);
      setZones(zoneRes.data || []);
      setBranches(branchRes.data || []);
    } catch (err) {
      console.error("Scope owner mapping load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen]);

  const resetForm = () => {
    setForm(initialForm);
    setAddMode(false);
    setEditId(null);
  };

  const handleSubmit = async () => {
    if (!form.designation_id || !form.employee_id) {
      alert("Select both designation and employee");
      return;
    }

    const payload = {
      team_id: form.team_id || null,
      zone_id: form.zone_id || null,
      branch_id: form.branch_id || null,
      designation_id: Number(form.designation_id),
      employee_id: Number(form.employee_id),
      is_active: form.is_active ? 1 : 0,
    };

    if (editId) {
      await masterService.updateScopeOwnerMapping(editId, payload);
      showToast?.("Scope Owner Mapping Updated");
    } else {
      await masterService.createScopeOwnerMapping(payload);
      showToast?.("Scope Owner Mapping Added");
    }

    await loadData();
    resetForm();
  };

  const startEdit = (row) => {
    setAddMode(false);
    setEditId(row.id);
    setForm({
      team_id: toNumber(row.team_id),
      zone_id: toNumber(row.zone_id),
      branch_id: toNumber(row.branch_id),
      designation_id: toNumber(row.designation_id),
      employee_id: toNumber(row.employee_id),
      is_active: Number(row.is_active) === 1,
    });
  };

  const renderForm = () => (
    <tr>
      <td>
        <select
          value={form.team_id}
          onChange={(e) => setForm((prev) => ({ ...prev, team_id: toNumber(e.target.value) }))}
        >
          <option value="">All / Not Required</option>
          {teams.map((team) => (
            <option key={team.team_id || team.id} value={team.team_id || team.id}>
              {team.name || team.team_name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={form.zone_id}
          onChange={(e) => setForm((prev) => ({ ...prev, zone_id: toNumber(e.target.value) }))}
        >
          <option value="">All / Not Required</option>
          {zones.map((zone) => (
            <option key={zone.zone_id || zone.id} value={zone.zone_id || zone.id}>
              {zone.name || zone.zone_name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={form.branch_id}
          onChange={(e) => setForm((prev) => ({ ...prev, branch_id: toNumber(e.target.value) }))}
        >
          <option value="">All / Not Required</option>
          {branches.map((branch) => (
            <option key={branch.branch_id || branch.id} value={branch.branch_id || branch.id}>
              {branch.name || branch.branch_name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={form.designation_id}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              designation_id: toNumber(e.target.value),
              employee_id: "",
            }))
          }
        >
          <option value="">Select Designation</option>
          {filteredManagerDesignationOptions.map((option) => (
            <option key={`scope-designation-${option.id}`} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={form.employee_id}
          onChange={(e) => setForm((prev) => ({ ...prev, employee_id: toNumber(e.target.value) }))}
        >
          <option value="">Select Employee</option>
          {employeeOptions.map((option) => (
            <option key={`scope-employee-${option.id}`} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <label className={styles.mappingCheck}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
          />
          Active
        </label>
      </td>
      <td>
        <button onClick={handleSubmit}>{editId ? "Save" : "Add"}</button>
        <button onClick={resetForm}>Cancel</button>
      </td>
    </tr>
  );

  return (
    <div className={styles.masterBox}>
      <div className={styles.headerRow} onClick={onToggle}>
        <h3>Scope Owner Mapping</h3>
        <div className={styles.headerActions}>
          <EmployeeBulkUpload
            triggerLabel="Bulk Upload"
            modalTitle="Bulk Upload Scope Owner Mapping"
            note="Upload `.csv`, `.xlsx`, or `.xls`. Team, zone, and branch are optional scope columns. Use employee `emp_id` in `employee_emp_id`, and keep the employee designation matching the selected designation."
            templateFields={["team", "zone", "branch", "designation", "employee_emp_id", "is_active"]}
            templateFileName="scope-owner-mapping-bulk-upload-template.csv"
            errorReportFileName="scope-owner-mapping-bulk-upload-errors.csv"
            downloadTemplate={masterService.downloadScopeOwnerMappingBulkTemplate}
            uploadAction={masterService.bulkUploadScopeOwnerMappings}
            insertedColumns={[
              { key: "row_number", label: "Row" },
              { key: "team", label: "Team" },
              { key: "zone", label: "Zone" },
              { key: "branch", label: "Branch" },
              { key: "designation", label: "Designation" },
              { key: "employee_emp_id", label: "Employee" },
              { key: "is_active", label: "Status" },
            ]}
            failedColumns={[
              { key: "row_number", label: "Row" },
              { key: "team", label: "Team" },
              { key: "zone", label: "Zone" },
              { key: "branch", label: "Branch" },
              { key: "designation", label: "Designation" },
              { key: "employee_emp_id", label: "Employee" },
              { key: "error", label: "Error" },
            ]}
            onUploaded={() => {
              loadData();
              showToast?.("Scope Owner Mapping bulk upload completed");
            }}
          />
          <button
            className={styles.addBtn}
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) onToggle();
              setAddMode(true);
              setEditId(null);
              setForm(initialForm);
            }}
          >
            +
          </button>
        </div>
      </div>

      {!isOpen ? null : (
        <>
          <div className={styles.mappingNote}>
            <strong>Simple use:</strong> Choose the scope first, then choose the designation that acts as manager
            in that scope, then choose the exact employee. Example:
            <strong>TECHNICAL + Chennai Zone + Tech Lead + ICEEMP1079</strong>.
            This employee will be used automatically as manager for matching employees.
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Team</th>
                <th>Zone</th>
                <th>Branch</th>
                <th>Manager Designation</th>
                <th>Assigned Employee</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(addMode || editId) && renderForm()}

              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>Loading...</td>
                </tr>
              ) : mappings.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>No Scope Owner Mapping Available</td>
                </tr>
              ) : (
                mappings.map((row) => (
                  <tr key={row.id}>
                    <td>{row.team_name || "All"}</td>
                    <td>{row.zone_name || "All"}</td>
                    <td>{row.branch_name || "All"}</td>
                    <td>{row.designation_name} (L{row.designation_level})</td>
                    <td>{row.emp_id} - {row.employee_name}</td>
                    <td>{Number(row.is_active) === 1 ? "Active" : "Inactive"}</td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(row);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await masterService.deleteScopeOwnerMapping(row.id);
                          showToast?.("Scope Owner Mapping Deleted");
                          loadData();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
