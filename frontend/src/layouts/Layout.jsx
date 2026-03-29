import { Outlet } from "react-router-dom";
import { useState } from "react";
import Menu from "../components/Menu";
import styles from "../css/Layout.module.css";

export default function Layout() {

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.layout}>

      <Menu collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={`${styles.content} ${
          collapsed ? styles.contentCollapsed : ""
        }`}
      >
        <Outlet />
      </div>

    </div>
  );
}