import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheck, FaPen, FaShieldAlt, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { moveTicket, getMembers, verifyTicket } from "../../../services/ticketService";
import styles from "../../../css/tickets/TicketTable.module.css";
import ResolveModal from "./modals/ResolveModal";
import CloseModal from "./modals/CloseModal";
import UpdateModal from "./modals/UpdateModal";

const TicketRow = ({
  ticket,
  teams,
  refreshTickets,
  role,
  isClosedPage,
  showActionsColumn = true,
}) => {
  const [resolveOpen, setResolveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(ticket.assign_team || "");
  const [selectedEmp, setSelectedEmp] = useState(ticket.assigned_to || "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingEmp, setPendingEmp] = useState("");
  const [verifying, setVerifying] = useState(false);

  const navigate = useNavigate();
  const canVerify = Boolean(ticket.can_verify);
  const verificationLabel = ticket.verification_required_by || "";
  const isVerified = Boolean(ticket.is_verified);

  const loadEmployees = async (teamId) => {
    if (!teamId || !ticket.branch_id) {
      setEmployees([]);
      return;
    }

    try {
      const res = await getMembers(ticket.branch_id, teamId);
      const validEmployees = (res.data || []).filter(
        (employee) => employee.emp_id && typeof employee.emp_id === "string"
      );
      setEmployees(validEmployees);
    } catch (err) {
      console.error(err);
      setEmployees([]);
      toast.error("Failed to load employees");
    }
  };

  useEffect(() => {
    const syncEmployees = async () => {
      if (!selectedTeam || !ticket.branch_id) {
        setEmployees([]);
        return;
      }

      try {
        const res = await getMembers(ticket.branch_id, selectedTeam);
        const validEmployees = (res.data || []).filter(
          (employee) => employee.emp_id && typeof employee.emp_id === "string"
        );
        setEmployees(validEmployees);
      } catch (err) {
        console.error(err);
        setEmployees([]);
        toast.error("Failed to load employees");
      }
    };

    syncEmployees();
  }, [selectedTeam, ticket.branch_id]);

  const handleAssignTeam = async (e) => {
    const teamId = e.target.value;
    setSelectedTeam(teamId);
    setSelectedEmp("");
    setEmployees([]);

    if (teamId) {
      await loadEmployees(teamId);
    }
  };

  const handleAssignEmployee = (e) => {
    const empId = e.target.value;
    const exists = employees.some((emp) => emp.emp_id === empId);

    if (!empId || !exists) {
      toast.error("Invalid employee selection");
      return;
    }

    setSelectedEmp(empId);
    setPendingEmp(empId);
    setConfirmOpen(true);
  };

  const confirmMoveTicket = async () => {
    try {
      await moveTicket(ticket.ticket_id, {
        new_assigned_team: selectedTeam,
        new_assigned_to: pendingEmp,
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

  const handleVerifyTicket = async () => {
    try {
      setVerifying(true);
      await verifyTicket(ticket.ticket_id);
      toast.success("Ticket verified successfully");
      refreshTickets();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to verify ticket");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <tr>
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
        <td>{ticket.created_by_name || ticket.created_by || ticket.reporter_name || "-"}</td>

        {!isClosedPage && (
          <td>
            <select
              className={styles.dropdown}
              value={selectedTeam}
              onChange={handleAssignTeam}
            >
              <option value="">Select</option>
              {teams.map((team) => (
                <option key={`team-${team.team_id}`} value={team.team_id}>
                  {team.name}
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
              {employees.map((employee) => (
                <option key={employee.emp_id} value={employee.emp_id}>
                  {employee.name} ({employee.emp_id})
                </option>
              ))}
            </select>
          </td>
        )}

        <td>{ticket.status}</td>

        {showActionsColumn && (
          <td className={styles.actions}>
            {isClosedPage ? (
              canVerify ? (
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.verifyBtn}`}
                  onClick={handleVerifyTicket}
                  disabled={verifying}
                  title={verificationLabel ? `Required verifier: ${verificationLabel}` : "Verify ticket"}
                  aria-label="Verify ticket"
                >
                  {verifying ? "..." : <FaShieldAlt />}
                </button>
              ) : isVerified ? (
                <span className={`${styles.actionState} ${styles.verifiedState}`}>
                  <span className={styles.actionStateSymbol} aria-hidden="true">&#10004;</span>
                  <span>Verified</span>
                </span>
              ) : (
                FULL_ACTION_PLACEHOLDER(role, ticket)
              )
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.resolve}`}
                  onClick={() => setResolveOpen(true)}
                  title="Resolve ticket"
                  aria-label="Resolve ticket"
                >
                  <FaCheck />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.close}`}
                  onClick={() => setCloseOpen(true)}
                  title="Close ticket"
                  aria-label="Close ticket"
                >
                  <FaTimes />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.update}`}
                  onClick={() => setUpdateOpen(true)}
                  title="Update ticket"
                  aria-label="Update ticket"
                >
                  <FaPen />
                </button>
              </>
            )}
          </td>
        )}
      </tr>

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

      {confirmOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3>Confirm Ticket Move</h3>
            <p>Are you sure you want to move this ticket?</p>

            <div className={styles.modalActions}>
              <button className={styles.confirmBtn} onClick={confirmMoveTicket}>Yes</button>
              <button className={styles.cancelBtn} onClick={() => setConfirmOpen(false)}>No</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const FULL_ACTION_PLACEHOLDER = (role, ticket) => {
  const normalizedRole = String(role || "").toUpperCase();
  if (ticket.is_verified) {
    return (
      <span className={`${styles.actionState} ${styles.verifiedState}`}>
        <span className={styles.actionStateSymbol} aria-hidden="true">&#10004;</span>
        <span>Verified</span>
      </span>
    );
  }

  if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN") {
    return (
      <span className={`${styles.actionState} ${styles.actionMuted}`}>
        No Action
      </span>
    );
  }

  return (
    <span className={`${styles.actionState} ${styles.actionMuted}`}>
      No Action
    </span>
  );
};

export default TicketRow;
