import React, { useState } from "react";
import Modal from "react-modal";
import { resolveTicket } from "../../../../services/ticketService";
import { toast } from "react-toastify";
import styles from "../../../../css/tickets/TicketModals.module.css";

Modal.setAppElement("#root");

const ResolveModal = ({ open, setOpen, ticketId, refreshTickets }) => {

  const [actionType, setActionType] = useState("");
  const [comments, setComments] = useState("");

  const handleSubmit = async () => {

    if (!actionType || !comments) {
      toast.error("Fill all fields");
      return;
    }

    try {
      await resolveTicket(ticketId, { action_type: actionType, comments });
      toast.success("Ticket resolved");
      setOpen(false);
      refreshTickets();
    } catch {
      toast.error("Resolve failed");
    }
  };

  return (
<Modal
  isOpen={open}
  onRequestClose={() => setOpen(false)}
  className={styles.modal}
  overlayClassName={styles.overlay}
  shouldFocusAfterRender={false}
  shouldCloseOnOverlayClick={true}
>

      <div className={styles.header}>Resolve Ticket</div>

      <select
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
        className={styles.select}
      >
        <option value="">Select Action</option>
        <option value="Issue Resolved">Issue Resolved</option>
        <option value="Escalate">Escalate</option>
        <option value="Cannot Reproduce">Cannot Reproduce</option>
      </select>

      <textarea
        placeholder="Comments"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        className={styles.textarea}
      />

      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.primary}`} onClick={handleSubmit}>Submit</button>
        <button className={`${styles.btn} ${styles.cancel}`} onClick={() => setOpen(false)}>Cancel</button>
      </div>

    </Modal>
  );
};

export default ResolveModal;
