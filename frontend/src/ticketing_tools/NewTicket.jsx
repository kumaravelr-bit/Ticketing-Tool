// frontend/src/components/NewTicket.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../services/api";
import styles from "../css/NewTicket.module.css";
//import Layout from "../layouts/Layout";

const NewTicket = () => {
const navigate = useNavigate();

  /* ---------------------------------------------------
     FORM STATE
  --------------------------------------------------- */

  const [form, setForm] = useState({
    type_of_ticket: "",
    priority: "Low",
    due_date: "",
    branch_id: "",
    assign_team: "",
    assigned_to: "",
    customer_name: "",
    reporter_name: "",
    landmark: "",
    address: "",
    contact_number1: "",
    contact_number2: "",
    more_details: "",
    status: "Opened"
  });

  /* ---------------------------------------------------
     MASTER DATA
  --------------------------------------------------- */

  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [createdDate, setCreatedDate] = useState(new Date());

/* ---------------------------------------------------
   INITIAL LOAD
--------------------------------------------------- */

useEffect(() => {
  fetchBranches();
  fetchTeams();
  fetchTicketTypes();
}, []);

/* ---------------------------------------------------
   LIVE CREATED DATE
--------------------------------------------------- */

useEffect(() => {

  const timer = setInterval(() => {
    setCreatedDate(new Date());
  }, 1000);

  return () => clearInterval(timer);

}, []);

/* ---------------------------------------------------
   LOAD EMPLOYEES (Branch + Team)
--------------------------------------------------- */

useEffect(() => {

  if (form.branch_id && form.assign_team) {

    fetchMembers(form.branch_id, form.assign_team);

  } else {

    setMembers([]);

  }

}, [form.branch_id, form.assign_team]);

/* ---------------------------------------------------
   BRANCH CHANGE RESET
--------------------------------------------------- */

useEffect(() => {

  if (!form.branch_id) return;

  setForm(prev => {
    if (prev.assign_team === "" && prev.assigned_to === "") return prev;

    return {
      ...prev,
      assign_team: "",
      assigned_to: ""
    };
  });

  setMembers([]);

}, [form.branch_id]);

/* ---------------------------------------------------
   API CALLS
--------------------------------------------------- */

const fetchBranches = async () => {

  try {

    setLoadingBranches(true);

    const res = await api.get("/others/branches");

    setBranches(res.data || []);

  } catch (err) {

    console.error(err);
    toast.error("Failed to load branches");

  } finally {

    setLoadingBranches(false);

  }

};

const fetchTeams = async () => {

  try {

    setLoadingTeams(true);

    const res = await api.get("/others/teams");

    setTeams(res.data || []);

  } catch (err) {

    toast.error("Failed to load teams");

  } finally {

    setLoadingTeams(false);

  }

};

const fetchMembers = async (branchId, teamId) => {

  try {

    setLoadingMembers(true);

    const res = await api.get(
      `/others/employees/by-branch-team?branch_id=${branchId}&team_id=${teamId}`
    );

    setMembers(res.data || []);

  } catch (err) {

    toast.error("Failed to load employees");

  } finally {

    setLoadingMembers(false);

  }

};

const fetchTicketTypes = async () => {

  try {

    const res = await api.get("/tickets/types");

    setTicketTypes(res.data || []);

  } catch (err) {

    console.error(err);

    toast.error("Failed to load ticket types");

  }

};

  /* ---------------------------------------------------
     FORM CHANGE
  --------------------------------------------------- */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /* ---------------------------------------------------
     VALIDATION
  --------------------------------------------------- */

  const validateForm = () => {

    if (!form.type_of_ticket) return "Ticket type required";
    if (!form.due_date) return "Due date required";
    if (!form.branch_id) return "Branch required";
    if (!form.assign_team) return "Team required";
    if (!form.assigned_to) return "Employee required";
    if (!form.customer_name) return "Customer name required";
    if (!form.reporter_name) return "Reporter name required";
    if (!form.address) return "Address required";
    if (!form.contact_number1) return "Primary contact required";

    return null;

  };

  /* ---------------------------------------------------
     SUBMIT
  --------------------------------------------------- */

const handleSubmit = async (e) => {
  e.preventDefault();

  const error = validateForm();

  if (error) {
    toast.error(error);
    return;
  }

  try {
    const res = await api.post("/tickets", form);

    if (res.data.ticket_id) {
      toast.success(`Ticket Created: ${res.data.ticket_id}`);

      resetForm(); // reset form for new ticket
    } else {
      toast.error("Ticket creation failed");
    }

  } catch (err) {
    toast.error(
      err.response?.data?.message ||
      "Failed to create ticket"
    );
  }
};

  /* ---------------------------------------------------
     RESET
  --------------------------------------------------- */

 const resetForm = () => {
  setForm({
    type_of_ticket: "",
    priority: "Low",
    due_date: "",
    branch_id: "",
    assign_team: "",
    assigned_to: "",
    customer_name: "",
    reporter_name: "",
    landmark: "",
    address: "",
    contact_number1: "",
    contact_number2: "",
    more_details: "",
    status: "Opened"
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
};



  /* ---------------------------------------------------
     DATE FORMAT
  --------------------------------------------------- */

  const formattedCreatedDate = createdDate.toLocaleString();

  /* ---------------------------------------------------
     UI
  --------------------------------------------------- */

  return (

<div className={styles.page}>
<div className={styles.container}>

<h2 className={styles.title}>Create New Ticket</h2>

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
  {t.type_name}
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
type="date"
name="due_date"
value={form.due_date}
min={new Date().toISOString().split("T")[0]}
onChange={handleChange}
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

<option value="">
{loadingBranches ? "Loading..." : "Select Branch"}
</option>

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

<option value="">
{loadingTeams ? "Loading..." : "Select Team"}
</option>

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

<option value="">
{loadingMembers ? "Loading..." : "Select Employee"}
</option>

{members.map(m => (
<option key={m.id} value={m.id}>
{m.name}
</option>
))}

</select>

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
<label>Reporter Name *</label>

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
<label>More Details</label>

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