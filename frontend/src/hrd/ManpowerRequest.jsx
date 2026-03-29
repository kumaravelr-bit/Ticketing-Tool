import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import styles from "../css/ManpowerRequest.module.css";

export default function ManpowerRequest() {

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
    department: ""
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [filters]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadSummary = async () => {
    try {
      const res = await api.get("/home-summary");
      setSummary(res.data);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load summary");
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get("/requests", { params: filters });
      setRows(res.data || []);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getStatusClass = (status) => {
    if (status?.includes("Approved")) return styles.approved;
    if (status?.includes("Rejected")) return styles.rejected;
    if (status?.includes("Progress")) return styles.progress;
    if (status === "Closed") return styles.closed;
    return styles.submitted;
  };

  return (
    <div className={styles.container}>

      <h1 className={styles.title}>Manpower Requests</h1>

      {message && <div className={styles.message}>{message}</div>}

      {/* SUMMARY (same but styled like top section) */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}><span>Total</span><h3>{summary.total}</h3></div>
        <div className={styles.statCard}><span>Pending</span><h3>{summary.pending_my_approval}</h3></div>
        <div className={styles.statCard}><span>Approved</span><h3>{summary.approved_flow}</h3></div>
        <div className={styles.statCard}><span>Rejected</span><h3>{summary.rejected}</h3></div>
        <div className={styles.statCard}><span>Recruitment</span><h3>{summary.recruitment}</h3></div>
        <div className={styles.statCard}><span>Closed</span><h3>{summary.closed}</h3></div>
      </div>

      {/* FILTERS (match ClosedTickets style) */}
      <div className={styles.filters}>
        <input
          name="search"
          placeholder="Search..."
          value={filters.search}
          onChange={handleFilterChange}
        />

        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">All Status</option>
          <option value="Submitted">Submitted</option>
          <option value="Manager Approved">Manager Approved</option>
          <option value="Manager Rejected">Manager Rejected</option>
          <option value="HR Approved">HR Approved</option>
          <option value="HR Rejected">HR Rejected</option>
          <option value="Recruitment In Progress">Recruitment</option>
          <option value="Closed">Closed</option>
        </select>

        <input
          name="department"
          placeholder="Department"
          value={filters.department}
          onChange={handleFilterChange}
        />

        <Link to="/hrd/manpower/new" className={styles.primaryBtn}>
          + New Request
        </Link>
      </div>

      {/* TABLE */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Request No</th>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Branch</th>
              <th>Department</th>
              <th>Status</th>
              <th>Open</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan="7" className={styles.empty}>Loading...</td></tr>
            ) : rows.length ? (
              rows.map(row => (
                <tr key={row.id}>
                  <td>{row.request_number}</td>
                  <td>{row.employee_emp_id}</td>
                  <td>{row.employee_name}</td>
                  <td>{row.branch}</td>
                  <td>{row.department}</td>
                  <td>
                    <span className={`${styles.status} ${getStatusClass(row.final_status)}`}>
                      {row.final_status}
                    </span>
                  </td>
                  <td>
                    <Link className={styles.linkBtn} to={`/hrd/manpower/${row.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7" className={styles.empty}>No records</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}