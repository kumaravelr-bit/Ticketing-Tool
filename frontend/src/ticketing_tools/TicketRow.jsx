import React, { useState } from "react";
import { moveTicket } from "../services/ticketService";
import styles from "../css/TicketTable.module.css";
import ResolveModal from "./modals/ResolveModal";
import CloseModal from "./modals/CloseModal";
import UpdateModal from "./modals/UpdateModal";

 const TicketRow = ({ ticket, teams, refreshTickets, onTicketClick }) => {

  const [resolveOpen, setResolveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
 
  const handleAssignTeam = async (e) => {

    const team = e.target.value;

    await moveTicket(ticket.ticket_id, {
      new_assigned_team: team,
      new_assigned_to: null
    });

    refreshTickets();
  };

  return (
    <tr>

      <td>

<span
  className={styles.ticketLink}
  onClick={() => onTicketClick(ticket.ticket_id)}
>
  {ticket.ticket_id}
</span>

</td>

      <td>{ticket.customer_name}</td>


      <td>{ticket.type_name}</td>

      <td>{ticket.created_date}</td>

      <td>

        <select
          value={ticket.assign_team || ""}
          onChange={handleAssignTeam}
        >

          <option value="">
            Select
          </option>

          {teams.map((t) => (

            <option key={t.team_id} value={t.team_id}>
              {t.name}
            </option>

          ))}

        </select>

      </td>

      <td>{ticket.assigned_to_name}</td>

      <td>{ticket.status}</td>

      <td>

        <button onClick={() => setResolveOpen(true)}>
          Resolve
        </button>

        <button onClick={() => setCloseOpen(true)}>
          Close
        </button>

        <button onClick={() => setUpdateOpen(true)}>
          Update
        </button>

      </td>

      <ResolveModal
        open={resolveOpen}
        setOpen={setResolveOpen}
        ticketId={ticket.ticket_id}
        refreshTickets={refreshTickets}
      />

      <CloseModal
        open={closeOpen}
        setOpen={setCloseOpen}
        ticketId={ticket.ticket_id}
        refreshTickets={refreshTickets}
      />

      <UpdateModal
        open={updateOpen}
        setOpen={setUpdateOpen}
        ticketId={ticket.ticket_id}
        refreshTickets={refreshTickets}
      />

    </tr>
  );
};

export default TicketRow;