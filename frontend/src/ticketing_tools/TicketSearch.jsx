import React from "react";
import styles from "../css/SearchTicket.module.css";

const TicketSearch = ({
  branches,
  teams,
  ticketTypes,
  searchParams,
  setSearchParams,
  onSearch
}) => {

  const handleChange = (e) => {

    const { name, value } = e.target;

    setSearchParams((prev) => ({
      ...prev,
      [name]: name === "ticket_no"
        ? value.trim().toUpperCase()
        : value
    }));

  };

  const handleSubmit = (e) => {

    e.preventDefault();
    onSearch();

  };

  return (

<form onSubmit={handleSubmit} className={styles.searchForm}>

<input
className={styles.input}
name="ticket_no"
value={searchParams.ticket_no}
onChange={handleChange}
placeholder="Ticket No"
/>

<input
className={styles.input}
type="date"
name="from_date"
value={searchParams.from_date}
onChange={handleChange}
/>

<input
className={styles.input}
type="date"
name="to_date"
value={searchParams.to_date}
onChange={handleChange}
/>

<input
className={styles.input}
name="name"
value={searchParams.name}
onChange={handleChange}
placeholder="Reporter Name"
/>

<input
className={styles.input}
name="customer_id"
value={searchParams.customer_id}
onChange={handleChange}
placeholder="Customer ID"
/>

<select
className={styles.select}
name="branch"
value={searchParams.branch}
onChange={handleChange}
>
<option value="">Branch</option>

{branches.map((b) => (
<option key={b.branch_id} value={b.branch_id}>
{b.name}
</option>
))}

</select>

<select
className={styles.select}
name="assigned_team"
value={searchParams.assigned_team}
onChange={handleChange}
>
<option value="">Team</option>

{teams.map((t) => (
<option key={t.team_id} value={t.team_id}>
{t.name}
</option>
))}

</select>

<select
className={styles.select}
name="type_of_ticket"
value={searchParams.type_of_ticket}
onChange={handleChange}
>
<option value="">Type</option>

{ticketTypes.map((t) => (
<option key={t.type_id} value={t.type_id}>
{t.type_name}
</option>
))}

</select>

<button type="submit" className={styles.searchButton}>
Search
</button>

</form>

  );
};

export default TicketSearch;