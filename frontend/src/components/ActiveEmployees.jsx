import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Menu from "./Menu";
import { toast } from "react-toastify";
import styles from "../css/ActiveEmployee.module.css";

export default function ActiveEmployees() {
  const [employees, setEmployees] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await api.get("/employee/active");
      setEmployees(res.data);
    } catch {
      toast.error("Failed to load active employees");
    }
  };

  return (
    <>
      <Menu />

      <div className={styles.container}>
        <h2>Active Employees</h2>

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
              </tr>
            </thead>

            <tbody>
              {employees.map(emp => (
                <tr key={emp.emp_id}>
                  <td>
                    <span
                      className={styles.empLink}
                      onClick={() =>
                        navigate(`/employee/edit/${emp.emp_id}`)
                      }
                    >
                      {emp.emp_id}
                    </span>
                  </td>
                  <td>{emp.name}</td>
                  <td>{emp.email}</td>
                  <td>{emp.zone_name}</td>
                  <td>{emp.branch_name}</td>
                  <td>{emp.team_name}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {employees.length === 0 && (
            <p className={styles.empty}>No active employees found</p>
          )}
        </div>
      </div>
    </>
  );
}
