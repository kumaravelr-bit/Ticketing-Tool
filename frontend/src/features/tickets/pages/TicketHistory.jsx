import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTicketHistory } from "../../../services/ticketService";
import styles from "../../../css/tickets/TicketHistory.module.css";
import { getAuthItem } from "../../../utils/auth";
import { buildApiUrl, buildAssetUrl } from "../../../config/apiConfig";

export default function TicketHistory() {
  const { ticketId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setErrorMessage("");
      const res = await getTicketHistory(ticketId);

      console.log("FULL RESPONSE:", res);
      console.log("TICKET DATA:", res.data?.ticket);

      setData(res.data);
    } catch (err) {
      console.error("ERROR:", err);
      setData(null);
      setErrorMessage(err.response?.data?.message || "Failed to load ticket history");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("en-IN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const getAttachmentUrl = (filePath) => {
    if (!filePath) return "";
    if (String(filePath).startsWith("http")) return filePath;
    return buildAssetUrl(filePath);
  };

  const getAttachmentDownloadUrl = (attachmentId) =>
    buildApiUrl(`/tickets/attachments/${attachmentId}/download`);

  const handleDownloadAttachment = async (attachment) => {
    try {
      const token = getAuthItem("token");
      const response = await fetch(getAttachmentDownloadUrl(attachment.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error("Failed to download attachment");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.file_name || "ticket-snapshot";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!data?.ticket) return <p style={{ padding: 20 }}>{errorMessage || "No Data Found"}</p>;

  const t = data.ticket;
  const timeline = [
    {
      id: "raised",
      label: "Ticket Raised",
      timestamp: t.created_date,
      text: `Raised By - ${t.created_by_name || "-"} (${t.created_by || "-"})
Assigned to Team - ${t.team_name || "-"} - ${t.initial_assigned_to_name || t.assigned_name || "-"} (${t.initial_assigned_to || t.assigned_to || "-"})
at [${formatDate(t.created_date)}]`
    },
    ...((data.timeline || [])
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((event) => ({
        id: `${event.event_type}-${event.id}`,
        label: event.label || event.event_type,
        timestamp: event.timestamp,
        text: event.text || "-"
      })))
  ];

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

      <div className={styles.formRow}>
        <label>Issue Snapshot</label>
        {data.attachments?.length ? (
          <div className={styles.attachmentList}>
            {data.attachments.map((file) => {
              const fileUrl = getAttachmentUrl(file.file_path);
              return (
                <div key={file.id} className={styles.attachmentCard}>
                  <img
                    src={fileUrl}
                    alt={file.file_name || "Ticket attachment"}
                    className={styles.attachmentPreview}
                  />
                  <div className={styles.attachmentMeta}>
                    <span className={styles.attachmentName}>{file.file_name || "Snapshot"}</span>
                    <span className={styles.attachmentTime}>{formatDate(file.uploaded_at)}</span>
                  </div>
                  <div className={styles.attachmentActions}>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.attachmentBtn}
                    >
                      View Image
                    </a>
                    <button
                      type="button"
                      className={styles.attachmentBtn}
                      onClick={() => handleDownloadAttachment(file)}
                    >
                      Download Image
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <input value="No snapshot uploaded" disabled />
        )}
      </div>

      {/* ================= HISTORY ================= */}

      <h2 style={{ marginTop: "25px" }}>Ticket History</h2>

      {timeline.length > 0 ? (
        timeline.map((event) => (
          <div key={event.id} className={styles.formRow}>
            <label>{event.label}</label>
            <textarea disabled value={event.text} />
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
