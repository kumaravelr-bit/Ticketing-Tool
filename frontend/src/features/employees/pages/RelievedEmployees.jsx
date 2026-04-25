import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import styles from "../../../css/employees/RelievedEmployee.module.css";
import useDebouncedValue from "../../../hooks/useDebouncedValue";
import {
  getRelievedEmployees,
  exportRelievedEmployees,
  reactivateEmployee,
  getZones,
  getTeams,
  getAllBranches,
  getDesignations,
} from "../../../services/employeeService";
import { getAuthItem } from "../../../utils/auth";

const CSV_COLUMNS = [
  { key: "emp_id", label: "EMP ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "emergency_contact", label: "Emergency Contact" },
  { key: "gender", label: "Gender" },
  { key: "dob", label: "DOB" },
  { key: "joining_date", label: "Joining Date" },
  { key: "joining_status", label: "Joining Status" },
  { key: "marital_status", label: "Marital Status" },
  { key: "experience", label: "Experience" },
  { key: "qualification", label: "Qualification" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "designation_name", label: "Designation" },
  { key: "team_name", label: "Team" },
  { key: "zone_name", label: "Zone" },
  { key: "branch_name", label: "Branch" },
  { key: "permanent_address", label: "Permanent Address" },
  { key: "temporary_address", label: "Temporary Address" },
  { key: "created_at", label: "Created At" },
];

const PAGE_SIZE = 10;

function formatExportDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).split("T")[0] || "";
  return parsed.toLocaleDateString("en-IN");
}

function normalizeExportRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    dob: formatExportDate(row.dob),
    joining_date: formatExportDate(row.joining_date),
    created_at: formatExportDate(row.created_at),
  }));
}

function downloadCSV(rows, filename) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = CSV_COLUMNS.map((column) => escape(column.label)).join(",");
  const body = rows
    .map((row) => CSV_COLUMNS.map((column) => escape(row[column.key])).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const normalizePagedResponse = (payload) => {
  if (Array.isArray(payload)) {
    return {
      rows: payload,
      meta: {
        page: 1,
        limit: payload.length || PAGE_SIZE,
        total: payload.length,
        totalPages: Math.max(payload.length ? 1 : 0, 1),
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  return {
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
    meta: {
      page: Number(payload?.meta?.page || 1),
      limit: Number(payload?.meta?.limit || PAGE_SIZE),
      total: Number(payload?.meta?.total || 0),
      totalPages: Math.max(Number(payload?.meta?.totalPages || 1), 1),
      hasNextPage: Boolean(payload?.meta?.hasNextPage),
      hasPreviousPage: Boolean(payload?.meta?.hasPreviousPage),
    },
  };
};

export default function RelievedEmployees() {
  const [employees, setEmployees] = useState([]);
  const [allZones, setAllZones] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [allDesignations, setAllDesignations] = useState([]);
  const [filters, setFilters] = useState({
    emp_id: "",
    name: "",
    team: "",
    designation: "",
    zone: "",
    branch: "",
  });
  const debouncedFilters = useDebouncedValue(filters, 250);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const hasLoadedRowsRef = useRef(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const userRole = getAuthItem("role") || "";
  const userTeam = (getAuthItem("team") || "").toUpperCase();
  const canReactivate = ["ADMIN", "SUPER_ADMIN"].includes(userRole) || userTeam === "HRD";

  useEffect(() => {
    let cancelled = false;

    const loadMasters = async () => {
      try {
        const [zonesResponse, teamsResponse, branchesResponse] = await Promise.all([
          getZones(),
          getTeams(),
          getAllBranches(),
        ]);

        if (cancelled) return;

        setAllZones(
          (zonesResponse.data || []).map((item, index) => ({
            id: item.id ?? item.zone_id ?? `z-${index}`,
            zone_name: item.zone_name ?? item.name ?? "Unknown",
          }))
        );
        setAllTeams(
          (teamsResponse.data || []).map((item, index) => ({
            id: item.id ?? item.team_id ?? `t-${index}`,
            team_name: item.team_name ?? item.name ?? "Unknown",
          }))
        );
        setAllBranches(
          (branchesResponse.data || []).map((item, index) => ({
            id: item.id ?? item.branch_id ?? `b-${index}`,
            branch_name: item.branch_name ?? item.name ?? "Unknown",
            zone_id: String(item.zone_id ?? ""),
          }))
        );
      } catch {
        if (!cancelled) toast.error("Failed to load filter data");
      }
    };

    loadMasters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDesignations = async () => {
      if (!filters.team) {
        setAllDesignations([]);
        return;
      }

      try {
        const response = await getDesignations(filters.team);
        if (!cancelled) {
          setAllDesignations(
            (response.data || []).map((item, index) => ({
              id: item.designation_id ?? item.id ?? `d-${index}`,
              name: item.name ?? item.designation_name ?? "Unknown",
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setAllDesignations([]);
          toast.error("Failed to load designations");
        }
      }
    };

    loadDesignations();

    return () => {
      cancelled = true;
    };
  }, [filters.team]);

  useEffect(() => {
    let cancelled = false;

    const loadEmployees = async () => {
      const shouldSoftRefresh = hasLoadedRowsRef.current;

      try {
        if (shouldSoftRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getRelievedEmployees({
          ...debouncedFilters,
          page,
          limit: PAGE_SIZE,
        });

        if (cancelled) return;

        const normalized = normalizePagedResponse(response.data);
        setEmployees(normalized.rows);
        setMeta(normalized.meta);
        hasLoadedRowsRef.current = normalized.rows.length > 0;
      } catch {
        if (!cancelled) toast.error("Failed to load relieved employees");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, page]);

  const branchesForDropdown = useMemo(() => {
    if (!filters.zone) return allBranches;
    return allBranches.filter((branch) => branch.zone_id === String(filters.zone));
  }, [allBranches, filters.zone]);

  const changeFilter = (field, value) => {
    setFilters((previous) => {
      const updated = { ...previous, [field]: value || "" };
      if (field === "zone") updated.branch = "";
      if (field === "team") updated.designation = "";
      return updated;
    });
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({
      emp_id: "",
      name: "",
      team: "",
      designation: "",
      zone: "",
      branch: "",
    });
    setAllDesignations([]);
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await exportRelievedEmployees(filters);
      const rows = normalizeExportRows(response.data || []);
      if (!rows.length) {
        toast.info("No records to export");
        return;
      }
      downloadCSV(rows, `Relieved_Employees_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Exported ${rows.length} records`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleActivate = async () => {
    try {
      await reactivateEmployee(selectedEmp.emp_id);
      toast.success("Employee reactivated");
      setShowModal(false);
      setSelectedEmp(null);
      setPage(1);
      const response = await getRelievedEmployees({
        ...filters,
        page: 1,
        limit: PAGE_SIZE,
      });
      const normalized = normalizePagedResponse(response.data);
      setEmployees(normalized.rows);
      setMeta(normalized.meta);
      hasLoadedRowsRef.current = normalized.rows.length > 0;
    } catch {
      toast.error("Failed to reactivate");
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("en-IN");
    } catch {
      return "-";
    }
  };

  return (
    <div className={styles.pageContainer}>
      <h2>Relieved Employees</h2>

      <div className={styles.filters}>
        <input
          placeholder="EMP ID"
          value={filters.emp_id}
          onChange={(event) => changeFilter("emp_id", event.target.value)}
        />

        <input
          placeholder="Name"
          value={filters.name}
          onChange={(event) => changeFilter("name", event.target.value)}
        />

        <select value={filters.team} onChange={(event) => changeFilter("team", event.target.value)}>
          <option value="">All Teams</option>
          {allTeams.map((team) => (
            <option key={team.id} value={team.id}>{team.team_name}</option>
          ))}
        </select>

        <select
          value={filters.designation}
          onChange={(event) => changeFilter("designation", event.target.value)}
          disabled={!filters.team}
        >
          <option value="">All Designations</option>
          {allDesignations.map((designation) => (
            <option key={designation.id} value={designation.id}>{designation.name}</option>
          ))}
        </select>

        <select value={filters.zone} onChange={(event) => changeFilter("zone", event.target.value)}>
          <option value="">All Zones</option>
          {allZones.map((zone) => (
            <option key={zone.id} value={zone.id}>{zone.zone_name}</option>
          ))}
        </select>

        <select value={filters.branch} onChange={(event) => changeFilter("branch", event.target.value)}>
          <option value="">All Branches</option>
          {branchesForDropdown.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
          ))}
        </select>

        <button onClick={resetFilters}>Reset</button>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: "10px 16px",
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: exporting ? "not-allowed" : "pointer",
            fontWeight: 600,
            opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>EMP ID</th>
              <th>Name</th>
              <th>DOB</th>
              <th>Designation</th>
              <th>Team</th>
              <th>Zone</th>
              <th>Branch</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: "center", padding: 20 }}>Loading...</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: "center", padding: 20 }}>No records found</td></tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee.emp_id}>
                  <td>{employee.emp_id}</td>
                  <td>{employee.name || "-"}</td>
                  <td>{formatDate(employee.dob)}</td>
                  <td>{employee.designation_name || "-"}</td>
                  <td>{employee.team_name || "-"}</td>
                  <td>{employee.zone_name || "-"}</td>
                  <td>{employee.branch_name || "-"}</td>
                  <td>{employee.phone || "-"}</td>
                  <td>
                    {canReactivate ? (
                      <select
                        value={employee.status}
                        onChange={() => {
                          setSelectedEmp(employee);
                          setShowModal(true);
                        }}
                      >
                        <option value="RELIEVED">RELIEVED</option>
                        <option value="DEACTIVATED">DEACTIVATED</option>
                        <option value="ACTIVE">ACTIVE</option>
                      </select>
                    ) : (
                      employee.status
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 16 }}>
        <button disabled={!meta.hasPreviousPage} onClick={() => setPage((current) => current - 1)}>Prev</button>
        <span>Page {meta.page} / {meta.totalPages} | {meta.total} records{refreshing ? " | Refreshing..." : ""}</span>
        <button disabled={!meta.hasNextPage} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Reactivate Employee?</h3>
            <p><strong>{selectedEmp?.name}</strong> ({selectedEmp?.emp_id})</p>
            <p>This will set the employee status back to ACTIVE.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
              <button
                onClick={handleActivate}
                style={{ padding: "8px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                Yes, Reactivate
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: "8px 20px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
