import React from "react";
import TicketRow from "./TicketRow";
import styles from "../../../css/tickets/TicketTable.module.css";

const TicketTable = ({
  tickets,
  teams,
  refreshTickets,
  onTicketClick,
  onSort,
  role,
  isClosedPage,
  showActionsColumn = true
}) => {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.ticketTable}>
        <thead>
          <tr>
            <th onClick={() => onSort("ticket_id")}>Ticket ID</th>
            <th onClick={() => onSort("customer_id")}>Customer ID</th>
            <th>Customer Name</th>
            <th onClick={() => onSort("created_date")}>Raised Date</th>
            <th>Raised By</th>
            {!isClosedPage && <th>Assign Team</th>}
            {!isClosedPage && <th>Assign To</th>}
            <th>Status</th>
            {showActionsColumn && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {tickets.length === 0 && (
            <tr>
              <td
                colSpan={showActionsColumn ? (isClosedPage ? 7 : 9) : (isClosedPage ? 6 : 8)}
                className={styles.noTickets}
              >
                No tickets found
              </td>
            </tr>
          )}

          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.ticket_id}
              ticket={ticket}
              teams={teams}
              refreshTickets={refreshTickets}
              onTicketClick={onTicketClick}
              role={role}
              isClosedPage={isClosedPage}
              showActionsColumn={showActionsColumn}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TicketTable;
