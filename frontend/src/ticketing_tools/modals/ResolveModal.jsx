import React, { useState } from "react";
import Modal from "react-modal";
import { resolveTicket } from "../../services/ticketService";
import { toast } from "react-toastify";

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

      await resolveTicket(ticketId, {
        action_type: actionType,
        comments
      });

      toast.success("Ticket resolved");

      setOpen(false);

      refreshTickets();

    } catch {

      toast.error("Resolve failed");

    }
  };

  return (
    <Modal isOpen={open} onRequestClose={() => setOpen(false)}>

      <h2>Resolve Ticket</h2>

      <select
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
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
      />

      <button onClick={handleSubmit}>
        Submit
      </button>

      <button onClick={() => setOpen(false)}>
        Cancel
      </button>

    </Modal>
  );
};

export default ResolveModal;