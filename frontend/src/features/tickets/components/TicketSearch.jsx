import React from "react";
import styles from "../../../css/tickets/SearchTicket.module.css";

const TicketSearch = ({
  zones = [],
  branches,
  teams,
  ticketTypes,
  subtypes = [],
  searchParams,
  setSearchParams,
  onExport,
  onReset,
  exportLabel = "Export"
}) => {

  const handleChange = (e) => {

    const { name, value } = e.target;

    setSearchParams((prev) => ({
      ...prev,
      ...(name === "zone" ? { branch: "" } : {}),
      ...(name === "type_of_ticket" ? { subtype_of_ticket: "" } : {}),
      [name]: name === "ticket_no"
        ? value.trim().toUpperCase()
        : value
    }));

  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchForm}>

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
          name="zone"
          value={searchParams.zone || ""}
          onChange={handleChange}
        >
          <option value="">Zone</option>

          {zones.map((zone) => (
            <option key={zone.zone_id ?? zone.id} value={zone.zone_id ?? zone.id}>
              {zone.name || zone.zone_name || "Unknown"}
            </option>
          ))}
        </select>

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
              {t.name || t.type_name || "Unknown"}
            </option>
          ))}

        </select>

        <select
          className={styles.select}
          name="subtype_of_ticket"
          value={searchParams.subtype_of_ticket}
          onChange={handleChange}
          disabled={!searchParams.type_of_ticket}
        >
          <option value="">Subtype</option>

          {subtypes.map((subtype) => (
            <option key={subtype.subtype_id} value={subtype.subtype_id}>
              {subtype.name || subtype.subtype_name || "Unknown"}
            </option>
          ))}
        </select>

        <div className={styles.buttonGroup}>
          {onExport && (
            <button
              type="button"
              className={styles.exportButton}
              onClick={onExport}
            >
              {exportLabel}
            </button>
          )}

          {onReset && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={onReset}
            >
              Reset
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default TicketSearch;
