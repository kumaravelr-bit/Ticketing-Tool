import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import styles from "../../../css/hrd/ManpowerRequest.module.css";
import { toast } from "react-toastify";

import {
  getZones,
  getTeams,
  getAllBranches
} from "../../../services/employeeService";

export default function ManpowerRequest() {

  const navigate = useNavigate();

  /* ================= STATES ================= */
  const [summary, setSummary] = useState({
    total: 0,
    pending_my_approval: 0,
    approved_flow: 0,
    rejected: 0,
    recruitment: 0,
    closed: 0
  });

  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    department: "",
    zone: "",
    branch: ""
  });

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  /* ================= PAGINATION ================= */
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  /* ================= LOAD FILTER DATA ================= */
  useEffect(() => {
    loadZones();
    loadDepartments();
    loadBranches();
  }, []);

  const loadZones = async () => {
    try {
      const res = await getZones();
      setZones(res.data || []);
    } catch {
      setZones([]);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await getTeams();
      setDepartments(res.data || []);
    } catch {
      setDepartments([]);
    }
  };

  /* ✅ LOAD ALL BRANCHES */
  const loadBranches = async () => {
    try {
      const res = await getAllBranches();
      setBranches(res.data || []);
    } catch {
      setBranches([]);
    }
  };

  /* ================= LOAD SUMMARY ================= */
  const loadSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await api.get("/manpower/home-summary");

      setSummary({
        total: res.data?.total || 0,
        pending_my_approval: res.data?.pending_my_approval || 0,
        approved_flow: res.data?.approved_flow || 0,
        rejected: res.data?.rejected || 0,
        recruitment: res.data?.recruitment || 0,
        closed: res.data?.closed || 0
      });

    } catch {
      toast.error("Failed to load summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  /* ================= LOAD REQUESTS ================= */
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get("/manpower/requests", {
        params: filters
      });

      setRows(Array.isArray(res.data) ? res.data : []);
      setCurrentPage(1);

    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /* ================= EFFECTS ================= */
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  /* ================= FILTER CHANGE ================= */
  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /* ✅ RESET FILTERS */
  const handleReset = () => {
    setFilters({
      search: "",
      status: "",
      department: "",
      zone: "",
      branch: ""
    });

    setCurrentPage(1);
  };

  /* ================= STATUS ================= */
  const getStatusClass = (status) => {
    if (!status) return styles.submitted;
    if (status.includes("Approved")) return styles.approved;
    if (status.includes("Rejected")) return styles.rejected;
    if (status.includes("Progress")) return styles.progress;
    if (status === "Closed") return styles.closed;
    return styles.submitted;
  };

  /* ================= NAVIGATION ================= */
  const openRequest = (id) => {
    navigate(`/hrd/manpower/${id}`);
  };

  /* ================= PAGINATION ================= */
  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentRows = rows.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(rows.length / rowsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  /* ================= UI ================= */
  return (
    <div className={styles.container}>

      {/* HEADER */}
      <div className={styles.header}>
        <h1 className={styles.title}>Manpower Requests</h1>

        <button
          onClick={() => navigate("/hrd/manpower/new")}
          className={styles.primaryBtn}
        >
          + New Request
        </button>
      </div>

      {/* SUMMARY */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}><span>Total</span><h3>{summaryLoading ? "..." : summary.total}</h3></div>
        <div className={styles.statCard}><span>Pending</span><h3>{summary.pending_my_approval}</h3></div>
        <div className={styles.statCard}><span>Approved</span><h3>{summary.approved_flow}</h3></div>
        <div className={styles.statCard}><span>Rejected</span><h3>{summary.rejected}</h3></div>
        <div className={styles.statCard}><span>Recruitment</span><h3>{summary.recruitment}</h3></div>
        <div className={styles.statCard}><span>Closed</span><h3>{summary.closed}</h3></div>
      </div>

      {/* FILTERS */}
      <div className={styles.filters}>

        <input
          name="search"
          placeholder="Search Request / Name / Emp ID"
          value={filters.search}
          onChange={handleFilterChange}
        />

        <select name="zone" value={filters.zone} onChange={handleFilterChange}>
  <option value="">All Zones</option>
  {zones.map(z => (
    <option key={z.zone_id} value={z.name}>
      {z.name}
    </option>
  ))}
</select>

<select name="branch" value={filters.branch} onChange={handleFilterChange}>
  <option value="">All Branches</option>
  {branches.map(b => (
    <option key={b.branch_id} value={b.name}>
      {b.name}
    </option>
  ))}
</select>

<select name="department" value={filters.department} onChange={handleFilterChange}>
  <option value="">All Departments</option>
  {departments.map(d => (
    <option key={d.team_id} value={d.name}>
      {d.name}
    </option>
  ))}
</select>

        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">All Status</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Closed">Closed</option>
        </select>

        {/* ✅ RESET BUTTON */}
        <button
          type="button"
          onClick={handleReset}
          className={styles.resetBtn}
        >
          Reset
        </button>

      </div>

      {/* TABLE */}
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
            ) : currentRows.length > 0 ? (
              currentRows.map(row => (
                <tr key={row.id}>
                  <td className={styles.linkCell} onClick={() => openRequest(row.id)}>
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

      {/* PAGINATION */}
      <div className={styles.pagination}>
        <button onClick={prevPage} disabled={currentPage === 1}>Prev</button>
        <span>{currentPage}</span>
        <button onClick={nextPage} disabled={currentPage === totalPages}>Next</button>
      </div>

    </div>
  );
}
