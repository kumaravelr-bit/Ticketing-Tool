import React, { useEffect, useState } from "react";
import { moveTicket, getMembers } from "../services/ticketService";
import styles from "../css/TicketTable.module.css";
import ResolveModal from "./modals/ResolveModal";
import CloseModal from "./modals/CloseModal";
import UpdateModal from "./modals/UpdateModal";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const TicketRow = ({
  ticket,
  teams,
  refreshTickets,
  onTicketClick,
  role,
  isClosedPage
}) => {

  const allowedRoles = ["TEAM_MANAGER", "MANAGEMENT", "ADMIN", "SUPER_ADMIN"];
  const canVerify = allowedRoles.includes(role);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const [employees, setEmployees] = useState([]);

  const [selectedTeam, setSelectedTeam] = useState(ticket.assign_team || "");
  const [selectedEmp, setSelectedEmp] = useState(ticket.assigned_to || "");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingEmp, setPendingEmp] = useState("");
const navigate = useNavigate();
  /* ================= LOAD EMPLOYEES ================= */
  const loadEmployees = async (teamId) => {

    if (!teamId || !ticket.branch_id) {
      setEmployees([]);
      return;
    }

    try {
      const res = await getMembers(ticket.branch_id, teamId);

      console.log("EMP API RAW:", res.data);

const validEmployees = (res.data || []).filter(
  (e) => e.emp_id && typeof e.emp_id === "string"
);

      console.log("VALID EMP:", validEmployees);

      setEmployees(validEmployees);

    } catch (err) {
      console.error(err);
      setEmployees([]);
      toast.error("Failed to load employees");
    }
  };

  useEffect(() => {
    if (selectedTeam) {
      loadEmployees(selectedTeam);
    } else {
      setEmployees([]);
    }
  }, [selectedTeam]);

  /* ================= TEAM CHANGE ================= */
  const handleAssignTeam = async (e) => {

    const teamId = e.target.value;

    setSelectedTeam(teamId);
    setSelectedEmp("");
    setEmployees([]);

    if (teamId) {
      await loadEmployees(teamId);
    }
  };

  /* ================= EMP CHANGE ================= */
const handleAssignEmployee = (e) => {

  const empId = e.target.value;

  console.log("SELECTED EMP:", empId);

  const exists = employees.some(emp => emp.emp_id === empId);

  if (!empId || !exists) {
    toast.error("Invalid employee selection");
    return;
  }

  setSelectedEmp(empId);   // 🔥 IMPORTANT
  setPendingEmp(empId);
  setConfirmOpen(true);
};

  /* ================= CONFIRM MOVE ================= */
  const confirmMoveTicket = async () => {

    try {

      console.log("FINAL MOVE DATA:", {
        team: selectedTeam,
        emp: pendingEmp
      });

      await moveTicket(ticket.ticket_id, {
        new_assigned_team: selectedTeam,
        new_assigned_to: pendingEmp
      });

      toast.success("Ticket moved successfully");

      setSelectedTeam("");
      setSelectedEmp("");
      setEmployees([]);
      setPendingEmp("");

      refreshTickets();

    } catch (err) {

      console.error("MOVE ERROR:", err.response?.data || err);

      toast.error(err.response?.data?.message || "Failed to move ticket");

    }

    setConfirmOpen(false);
  };

  const cancelMove = () => {
    setConfirmOpen(false);
    setPendingEmp("");
  };

  return (
    <>
      {/* ✅ ONLY TR INSIDE TABLE */}
      <tr key={ticket.ticket_id}>

        <td>
          <span
            className={styles.ticketLink}
            onClick={() => navigate(`/tickets/history/${ticket.ticket_id}`)}
          >
            {ticket.ticket_id}
          </span>
        </td>

        <td>{ticket.customer_id || "-"}</td>
        <td>{ticket.customer_name || "-"}</td>
        <td>{new Date(ticket.created_date).toLocaleString()}</td>
        <td>{ticket.reporter_name || "-"}</td>

{!isClosedPage && (
  <td>
    <select
      className={styles.dropdown}
      value={selectedTeam}
      onChange={handleAssignTeam}
    >
      <option value="">Select</option>
      {teams.map((t) => (
        <option key={`team-${t.team_id}`} value={t.team_id}>
          {t.name}
        </option>
      ))}
    </select>
  </td>
)}

{!isClosedPage && (
  <td>
    <select
      className={styles.dropdown}
      value={selectedEmp}
      onChange={handleAssignEmployee}
      disabled={!selectedTeam}
    >
      <option value="">Select</option>
      {employees.map((e) => (
        <option key={e.emp_id} value={e.emp_id}>
          {e.name} ({e.emp_id})
        </option>
      ))}
    </select>
  </td>
)}

        <td>{ticket.status}</td>

<td className={styles.actions}>
  
  {/* ✅ Closed Page → Only Verification */}
  {isClosedPage ? (
    canVerify && (
      <span
        className={`${styles.iconBtn} ${styles.resolve}`}
        onClick={() => console.log("Verify Ticket", ticket.ticket_id)}
      >
        ✔ Verify
      </span>
    )
  ) : (
    /* ✅ Normal Page Actions */
    <>
      <span className={`${styles.iconBtn} ${styles.resolve}`} onClick={() => setResolveOpen(true)}>✔</span>
      <span className={`${styles.iconBtn} ${styles.close}`} onClick={() => setCloseOpen(true)}>✖</span>
      <span className={`${styles.iconBtn} ${styles.update}`} onClick={() => setUpdateOpen(true)}>✎</span>
    </>
  )}

</td>

      </tr>

      {/* ✅ MODALS OUTSIDE TABLE */}
      <ResolveModal open={resolveOpen} setOpen={setResolveOpen} ticketId={ticket.ticket_id} refreshTickets={refreshTickets} />
      <CloseModal open={closeOpen} setOpen={setCloseOpen} ticketId={ticket.ticket_id} refreshTickets={refreshTickets} />
      <UpdateModal open={updateOpen} setOpen={setUpdateOpen} ticketId={ticket.ticket_id} refreshTickets={refreshTickets} />

      {confirmOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3>Confirm Ticket Move</h3>
            <p>Are you sure you want to move this ticket?</p>

            <div className={styles.modalActions}>
              <button onClick={confirmMoveTicket}>Yes</button>
              <button onClick={cancelMove}>No</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TicketRow;