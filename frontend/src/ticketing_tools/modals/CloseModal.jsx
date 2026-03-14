import React, { useState } from "react";
import Modal from "react-modal";
import { closeTicket } from "../../services/ticketService";
import { toast } from "react-toastify";

Modal.setAppElement("#root");

const CloseModal = ({ open, setOpen, ticketId, refreshTickets }) => {

  const [form, setForm] = useState({
    action_type: "",
    resolved_by: "",
    handled_by: "",
    issue_type: "",
    issue_sub_type: "",
    comments: ""
  });

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

  const handleSubmit = async () => {

    for (let key in form) {
      if (!form[key]) {
        toast.error("Fill all fields");
        return;
      }
    }

    try {

      await closeTicket(ticketId, form);

      toast.success("Ticket closed");

      setOpen(false);

      refreshTickets();

    } catch {

      toast.error("Close failed");

    }
  };

  return (

    <Modal isOpen={open} onRequestClose={() => setOpen(false)}>

      <h2>Close Ticket</h2>

      <select name="action_type" onChange={handleChange}>
        <option value="">Action</option>
        <option value="Issue Resolved">Issue Resolved</option>
        <option value="Duplicate">Duplicate</option>
      </select>

      <input
        name="resolved_by"
        placeholder="Resolved By"
        onChange={handleChange}
      />

      <input
        name="handled_by"
        placeholder="Handled By"
        onChange={handleChange}
      />

      <input
        name="issue_type"
        placeholder="Issue Type"
        onChange={handleChange}
      />

      <input
        name="issue_sub_type"
        placeholder="Issue Sub Type"
        onChange={handleChange}
      />

      <textarea
        name="comments"
        placeholder="Comments"
        onChange={handleChange}
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

export default CloseModal;