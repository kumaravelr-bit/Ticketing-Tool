import React, { useState } from "react";
import Modal from "react-modal";
import { updateTicket } from "../../services/ticketService";
import { toast } from "react-toastify";

Modal.setAppElement("#root");

const UpdateModal = ({ open, setOpen, ticketId, refreshTickets }) => {

  const [comments, setComments] = useState("");

  const handleSubmit = async () => {

    if (!comments) {

      toast.error("Enter comments");

      return;

    }

    try {

      await updateTicket(ticketId, { comments });

      toast.success("Ticket updated");

      setOpen(false);

      refreshTickets();

    } catch {

      toast.error("Update failed");

    }

  };

  return (

    <Modal isOpen={open} onRequestClose={() => setOpen(false)}>

      <h2>Update Ticket</h2>

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

export default UpdateModal;