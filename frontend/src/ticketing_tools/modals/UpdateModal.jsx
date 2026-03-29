import React, { useState } from "react";
import Modal from "react-modal";
import { updateTicket } from "../../services/ticketService";
import { toast } from "react-toastify";
import styles from "../../css/TicketModals.module.css";

Modal.setAppElement("#root");

const UpdateModal = ({ open, setOpen, ticketId, refreshTickets }) => {

  const [comments, setComments] = useState("");

const handleSubmit = async () => {

  if (!comments.trim()) {
    toast.error("Enter comments");
    return;
  }

  try {
    await updateTicket(ticketId, { comments });

    toast.success("Ticket updated");

    setComments("");   // 🔥 CLEAR INPUT
    setOpen(false);
    refreshTickets();

  } catch (err) {

    console.error("UPDATE ERROR:", err.response?.data || err);

    toast.error(err.response?.data?.message || "Update failed");
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

      <div className={styles.header}>Update Ticket</div>

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

export default UpdateModal;