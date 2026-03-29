import { Link } from "react-router-dom";
import { useState } from "react";
import { logout } from "../utils/auth";
import { Button } from "@mui/material";
import styles from "../css/Menu.module.css";
import { FaBars, FaUsers, FaTicketAlt, FaSignOutAlt, FaHome, FaUserTie } from "react-icons/fa";

export default function Menu({ collapsed, setCollapsed }) {

  const role = localStorage.getItem("role");

  const isAdmin =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "IT_ADMIN" ||
    role === "CRM_ADMIN";

  const [open, setOpen] = useState({
    employees: false,
    ticketing: false,
    hrd: false
  });

  const toggle = (key) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>

      {/* HAMBURGER when sidebar closed */}
      {collapsed && (
        <div
          className={styles.hamburger}
          onClick={() => setCollapsed(false)}
        >
          <FaBars />
        </div>
      )}

      {/* FULL SIDEBAR */}
      {!collapsed && (
        <>
          <div className={styles.header}>
            <h2 className={styles.logo}>CRM PANEL</h2>

            <div
              className={styles.closeBtn}
              onClick={() => setCollapsed(true)}
            >
              ✕
            </div>
          </div>

          <div className={styles.menuContent}>
            {/* 
<Link className={styles.link} to="/dashboard">
  <FaHome className={styles.icon}/>
  <span>Dashboard</span>
</Link> */}

            {/* EMPLOYEES */}
            <div className={styles.menuGroup}>
              <div
                className={styles.menuTitle}
                onClick={() => toggle("employees")}
              >
                <FaUsers className={styles.icon} />
                <span>Employees</span>
              </div>

              {open.employees && (
                <div className={styles.subMenu}>
                  {isAdmin && <Link to="/create">Create Employee</Link>}
                  <Link to="/active">Active Employees</Link>
                  {isAdmin && <Link to="/relieved">Relieved Employees</Link>}
                  {isAdmin && <Link to="/masters">Master Items</Link>}
                </div>
              )}
            </div>

            {/* TICKETING */}
            <div className={styles.menuGroup}>
              <div
                className={styles.menuTitle}
                onClick={() => toggle("ticketing")}
              >
                <FaTicketAlt className={styles.icon} />
                <span>Ticketing Tool</span>
              </div>

              {open.ticketing && (
                <div className={styles.subMenu}>
                  <Link to="/tickets/create">New Ticket</Link>
                  <Link to="/tickets/open">Opened Tickets</Link>
                  <Link to="/tickets/closed">Closed Tickets</Link>
                </div>
              )}
            </div>

            {/* HRD */}
            <div className={styles.menuGroup}>
              <div
                className={styles.menuTitle}
                onClick={() => toggle("hrd")}
              >
                <FaUserTie className={styles.icon} />
                <span>HRD</span>
              </div>

              {open.hrd && (
                <div className={styles.subMenu}>
                  <Link to="/hrd/offer-letter">Offer Letter Request</Link>
                  <Link to="/hrd/uniform">Uniform Request</Link>
                  <Link to="/hrd/manpower">Manpower Request</Link>
                </div>
              )}
            </div>
          </div>



          {/* LOGOUT ALWAYS BOTTOM */}
          <div className={styles.logout}>
            <Button
              variant="contained"
              color="error"
              size="small"
              fullWidth
              startIcon={<FaSignOutAlt />}
              onClick={() => {
                logout();
                window.location.replace("/login");
              }}
            >
              Logout
            </Button>
          </div>

        </>
      )}

    </div>
  );
}