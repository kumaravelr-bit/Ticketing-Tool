import React from "react";
import TicketRow from "./TicketRow";
import styles from "../css/TicketTable.module.css";

const TicketTable = ({
  tickets,
  teams,
  refreshTickets,
  onTicketClick,
  onSort
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
  <th>Assign Team</th>
  <th>Assign To</th>
  <th>Status</th>
  <th>Actions</th>
</tr>
</thead>

        <tbody>

          {tickets.length === 0 && (
            <tr>
              <td colSpan="8" className={styles.noTickets}>
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
            />

          ))}

        </tbody>

      </table>

    </div>

  );
};

export default TicketTable;