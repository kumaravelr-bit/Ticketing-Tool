import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { logout } from "../utils/auth";
import { Button } from "@mui/material";
import styles from "../css/Menu.module.css";

export default function Menu() {
  const role = localStorage.getItem("role");
  const location = useLocation();

  const isAdmin =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "IT_ADMIN" ||
    role === "CRM_ADMIN";

  const isUserAccount = role === "USER_ACCOUNT";

  const [open, setOpen] = useState({
    employees: false,
    leads: false,
    feasibility: false,
    installation: false
  });

  const toggle = (key) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className={styles.sidebar}>
      <h2 className={styles.logo}>CRM PANEL</h2>

      {/* DASHBOARD */}
      <Link className={styles.link} to="/dashboard">
        Dashboard
      </Link>

      {/* EMPLOYEES */}
      <div className={styles.menuGroup}>
        <div
          className={styles.menuTitle}
          onClick={() => toggle("employees")}
        >
          Employees
        </div>

        {open.employees && (
          <div className={styles.subMenu}>

            {/* CREATE EMPLOYEE – ONLY ADMIN ROLES */}
            {isAdmin && (
              <Link to="/create">Create Employee</Link>
            )}

            {/* ACTIVE EMPLOYEES – ALL CAN VIEW */}
            <Link to="/active">Active Employees</Link>

            {/* RELIEVED – HIDDEN FROM USER_ACCOUNT */}
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

      {/* LEADS */}
      <div className={styles.menuGroup}>
        <div
          className={styles.menuTitle}
          onClick={() => toggle("leads")}
        >
          Lead
        </div>

        {open.leads && (
          <div className={styles.subMenu}>
            <Link to="/leads/create">Lead Creation</Link>
            <Link to="/leads/list">List of Leads</Link>
          </div>
        )}
      </div>

      {/* FEASIBILITY */}
      <div className={styles.menuGroup}>
        <div
          className={styles.menuTitle}
          onClick={() => toggle("feasibility")}
        >
          Feasibility
        </div>

        {open.feasibility && (
          <div className={styles.subMenu}>
            <Link to="/feasibility-l1">Feasibility L1</Link>
            <Link to="/ov-feasibility">OV Feasibility</Link>
          </div>
        )}
      </div>

      {/* INSTALLATION */}
      <div className={styles.menuGroup}>
        <div
          className={styles.menuTitle}
          onClick={() => toggle("installation")}
        >
          Installation
        </div>

        {open.installation && (
          <div className={styles.subMenu}>
            <Link to="/installation/create">Installation Creation</Link>
            <Link to="/installation/list">Installation List</Link>
          </div>
        )}
      </div>

      {/* OTHER VENDOR */}
      <Link className={styles.link} to="/vendors">
        Other Vendor
      </Link>

      {/* LOGOUT */}
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
