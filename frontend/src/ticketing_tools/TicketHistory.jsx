import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTicketHistory } from "../services/ticketService";
import styles from "../css/TicketHistory.module.css";

export default function TicketHistory() {
  const { ticketId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [ticketId]);

  const loadHistory = async () => {
    try {
      const res = await getTicketHistory(ticketId);

      console.log("FULL RESPONSE:", res);
      console.log("TICKET DATA:", res.data?.ticket);

      setData(res.data);
    } catch (err) {
      console.error("ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!data?.ticket) return <p style={{ padding: 20 }}>No Data Found</p>;

  const t = data.ticket;

  return (
    <div className={styles.ticketHistoryContainer}>

      <button
        className={styles.btnBack}
        onClick={() => navigate("/tickets/open")}
      >
        ← Back
      </button>

      <h2>Ticket Details</h2>

      {/* ================= BASIC ================= */}

      <div className={styles.formRow}>
        <label>Ticket ID</label>
        <input value={t.ticket_id || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Type</label>
        <input value={t.type_name || t.type_of_ticket || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Subtype</label>
        <input value={t.subtype_name || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Priority</label>
        <input value={t.priority || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Status</label>
        <input value={t.status || "-"} disabled />
      </div>

      {/* ================= ASSIGNMENT ================= */}

      <div className={styles.formRow}>
        <label>Branch</label>
        <input value={t.branch_name || t.branch_id || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Team</label>
        <input value={t.team_name || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Assigned To</label>
        <input value={t.assigned_name || t.assigned_to || "-"} disabled />
      </div>

      {/* ================= CUSTOMER ================= */}

      <div className={styles.formRow}>
        <label>Customer Name</label>
        <input value={t.customer_name || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Customer ID</label>
        <input value={t.customer_id || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Reporter</label>
        <input value={t.reporter_name || "-"} disabled />
      </div>

      {/* ================= CONTACT ================= */}

      <div className={styles.formRow}>
        <label>Contact 1</label>
        <input value={t.contact_number1 || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Contact 2</label>
        <input value={t.contact_number2 || "-"} disabled />
      </div>

      {/* ================= ADDRESS ================= */}

      <div className={styles.formRow}>
        <label>Landmark</label>
        <input value={t.landmark || "-"} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Address</label>
        <textarea value={t.address || "-"} disabled />
      </div>

      {/* ================= DATES ================= */}

      <div className={styles.formRow}>
        <label>Due Date</label>
        <input value={formatDate(t.due_date)} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Created Date</label>
        <input value={formatDate(t.created_date)} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Last Updated</label>
        <input value={formatDate(t.updated_at)} disabled />
      </div>

      <div className={styles.formRow}>
        <label>Created By</label>
        <input
          value={`${t.created_by_name || "-"} (${t.created_by || "-"})`}
          disabled
        />
      </div>

      {/* ================= DETAILS ================= */}

      <div className={styles.formRow}>
        <label>More Details</label>
        <textarea value={t.more_details || "-"} disabled />
      </div>

      {/* ================= HISTORY ================= */}

      <h2 style={{ marginTop: "25px" }}>Ticket History</h2>

      <div className={styles.formRow}>
        <label>Ticket Raised</label>
        <textarea
          disabled
          value={`Raised By - ${t.created_by_name || "-"} (${t.created_by || "-"})
Assigned to Team - ${t.team_name || "-"}
at [${formatDate(t.created_date)}]`}
        />
      </div>

      {data.actions?.length > 0 ? (
        data.actions.map((a, index) => (
          <div key={index} className={styles.formRow}>
            <label>{a.action_type}</label>
            <textarea
              disabled
              value={`${a.comments || "-"}

Updated By - ${a.action_by_name || "System"} (${a.action_by || "-"})
at [${formatDate(a.created_at)}]`}
            />
          </div>
        ))
      ) : (
        <div className={styles.formRow}>
          <label>No Actions</label>
          <input value="No history available" disabled />
        </div>
      )}

    </div>
  );
}