// frontend/src/components/NewTicket.jsx

import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "../../../css/tickets/NewTicket.module.css";
//import Layout from "../layouts/Layout";
import {
  getBranches,
  getTeams,
  getMembers,
  getSubtypes,
  getTicketTypes,
  createTicket
} from "../../../services/ticketService";

const PRIORITY_HOURS = {
  High: 4,
  Medium: 8,
  Low: 12
};

const toDateTimeLocalValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDueDateByPriority = (priority) => {
  const nextDate = new Date();
  const hoursToAdd = PRIORITY_HOURS[priority] ?? PRIORITY_HOURS.Low;
  nextDate.setMinutes(0, 0, 0);
  nextDate.setHours(nextDate.getHours() + hoursToAdd);
  return toDateTimeLocalValue(nextDate);
};

const formatDateTime12Hour = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

const NewTicket = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    type_of_ticket: "",
    subtype_of_ticket: "",
    priority: "Low",
    due_date: getDueDateByPriority("Low"),
    branch_id: "",
    assign_team: "",
    assigned_to: "",
    customer_id: "",
    customer_name: "",
    reporter_name: "",
    landmark: "",
    address: "",
    contact_number1: "",
    contact_number2: "",
    more_details: "",
    status: "Opened"
  });
  const [issueSnapshot, setIssueSnapshot] = useState(null);

  const [subtypes, setSubtypes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);

  const [createdDate, setCreatedDate] = useState(new Date());

  /* ================= LOAD MASTER ================= */

  const loadMaster = useCallback(async () => {
    try {
      const [b, t, types] = await Promise.all([
        getBranches(),
        getTeams(),
        getTicketTypes()
      ]);

      setBranches(b.data || []);
      setTeams(t.data || []);
      setTicketTypes(types.data || []);
    } catch (err) {
      toast.error("Failed to load master data");
    }
  }, []);

  useEffect(() => {
    loadMaster();
  }, [loadMaster]);

  useEffect(() => {
    if (!form.type_of_ticket) {
      setSubtypes([]);
      setForm(prev => ({ ...prev, subtype_of_ticket: "" }));
      return;
    }

    const runLoadSubtypes = async () => {
      try {
        const res = await getSubtypes(form.type_of_ticket);
        setSubtypes(res.data || []);
      } catch {
        toast.error("Failed to load subtypes");
      }
    };

    runLoadSubtypes();
  }, [form.type_of_ticket]);
  /* ================= LIVE TIME ================= */

  useEffect(() => {
    const timer = setInterval(() => {
      setCreatedDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      due_date: getDueDateByPriority(prev.priority)
    }));
  }, [form.priority]);

  /* ================= MEMBERS ================= */

  useEffect(() => {
    if (!form.branch_id || !form.assign_team) {
      setMembers([]);
      return;
    }

    const runLoadMembers = async () => {
      try {
        const res = await getMembers(form.branch_id, form.assign_team, {
          context: "new-ticket"
        });
        setMembers(res.data || []);
      } catch {
        toast.error("Failed to load employees");
      }
    };

    runLoadMembers();
  }, [form.branch_id, form.assign_team]);

  /* ================= CHANGE ================= */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSnapshotChange = (e) => {
    setIssueSnapshot(e.target.files?.[0] || null);
  };

  /* ================= VALIDATION ================= */

  const validateForm = () => {
    if (!form.type_of_ticket) return "Ticket type required";
    if (!form.subtype_of_ticket) return "Ticket subtype required";
    if (!form.due_date) return "Due date required";
    if (!form.branch_id) return "Branch required";
    if (!form.assign_team) return "Team required";
    if (!form.assigned_to) return "Employee required";
    if (!form.customer_id) return "Customer ID required";
    if (!form.customer_name) return "Customer required";
    if (!form.address) return "Address required";
    if (!form.contact_number1) return "Contact required";
    if (!form.more_details) return "More details required";
    return null;
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validateForm();
    if (error) return toast.error(error);

    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        data.append(key, value ?? "");
      });
      if (issueSnapshot) {
        data.append("issue_snapshot", issueSnapshot);
      }

      const res = await createTicket(data);

      toast.success(`Ticket Created: ${res.data.ticket_id}`);

      resetForm();

    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  /* ================= RESET ================= */

  const resetForm = () => {
    setForm({
      type_of_ticket: "",
      subtype_of_ticket: "",
      priority: "Low",
      due_date: getDueDateByPriority("Low"),
      branch_id: "",
      assign_team: "",
      assigned_to: "",
      customer_id: "",
      customer_name: "",
      reporter_name: "",
      landmark: "",
      address: "",
      contact_number1: "",
      contact_number2: "",
      more_details: "",
      status: "Opened"
    });
    setIssueSnapshot(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const formattedCreatedDate = createdDate.toLocaleString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  /* ---------------------------------------------------
     UI
  --------------------------------------------------- */

  return (

    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.topNavBtn}
            onClick={() => navigate("/tickets/open")}
          >
            Opened Tickets
          </button>
          <h2 className={styles.title}>Create New Ticket</h2>
          <div className={styles.headerSpacer} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Ticket Type */}
          <div className={styles.group}>
            <label>Ticket Type *</label>

            <select
              name="type_of_ticket"
              value={form.type_of_ticket}
              onChange={handleChange}
            >

              <option value="">Select Type</option>

              {ticketTypes.map(t => (
                <option key={t.type_id} value={t.type_id}>
                  {t.name}
                </option>
              ))}

            </select>
          </div>

          <div className={styles.group}>
            <label>Subtype *</label>

            <select
              name="subtype_of_ticket"
              value={form.subtype_of_ticket || ""}
              onChange={handleChange}
              disabled={!form.type_of_ticket}
            >
              <option value="">Select Subtype</option>

              {subtypes.map(s => (
                <option key={s.subtype_id} value={s.subtype_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className={styles.group}>
            <label>Priority *</label>

            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>

          {/* Due Date */}
          <div className={styles.group}>
            <label>Due Date *</label>

            <input
              type="text"
              value={formatDateTime12Hour(form.due_date)}
              readOnly
              className={styles.readonly}
            />
          </div>

          {/* Created Date */}
          <div className={styles.group}>
            <label>Created Date</label>
            <input
              type="text"
              value={formattedCreatedDate}
              readOnly
              className={styles.readonly}
            />
          </div>

          {/* Branch */}
          <div className={styles.group}>
            <label>Branch *</label>

            <select
              name="branch_id"
              value={form.branch_id}
              onChange={handleChange}
            >

              <option value="">Select Branch</option>

              {branches.map(b => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.name}
                </option>
              ))}

            </select>
          </div>

          {/* Team */}
          <div className={styles.group}>
            <label>Assign Team *</label>

            <select
              name="assign_team"
              value={form.assign_team}
              onChange={handleChange}
              disabled={!form.branch_id}
            >

              <option value="">Select Team</option>

              {teams.map(t => (
                <option key={t.team_id} value={t.team_id}>
                  {t.name}
                </option>
              ))}

            </select>

          </div>

          {/* Employee */}
          <div className={styles.group}>
            <label>Assign To *</label>

            <select
              name="assigned_to"
              value={form.assigned_to}
              onChange={handleChange}
              disabled={!form.assign_team}
            >

              <option value="">Select Employee</option>

              {members.map(m => (
                <option key={m.emp_id} value={m.emp_id}>
                  {m.name} ({m.emp_id})
                </option>
              ))}

            </select>

          </div>

          <div className={styles.group}>
            <label>Issue Snapshot</label>

            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleSnapshotChange}
            />

            {issueSnapshot && (
              <small className={styles.fileHint}>
                Selected: {issueSnapshot.name}
              </small>
            )}
          </div>

          <div className={styles.group}>
            <label>Customer ID *</label>

            <input
              type="text"
              name="customer_id"
              value={form.customer_id}
              onChange={handleChange}
              placeholder="Enter Customer ID"
            />
          </div>

          {/* Customer */}
          <div className={styles.group}>
            <label>Customer Name *</label>

            <input
              type="text"
              name="customer_name"
              value={form.customer_name}
              onChange={handleChange}
            />

          </div>

          {/* Reporter */}
          <div className={styles.group}>
            <label>Reporter Name</label>

            <input
              type="text"
              name="reporter_name"
              value={form.reporter_name}
              onChange={handleChange}
            />

          </div>

          {/* Landmark */}
          <div className={styles.group}>
            <label>Landmark</label>

            <input
              type="text"
              name="landmark"
              value={form.landmark}
              onChange={handleChange}
            />

          </div>

          {/* Contact */}
          <div className={styles.group}>
            <label>Contact Number *</label>

            <input
              type="tel"
              name="contact_number1"
              value={form.contact_number1}
              onChange={handleChange}
            />

          </div>

          {/* Alternate */}
          <div className={styles.group}>
            <label>Alternate Contact</label>

            <input
              type="tel"
              name="contact_number2"
              value={form.contact_number2}
              onChange={handleChange}
            />

          </div>

          {/* Address */}
          <div className={`${styles.group} ${styles.full}`}>
            <label>Address *</label>

            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
            />

          </div>

          {/* Details */}
          <div className={`${styles.group} ${styles.full}`}>
            <label>More Details *</label>

            <textarea
              name="more_details"
              value={form.more_details}
              onChange={handleChange}
            />

          </div>

          {/* Submit */}
          <button
            type="submit"
            className={`${styles.button} ${styles.full}`}
          >

            Create Ticket

          </button>

        </form>

      </div>
    </div>


  );
};

export default NewTicket;
