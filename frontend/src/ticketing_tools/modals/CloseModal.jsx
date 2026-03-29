import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { closeTicket, getTicketTypes, getSubtypes } from "../../services/ticketService";
import { toast } from "react-toastify";
import styles from "../../css/TicketModals.module.css";

Modal.setAppElement("#root");

const CloseModal = ({ open, setOpen, ticketId, refreshTickets }) => {

  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);

  const [form, setForm] = useState({
    action_type: "Closed", // ✅ FIXED
    resolved_by: "",
    handled_by: "",
    issue_type: "",
    issue_sub_type: "",
    comments: ""
  });

  // ✅ Load Ticket Types
  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const res = await getTicketTypes();
      console.log("TYPES:", res.data);
      setTypes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Load Subtypes based on type
  const fetchSubtypes = async (typeId) => {
    try {
      const res = await getSubtypes(typeId);
      console.log("SUBTYPES:", res.data);
      setSubtypes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({ ...form, [name]: value });

    // ✅ When type changes → load subtype
    if (name === "issue_type") {
      setForm(prev => ({
        ...prev,
        issue_type: value,
        issue_sub_type: "" // reset subtype
      }));
      fetchSubtypes(value);
    }
  };

  const handleSubmit = async () => {

    const { resolved_by, handled_by, issue_type, issue_sub_type, comments } = form;

    if (!resolved_by || !handled_by || !issue_type || !issue_sub_type || !comments) {
      toast.error("Fill all fields");
      return;
    }

    try {
      console.log("CLOSE PAYLOAD:", form);

      await closeTicket(ticketId, form);

      toast.success("Ticket Closed Successfully");
      setOpen(false);
      refreshTickets();

    } catch (err) {
      console.error(err);
      toast.error("Close failed");
    }
  };

  return (
    <Modal
      isOpen={open}
      onRequestClose={() => setOpen(false)}
      className={styles.modal}
      overlayClassName={styles.overlay}
    >
      <div className={styles.header}>Close Ticket</div>

      {/* ✅ ACTION TYPE (READONLY) */}
      <input
        value="Closed"
        disabled
        className={styles.input}
      />

      {/* ✅ RESOLVED BY */}
      <select
        name="resolved_by"
        value={form.resolved_by}
        onChange={handleChange}
        className={styles.select}
      >
        <option value="">Resolved By</option>
        <option value="CC Online">CC Online</option>
        <option value="Branch Online">Branch Online</option>
        <option value="Direct Visit">Direct Visit</option>
      </select>

      {/* ✅ HANDLED BY */}
      <input
        name="handled_by"
        placeholder="Handled By"
        value={form.handled_by}
        onChange={handleChange}
        className={styles.input}
      />

      {/* ✅ ISSUE TYPE */}
      <select
        name="issue_type"
        value={form.issue_type}
        onChange={handleChange}
        className={styles.select}
      >
        <option value="">Select Issue Type</option>
        {types.map(t => (
  <option key={t.type_id} value={t.type_id}>
    {t.type_name || t.type || t.name || "Unknown"}
  </option>
))}
      </select>

      {/* ✅ ISSUE SUBTYPE */}
      <select
        name="issue_sub_type"
        value={form.issue_sub_type}
        onChange={handleChange}
        className={styles.select}
      >
        <option value="">Select Subtype</option>
        {subtypes.map(st => (
  <option key={st.subtype_id} value={st.subtype_id}>
    {st.subtype_name || st.name || "Unknown"}
  </option>
))}
      </select>

      {/* ✅ COMMENTS */}
      <textarea
        name="comments"
        placeholder="Comments"
        value={form.comments}
        onChange={handleChange}
        className={styles.textarea}
      />

      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.primary}`} onClick={handleSubmit}>
          Submit
        </button>
        <button className={`${styles.btn} ${styles.cancel}`} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>

    </Modal>
  );
};

export default CloseModal;