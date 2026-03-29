import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import styles from "../css/RequestDetails.module.css";

export default function RequestDetail() {

  const { id } = useParams();

  const [request, setRequest] = useState(null);
  const [logs, setLogs] = useState([]);
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 OPTIONAL: backend can send allowed actions
  const [actions, setActions] = useState({
    manager: false,
    hr: false,
    cto: false
  });

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  async function loadData() {
    try {
      const res = await api.get(`/requests/${id}`);

      setRequest(res.data.request);
      setLogs(res.data.logs || []);

      // 🔥 backend-driven permissions (RECOMMENDED)
      setActions(res.data.actions || {});

    } catch (err) {
      console.error("LOAD ERROR:", err);
      setMessage("Failed to load request");
    }
  }

  async function handleAction(type, action) {
    if (!comments) return setMessage("Comments required");

    try {
      setLoading(true);

      console.log("ACTION API:", `/requests/${id}/${type}-action`, {
        action,
        comments
      });

      await api.put(`/requests/${id}/${type}-action`, {
        action,
        comments
      });

      setMessage(`${type.toUpperCase()} ${action}`);
      setComments("");
      loadData();

    } catch (err) {
      console.error("ACTION ERROR:", err);
      setMessage("Action failed");
    } finally {
      setLoading(false);
    }
  }

  if (!request) {
    return <div className={styles.card}>Loading...</div>;
  }

  return (
    <div className={styles.card}>

      {message && <div className={styles.message}>{message}</div>}

      <h2>Request Detail</h2>

      {/* DETAILS */}
      <div className={styles.grid}>
        <p><b>No:</b> {request.request_number}</p>
        <p><b>Name:</b> {request.employee_name}</p>
        <p><b>Branch:</b> {request.branch}</p>
        <p><b>Dept:</b> {request.department}</p>
        <p><b>Status:</b> {request.final_status}</p>
      </div>

      {/* COMMENTS */}
      <textarea
        className={styles.textarea}
        placeholder="Enter comments..."
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />

      {/* 🔥 ACTION BUTTONS (BASED ON BACKEND) */}
      <div className={styles.btnGroup}>

        {actions.manager && (
          <>
            <button
              disabled={loading}
              onClick={() => handleAction("manager", "Approved")}
              className={styles.approveBtn}
            >
              Manager Approve
            </button>

            <button
              disabled={loading}
              onClick={() => handleAction("manager", "Rejected")}
              className={styles.rejectBtn}
            >
              Manager Reject
            </button>
          </>
        )}

        {actions.hr && (
          <>
            <button
              disabled={loading}
              onClick={() => handleAction("hr", "Approved")}
              className={styles.approveBtn}
            >
              HR Approve
            </button>

            <button
              disabled={loading}
              onClick={() => handleAction("hr", "Rejected")}
              className={styles.rejectBtn}
            >
              HR Reject
            </button>
          </>
        )}

        {actions.cto && (
          <>
            <button
              disabled={loading}
              onClick={() => handleAction("cto", "Approved")}
              className={styles.approveBtn}
            >
              CTO Approve
            </button>

            <button
              disabled={loading}
              onClick={() => handleAction("cto", "Rejected")}
              className={styles.rejectBtn}
            >
              CTO Reject
            </button>
          </>
        )}

      </div>

      {/* LOGS */}
      <h3>Logs</h3>

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
            logs.map(l => (
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
  );
}