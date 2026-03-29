import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../css/OfferLetterDashboard.module.css";
import { previewOfferLetter } from "../services/hrdService";

import {
  getOfferLetters,
  downloadOfferLetter,
  sendOfferLetterMail
} from "../services/hrdService";
export default function OfferLetterDashboard() {

  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [filters, setFilters] = useState({
    employee_name: "",
    location: "",
    team: "",
    fromDate: "",
    toDate: ""
  });

  /* =============================
     FETCH DATA
  ============================= */
  useEffect(() => {
    fetchData();
  }, []);

const handlePreview = async (id) => {
  try {
    const data = await previewOfferLetter(id);
    const url = window.URL.createObjectURL(
      new Blob([data], { type: "application/pdf" })
    );
    window.open(url, "_blank");
  } catch (err) {
    console.error("Preview failed:", err);
    alert("Failed to preview offer letter");
  }
};

  const fetchData = async () => {
    try {
      const res = await getOfferLetters();
      setData(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  /* =============================
     FILTER
  ============================= */
  const filteredData = useMemo(() => {

    return data.filter((d) => {

      if (
        filters.employee_name &&
        !d.employee_name?.toLowerCase().includes(filters.employee_name.toLowerCase())
      ) return false;

      if (filters.location && d.location !== filters.location) return false;

      if (
        filters.team &&
        !d.team_name?.toLowerCase().includes(filters.team.toLowerCase())
      ) return false;

      if (filters.fromDate && new Date(d.doj) < new Date(filters.fromDate)) return false;
      if (filters.toDate && new Date(d.doj) > new Date(filters.toDate)) return false;

      return true;
    });

  }, [data, filters]);

  /* =============================
     PAGINATION
  ============================= */
  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredData.slice(start, start + perPage);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / perPage);

  /* =============================
     ACTIONS
  ============================= */
  const handleDownload = async (id, docId) => {
    const res = await downloadOfferLetter(id);
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${docId}.pdf`;
    link.click();
  };

  const handleSendMail = async (row) => {
    await sendOfferLetterMail({
      email: row.email,
      document_id: row.document_id
    });
    alert("Mail Sent");
  };

  const resetFilters = () => {
    setFilters({
      employee_name: "",
      location: "",
      team: "",
      fromDate: "",
      toDate: ""
    });
    setPage(1);
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN") : "-";

  const locations = [...new Set(data.map(d => d.location))];

  return (
    <div className={styles.container}>

      <h2>Offer Letter Dashboard</h2>

      {/* FILTERS */}
      <div className={styles.filters}>

        <input
          placeholder="Employee Name"
          value={filters.employee_name}
          onChange={(e) =>
            setFilters({ ...filters, employee_name: e.target.value })
          }
        />

        <select
          value={filters.location}
          onChange={(e) =>
            setFilters({ ...filters, location: e.target.value })
          }
        >
          <option value="">Location</option>
          {locations.map((l, i) => (
            <option key={i}>{l}</option>
          ))}
        </select>

        <input
          placeholder="Team"
          value={filters.team}
          onChange={(e) =>
            setFilters({ ...filters, team: e.target.value })
          }
        />

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) =>
            setFilters({ ...filters, fromDate: e.target.value })
          }
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) =>
            setFilters({ ...filters, toDate: e.target.value })
          }
        />

        <button className={styles.resetBtn} onClick={resetFilters}>
          Reset
        </button>

        <button
          className={styles.createBtn}
          onClick={() => navigate("/offer-letter-request")}
        >
          + Create
        </button>

      </div>

      {/* TABLE */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>

          <thead>
            <tr>
              <th>DOC</th>
              <th>Employee</th>
              <th>DOJ</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Team</th>
              <th>Designation</th>
              <th></th>
            </tr>
          </thead>

          <tbody>

            {paginatedData.map((row) => (

              <tr key={row.id}>

                {/* 🔥 DOC HOVER */}
                <td>
                  <span
                    className={styles.docIcon}
                    title={row.document_id}
                    onClick={() => navigate(`/offer-letter/edit/${row.id}`)}
                  >
                    {row.document_id}
                  </span>
                </td>

                <td>{row.employee_name}</td>
                <td>{formatDate(row.doj)}</td>
                <td>{row.location}</td>
                <td>{row.phone}</td>
                <td>{row.team_name}</td>
                <td>{row.designation}</td>

                {/* 🔥 ICON ACTIONS */}
                <td className={styles.actions}>

                  <span
                    title="Download"
                    onClick={() => handleDownload(row.id, row.document_id)}
                  >
                    ⬇️
                  </span>

                  <span
                    title="Send Mail"
                    onClick={() => handleSendMail(row)}
                  >
                    📧
                  </span>
                  <span
  title="Preview"
  onClick={() => handlePreview(row.id)}
>
  👁️
</span>

                </td>

              </tr>
            ))}

            {paginatedData.length === 0 && (
              <tr>
                <td colSpan="8" className={styles.empty}>
                  No records found
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className={styles.pagination}>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
          Prev
        </button>

        <span>
          Page {page} / {totalPages || 1}
        </span>

        <button
          disabled={page === totalPages || totalPages === 0}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </button>
      </div>

    </div>
  );
}