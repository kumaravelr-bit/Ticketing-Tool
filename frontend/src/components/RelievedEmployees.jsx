import { useEffect, useState } from "react";
import api from "../services/api";
import Menu from "../components/Menu";
import styles from "../css/RelievedEmployee.module.css"; // 👈 SAME CSS

export default function RelievedEmployees() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  api.get("/employee/employees/relieved")
    .then(res => setList(res.data))
    .finally(() => setLoading(false));
}, []);

  return (
    <>
      <Menu />

      <div className={styles.pageContainer}>
        <h2 className={styles.pageTitle}>Relieved / Deactivated Employees</h2>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
  <thead>
    <tr>
      <th>EMP ID</th>
      <th>Name</th>
      <th>Email</th>
      <th>Zone</th>
      <th>Branch</th>
      <th>Team</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {list.length === 0 ? (
      <tr>
        <td colSpan="7" style={{ textAlign: "center" }}>
          No Relieved Employees
        </td>
      </tr>
    ) : (
      list.map(emp => (
        <tr key={emp.emp_id}>
          <td>{emp.emp_id}</td>
          <td>{emp.name}</td>
          <td>{emp.email}</td>
          <td>{emp.zone_name || "-"}</td>
          <td>{emp.branch_name || "-"}</td>
          <td>{emp.team_name || "-"}</td>
          <td>
            <span
              className={
                emp.status === "RELIEVED"
                  ? styles.statusRelieved
                  : styles.statusDeactive
              }
            >
              {emp.status}
            </span>
          </td>
        </tr>
      ))
    )}
  </tbody>
</table>
          </div>
        )}
      </div>
    </>
  );
}
