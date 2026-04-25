import { useEffect, useMemo, useState } from "react";
import styles from "../../../css/masters/ItemMaster.module.css";
import * as masterService from "../../../services/masterServices";
import EmployeeBulkUpload from "./EmployeeBulkUpload";
import { toast } from "react-toastify";

const toNumber = (value) => (value === "" || value === null || value === undefined ? "" : Number(value));

const initialForm = {
  child_designation_id: "",
  parent_designation_id: "",
  scope_type: "TEAM",
  is_active: true,
};

export default function ManagerMappingMaster({ isOpen, onToggle, showToast }) {
  const [rules, setRules] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filters, setFilters] = useState({
    team: "",
    childDesignation: "",
    parentDesignation: "",
    scope: "",
    search: "",
  });

  const designationOptions = useMemo(
    () =>
      (Array.isArray(designations) ? designations : []).map((row) => ({
        id: row.designation_id,
        teamId: row.team_id,
        teamName: row.team_name,
        level: Number(row.level) || 0,
        label: `${row.team_name} - ${row.name} (L${row.level})`,
      })),
    [designations]
  );

  const selectedChild = useMemo(
    () => designationOptions.find((option) => Number(option.id) === Number(form.child_designation_id)) || null,
    [designationOptions, form.child_designation_id]
  );

  const teamOptions = useMemo(() => {
    const seen = new Map();
    designationOptions.forEach((option) => {
      if (!seen.has(option.teamId)) {
        seen.set(option.teamId, {
          id: option.teamId,
          label: option.teamName,
        });
      }
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [designationOptions]);

  const parentOptions = useMemo(() => {
    if (!selectedChild) {
      return designationOptions
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    return designationOptions
      .filter((option) => Number(option.id) !== Number(selectedChild.id))
      .sort((a, b) => {
        const aSameTeam = a.teamId === selectedChild.teamId ? 1 : 0;
        const bSameTeam = b.teamId === selectedChild.teamId ? 1 : 0;
        if (aSameTeam !== bSameTeam) return bSameTeam - aSameTeam;

        const aHigherLevel = a.level > selectedChild.level ? 1 : 0;
        const bHigherLevel = b.level > selectedChild.level ? 1 : 0;
        if (aHigherLevel !== bHigherLevel) return bHigherLevel - aHigherLevel;

        if (a.level !== b.level) return a.level - b.level;
        return a.label.localeCompare(b.label);
      });
  }, [designationOptions, selectedChild]);

  const scopeLabel = (rule) => {
    if (Number(rule.same_branch_only) === 1) return "Branch";
    if (Number(rule.same_zone_only) === 1) return "Zone";
    if (Number(rule.same_team_only) === 1) return "Team";
    return "Global";
  };

  const filteredRules = useMemo(() => {
    const searchText = String(filters.search || "").trim().toLowerCase();

    return rules.filter((rule) => {
      const ruleScope = scopeLabel(rule).toUpperCase();
      const matchesTeam =
        !filters.team || String(rule.child_team_name || "").toUpperCase() === String(filters.team).toUpperCase();
      const matchesChild =
        !filters.childDesignation || Number(rule.child_designation_id) === Number(filters.childDesignation);
      const matchesParent =
        !filters.parentDesignation || Number(rule.parent_designation_id) === Number(filters.parentDesignation);
      const matchesScope = !filters.scope || ruleScope === String(filters.scope).toUpperCase();
      const matchesSearch =
        !searchText ||
        [
          rule.child_team_name,
          rule.child_designation_name,
          rule.parent_team_name,
          rule.parent_designation_name,
          ruleScope,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchText));

      return matchesTeam && matchesChild && matchesParent && matchesScope && matchesSearch;
    });
  }, [filters, rules]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [designationRes, rulesRes] = await Promise.all([
        masterService.getAllDesignations(),
        masterService.getDesignationManagerRules(),
      ]);
      setDesignations(designationRes.data || []);
      setRules(rulesRes.data || []);
    } catch (err) {
      console.error("Manager mapping load error:", err);
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
    if (!form.child_designation_id || !form.parent_designation_id) {
      toast.error("Select both child and parent designation");
      return;
    }

    const payload = {
      child_designation_id: Number(form.child_designation_id),
      parent_designation_id: Number(form.parent_designation_id),
      same_team_only: form.scope_type === "TEAM" ? 1 : 0,
      same_branch_only: form.scope_type === "BRANCH" ? 1 : 0,
      same_zone_only: form.scope_type === "ZONE" ? 1 : 0,
      is_active: form.is_active ? 1 : 0,
    };

    if (editId) {
      await masterService.updateDesignationManagerRule(editId, payload);
      showToast?.("Manager Mapping Updated");
    } else {
      await masterService.createDesignationManagerRule(payload);
      showToast?.("Manager Mapping Added");
    }

      await loadData();
      resetForm();
  };

  const resetFilters = () => {
    setFilters({
      team: "",
      childDesignation: "",
      parentDesignation: "",
      scope: "",
      search: "",
    });
  };

  const startEdit = (rule) => {
    setAddMode(false);
    setEditId(rule.id);
    setForm({
      child_designation_id: toNumber(rule.child_designation_id),
      parent_designation_id: toNumber(rule.parent_designation_id),
      scope_type:
        Number(rule.same_branch_only) === 1
          ? "BRANCH"
          : Number(rule.same_zone_only) === 1
            ? "ZONE"
            : Number(rule.same_team_only) === 1
              ? "TEAM"
              : "GLOBAL",
      is_active: Number(rule.is_active) === 1,
    });
  };

  const renderForm = () => (
    <tr>
      <td>
        <select
          value={form.child_designation_id}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              child_designation_id: toNumber(e.target.value),
              parent_designation_id: "",
            }))
          }
        >
          <option value="">Select Child</option>
          {designationOptions.map((option) => (
            <option key={`child-${option.id}`} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={form.parent_designation_id}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, parent_designation_id: toNumber(e.target.value) }))
          }
        >
          <option value="">Select Parent</option>
          {parentOptions.map((option) => (
              <option key={`parent-${option.id}`} value={option.id}>
                {option.label}
              </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={form.scope_type}
          onChange={(e) => setForm((prev) => ({ ...prev, scope_type: e.target.value }))}
        >
          <option value="TEAM">Team</option>
          <option value="BRANCH">Branch</option>
          <option value="ZONE">Zone</option>
          <option value="GLOBAL">Global</option>
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
        <h3>Manager Mapping</h3>
        <div className={styles.headerActions}>
          <EmployeeBulkUpload
            triggerLabel="Bulk Upload"
            modalTitle="Bulk Upload Manager Mapping"
            note="Upload `.csv`, `.xlsx`, or `.xls`. Use child and parent designation with team names when the same designation exists in multiple teams. Scope type supports `TEAM`, `BRANCH`, `ZONE`, or `GLOBAL`."
            templateFields={["child_team", "child_designation", "parent_team", "parent_designation", "scope_type", "is_active"]}
            templateFileName="manager-mapping-bulk-upload-template.csv"
            errorReportFileName="manager-mapping-bulk-upload-errors.csv"
            downloadTemplate={masterService.downloadManagerMappingBulkTemplate}
            uploadAction={masterService.bulkUploadManagerMappings}
            insertedColumns={[
              { key: "row_number", label: "Row" },
              { key: "child_team", label: "Child Team" },
              { key: "child_designation", label: "Child Designation" },
              { key: "parent_team", label: "Parent Team" },
              { key: "parent_designation", label: "Parent Designation" },
              { key: "scope_type", label: "Scope" },
              { key: "is_active", label: "Status" },
            ]}
            failedColumns={[
              { key: "row_number", label: "Row" },
              { key: "child_team", label: "Child Team" },
              { key: "child_designation", label: "Child Designation" },
              { key: "parent_team", label: "Parent Team" },
              { key: "parent_designation", label: "Parent Designation" },
              { key: "scope_type", label: "Scope" },
              { key: "error", label: "Error" },
            ]}
            onUploaded={() => {
              loadData();
              showToast?.("Manager Mapping bulk upload completed");
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
            <strong>Simple use:</strong> Choose the employee designation in <strong>Child Designation</strong>,
            choose the required higher post in <strong>Parent Designation</strong>, then choose one scope.
            Use <strong>Branch</strong> for Branch Incharge level, <strong>Zone</strong> for Tech Lead / ASM level,
            <strong>Team</strong> for department managers, and <strong>Global</strong> for CTO / CMO / CEO / MD.
          </div>

          <div className={styles.mappingFilterBar}>
            <select
              value={filters.team}
              onChange={(e) => setFilters((prev) => ({ ...prev, team: e.target.value }))}
            >
              <option value="">All Teams</option>
              {teamOptions.map((team) => (
                <option key={`team-filter-${team.id}`} value={team.label}>
                  {team.label}
                </option>
              ))}
            </select>

            <select
              value={filters.childDesignation}
              onChange={(e) => setFilters((prev) => ({ ...prev, childDesignation: e.target.value }))}
            >
              <option value="">All Child Designations</option>
              {designationOptions.map((option) => (
                <option key={`child-filter-${option.id}`} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.parentDesignation}
              onChange={(e) => setFilters((prev) => ({ ...prev, parentDesignation: e.target.value }))}
            >
              <option value="">All Parent Designations</option>
              {designationOptions.map((option) => (
                <option key={`parent-filter-${option.id}`} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.scope}
              onChange={(e) => setFilters((prev) => ({ ...prev, scope: e.target.value }))}
            >
              <option value="">All Scopes</option>
              <option value="TEAM">Team</option>
              <option value="BRANCH">Branch</option>
              <option value="ZONE">Zone</option>
              <option value="GLOBAL">Global</option>
            </select>

            <input
              type="text"
              placeholder="Search mapping"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />

            <button
              type="button"
              className={styles.bulkTrigger}
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Child Designation</th>
                <th>Parent Designation</th>
                <th>Scope Rules</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(addMode || editId) && renderForm()}

              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center" }}>Loading...</td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center" }}>No Mapping Available</td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.child_team_name} - {rule.child_designation_name} (L{rule.child_level})</td>
                    <td>{rule.parent_team_name} - {rule.parent_designation_name} (L{rule.parent_level})</td>
                    <td>{scopeLabel(rule)}</td>
                    <td>{Number(rule.is_active) === 1 ? "Active" : "Inactive"}</td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(rule);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await masterService.deleteDesignationManagerRule(rule.id);
                          showToast?.("Manager Mapping Deleted");
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
