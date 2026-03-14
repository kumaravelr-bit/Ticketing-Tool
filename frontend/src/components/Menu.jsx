import { Link } from "react-router-dom";
import { useState } from "react";
import { logout } from "../utils/auth";
import { Button } from "@mui/material";
import styles from "../css/Menu.module.css";

export default function Menu() {

  const role = localStorage.getItem("role");

  const isAdmin =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "IT_ADMIN" ||
    role === "CRM_ADMIN";

  const [open, setOpen] = useState({
    employees: false,
    ticketing: false
  });

  const toggle = (key) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className={styles.sidebar}>
      <h2 className={styles.logo}>CRM PANEL</h2>

      {/* ================= DASHBOARD ================= */}
      <Link className={styles.link} to="/dashboard">
        Dashboard
      </Link>

      {/* ================= EMPLOYEES ================= */}
      <div className={styles.menuGroup}>
        <div
          className={styles.menuTitle}
          onClick={() => toggle("employees")}
        >
          Employees
        </div>

        {open.employees && (
          <div className={styles.subMenu}>

            {/* CREATE EMPLOYEE – ADMIN ONLY */}
            {isAdmin && (
              <Link to="/create">Create Employee</Link>
            )}

            {/* ACTIVE EMPLOYEES */}
            <Link to="/active">Active Employees</Link>

            {/* RELIEVED EMPLOYEES – ADMIN ONLY */}
            {isAdmin && (
              <Link to="/relieved">Relieved Employees</Link>
            )}

            {/* MASTER ITEMS – ADMIN ONLY */}
            {isAdmin && (
              <Link to="/masters">Master Items</Link>
            )}

          </div>
        )}
      </div>

      {/* ================= TICKETING TOOL ================= */}
      <div className={styles.menuGroup}>
        <div
          className={styles.menuTitle}
          onClick={() => toggle("ticketing")}
        >
          Ticketing Tool
        </div>

        {open.ticketing && (
          <div className={styles.subMenu}>
            <Link to="/tickets/create">New Ticket</Link>
            <Link to="/tickets/open">Opened Tickets</Link>
            <Link to="/tickets/closed">Closed Tickets</Link>
          </div>
        )}
      </div>

      {/* ================= LOGOUT ================= */}
      <div className={styles.logout}>
        <Button
          variant="contained"
          color="error"
          size="small"
          onClick={logout}
          fullWidth
        >
          Logout
        </Button>
      </div>
    </div>
  );
}