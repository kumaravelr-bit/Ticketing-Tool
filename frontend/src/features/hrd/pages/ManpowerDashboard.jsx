import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/ManpowerRequest.module.css";
import useDebouncedValue from "../../../hooks/useDebouncedValue";
import { getZones, getTeams, getAllBranches } from "../../../services/employeeService";
import { getManpowerRequests, getManpowerSummary } from "../../../services/manpowerService";
import { getAuthItem } from "../../../utils/auth";

const EMPTY_SUMMARY = {
  total: 0,
  pending_my_approval: 0,
  approved_flow: 0,
  rejected: 0,
  recruitment: 0,
  closed: 0,
};

const PAGE_SIZE = 10;

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

export default function ManpowerRequest() {
  const navigate = useNavigate();
  const role = (getAuthItem("role") || "").toString().trim().toUpperCase();
  const team = (getAuthItem("team") || "").toString().trim().toUpperCase();
  const designation = (
    getAuthItem("designation_name") ||
    getAuthItem("designation") ||
    ""
  ).toString().trim().toUpperCase();

  const canCreateRequest =
    ["ADMIN", "SUPER_ADMIN"].includes(role) ||
    team === "HRD" ||
    ([
      "ACCOUNTS", "IT", "HRD", "CUSTOMER CARE", "STORE",
      "DESIGNER", "NOC", "TECHOPS", "SERVICE VENDOR", "RETENSION",
      "PURCHASE", "VAS", "ONM", "PROJECT", "MARKETING", "OPERATIONS",
      "SUPPORT", "ADMIN", "COLLECTION", "PROCUREMENT",
      "FEASIBILITY", "QUALITY", "TRAINING", "COMPLIANCE", "FINANCE",
    ].includes(team) && ["ASST MANAGER", "MANAGER"].includes(designation)) ||
    (team === "TECHNICAL" &&
      [
        "ASST BRANCH INCHARGE",
        "BRANCH INCHARGE",
        "ASST TECH LEAD",
        "TECH LEAD",
        "CTO",
      ].includes(designation)) ||
    (team === "SALES" &&
      [
        "ASM",
        "MIS",
        "MIS EXECUTIVE",
        "VENDOR COORDINATOR",
        "VENDOR SALES",
        "SERVICE SUPPORT",
        "CMO",
        "SALES HEAD",
      ].includes(designation));

  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    department: "",
    zone: "",
    branch: "",
  });
  const debouncedFilters = useDebouncedValue(filters, 250);

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
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
  const [summaryLoading, setSummaryLoading] = useState(true);
  const hasLoadedRowsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadLookups = async () => {
      try {
        const [zonesResponse, teamsResponse, branchesResponse] = await Promise.all([
          getZones(),
          getTeams(),
          getAllBranches(),
        ]);

        if (cancelled) return;

        setZones(zonesResponse.data || []);
        setDepartments(teamsResponse.data || []);
        setBranches(branchesResponse.data || []);
      } catch {
        if (!cancelled) toast.error("Failed to load filter data");
      }
    };

    loadLookups();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        const response = await getManpowerSummary();
        if (!cancelled) {
          setSummary({
            total: response.data?.total || 0,
            pending_my_approval: response.data?.pending_my_approval || 0,
            approved_flow: response.data?.approved_flow || 0,
            rejected: response.data?.rejected || 0,
            recruitment: response.data?.recruitment || 0,
            closed: response.data?.closed || 0,
          });
        }
      } catch {
        if (!cancelled) toast.error("Failed to load summary");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRequests = async () => {
      const shouldSoftRefresh = hasLoadedRowsRef.current;

      try {
        if (shouldSoftRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getManpowerRequests({
          ...debouncedFilters,
          page: currentPage,
          limit: PAGE_SIZE,
        });

        if (cancelled) return;

        const normalized = normalizePagedResponse(response.data);
        setRows(normalized.rows);
        setMeta(normalized.meta);
        hasLoadedRowsRef.current = normalized.rows.length > 0;

        if (normalized.meta.hasNextPage) {
          getManpowerRequests({
            ...debouncedFilters,
            page: currentPage + 1,
            limit: PAGE_SIZE,
          }).catch(() => null);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load requests");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadRequests();

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, currentPage]);

  const branchesForDropdown = useMemo(() => {
    if (!filters.zone) return branches;
    return branches.filter((branch) => String(branch.zone_id) === String(filters.zone));
  }, [branches, filters.zone]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((previous) => {
      const nextFilters = { ...previous, [name]: value };
      if (name === "zone") nextFilters.branch = "";
      return nextFilters;
    });
    setCurrentPage(1);
  };

  const handleReset = () => {
    setFilters({
      search: "",
      status: "",
      department: "",
      zone: "",
      branch: "",
    });
    setCurrentPage(1);
  };

  const getStatusClass = (status) => {
    if (!status) return styles.submitted;
    if (status.includes("Approved")) return styles.approved;
    if (status.includes("Rejected")) return styles.rejected;
    if (status.includes("Progress")) return styles.progress;
    if (status === "Closed") return styles.closed;
    return styles.submitted;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Manpower Request Dashboard</h1>

        {canCreateRequest && (
          <button
            onClick={() => navigate("/hrd/manpower/new")}
            className={styles.primaryBtn}
          >
            + New Request
          </button>
        )}
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}><span>Total</span><h3>{summaryLoading ? "..." : summary.total}</h3></div>
        <div className={styles.statCard}><span>Pending</span><h3>{summaryLoading ? "..." : summary.pending_my_approval}</h3></div>
        <div className={styles.statCard}><span>Approved</span><h3>{summaryLoading ? "..." : summary.approved_flow}</h3></div>
        <div className={styles.statCard}><span>Rejected</span><h3>{summaryLoading ? "..." : summary.rejected}</h3></div>
        <div className={styles.statCard}><span>Recruitment</span><h3>{summaryLoading ? "..." : summary.recruitment}</h3></div>
        <div className={styles.statCard}><span>Closed</span><h3>{summaryLoading ? "..." : summary.closed}</h3></div>
      </div>

      <div className={styles.filters}>
        <input
          name="search"
          placeholder="Search Request / Name / Emp ID"
          value={filters.search}
          onChange={handleFilterChange}
        />

        <select name="zone" value={filters.zone} onChange={handleFilterChange}>
          <option value="">All Zones</option>
          {zones.map((zone) => (
            <option key={zone.zone_id || zone.id} value={zone.name || zone.zone_name}>
              {zone.name || zone.zone_name}
            </option>
          ))}
        </select>

        <select name="branch" value={filters.branch} onChange={handleFilterChange}>
          <option value="">All Branches</option>
          {branchesForDropdown.map((branch) => (
            <option key={branch.branch_id || branch.id} value={branch.name || branch.branch_name}>
              {branch.name || branch.branch_name}
            </option>
          ))}
        </select>

        <select name="department" value={filters.department} onChange={handleFilterChange}>
          <option value="">All Departments</option>
          {departments.map((department) => (
            <option key={department.team_id || department.id} value={department.name || department.team_name}>
              {department.name || department.team_name}
            </option>
          ))}
        </select>

        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">All Status</option>
          <option value="Submitted">Submitted</option>
          <option value="Manager Approved">Manager Approved</option>
          <option value="HRD Approved">HRD Approved</option>
          <option value="Management Approved">Management Approved</option>
          <option value="Manager Rejected">Manager Rejected</option>
          <option value="HRD Rejected">HRD Rejected</option>
          <option value="Management Rejected">Management Rejected</option>
          <option value="Closed">Closed</option>
        </select>

        <button type="button" onClick={handleReset} className={styles.resetBtn}>
          Reset
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Request No</th>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Zone</th>
              <th>Branch</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan="8" className={styles.empty}>Loading...</td></tr>
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.linkCell} onClick={() => navigate(`/hrd/manpower/${row.id}`)}>
                    {row.request_number}
                  </td>
                  <td>{row.employee_emp_id}</td>
                  <td>{row.employee_name}</td>
                  <td>{row.zone}</td>
                  <td>{row.branch}</td>
                  <td>{row.department}</td>
                  <td>{row.designation}</td>
                  <td>
                    <span className={`${styles.status} ${getStatusClass(row.final_status)}`}>
                      {row.final_status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="8" className={styles.empty}>No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button onClick={() => setCurrentPage((page) => page - 1)} disabled={!meta.hasPreviousPage}>
          Prev
        </button>
        <span>
          Page {meta.page} / {meta.totalPages} | {meta.total} records{refreshing ? " | Refreshing..." : ""}
        </span>
        <button onClick={() => setCurrentPage((page) => page + 1)} disabled={!meta.hasNextPage}>
          Next
        </button>
      </div>
    </div>
  );
}
