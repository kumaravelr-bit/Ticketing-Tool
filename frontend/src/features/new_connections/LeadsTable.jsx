import React from "react";
import { FiTrash2 } from "react-icons/fi";
import styles from "../../css/new_connections/NewConnectionDashboard.module.css";

function LeadsTable({ rows, loading, onView, onDelete, canDelete = false }) {
  if (loading) {
    return <div className={styles.emptyState}>Loading new connection requests...</div>;
  }

  if (!rows.length) {
    return <div className={styles.emptyState}>No new connection requests found for the current filters.</div>;
  }

  return (
    <div className={styles.tableSection}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
        <thead>
          <tr>
            <th>Request Number</th>
            <th>Customer</th>
            <th>Zone</th>
            <th>Branch</th>
            <th>Connection Branch</th>
            <th>Activity Type</th>
            <th>Status</th>
            {canDelete ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr key={lead.id}>
              <td>
                <button
                  type="button"
                  className={styles.leadLink}
                  onClick={() => onView(lead)}
                >
                  {lead.leadNumber}
                </button>
              </td>
              <td>{lead.customerName}</td>
              <td>{lead.zone}</td>
              <td>{lead.branch}</td>
              <td>{lead.connectionBranch}</td>
              <td>{lead.activityType}</td>
              <td>{lead.status}</td>
              {canDelete ? (
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                      onClick={() => onDelete(lead)}
                      aria-label={`Delete ${lead.leadNumber}`}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeadsTable;
