import { Outlet } from "react-router-dom";
import Menu from "../components/Menu";
import styles from "../css/Layout.module.css";

export default function Layout() {
  return (
    <div className={styles.layout}>

      {/* Sidebar */}
      <Menu />

      {/* Page Content */}
      <div className={styles.content}>
        <Outlet />
      </div>

    </div>
  );
}