import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaDownload, FaEnvelope, FaEye } from "react-icons/fa";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/OfferLetterDashboard.module.css";
import {
  downloadOfferLetter,
  getOfferLetters,
  previewOfferLetter,
  sendOfferLetterMail,
} from "../../../services/hrdService";
import { getAllBranches, getTeams, getZones } from "../../../services/employeeService";

export default function OfferLetterDashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [filters, setFilters] = useState({
    employee_name: "",
    zone_id: "",
    branch_id: "",
    team_name: "",
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    loadInitialData();
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
      toast.error("Failed to preview offer letter");
    }
  };

  const loadInitialData = async () => {
    try {
      const [offerRes, zoneRes, branchRes, teamRes] = await Promise.all([
        getOfferLetters(),
        getZones(),
        getAllBranches(),
        getTeams(),
      ]);

      setData(offerRes.data || []);
      setZones(zoneRes.data || []);
      setBranches(branchRes.data || []);
      setTeams(teamRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBranches = useMemo(() => {
    if (!filters.zone_id) return branches;
    return branches.filter(
      (branch) => String(branch.zone_id) === String(filters.zone_id)
    );
  }, [branches, filters.zone_id]);

  const filteredData = useMemo(() => {
    return data.filter((d) => {
      if (
        filters.employee_name &&
        !d.employee_name?.toLowerCase().includes(filters.employee_name.toLowerCase())
      ) {
        return false;
      }

      if (filters.zone_id && String(d.zone_id) !== String(filters.zone_id)) {
        return false;
      }

      if (filters.branch_id && String(d.branch_id) !== String(filters.branch_id)) {
        return false;
      }

      if (
        filters.team_name &&
        String(d.team_name || "").trim().toUpperCase() !==
          String(filters.team_name).trim().toUpperCase()
      ) {
        return false;
      }

      if (filters.fromDate && new Date(d.doj) < new Date(filters.fromDate)) {
        return false;
      }

      if (filters.toDate && new Date(d.doj) > new Date(filters.toDate)) {
        return false;
      }

      return true;
    });
  }, [data, filters]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredData.slice(start, start + perPage);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / perPage);

  const handleDownload = async (id, docId) => {
    const res = await downloadOfferLetter(id);
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${docId}.pdf`;
    link.click();
  };

  const handleSendMail = async (row) => {
    try {
      await sendOfferLetterMail({
        email: row.email,
        document_id: row.document_id,
      });
      toast.success("Mail sent successfully");
    } catch (err) {
      console.error("Mail send failed:", err);
      toast.error(err.response?.data?.message || "Failed to send mail");
    }
  };

  const resetFilters = () => {
    setFilters({
      employee_name: "",
      zone_id: "",
      branch_id: "",
      team_name: "",
      fromDate: "",
      toDate: "",
    });
    setPage(1);
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN") : "-";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerSpacer} />
        <h2>Offer Letter Dashboard</h2>
        <button
          className={styles.createBtn}
          onClick={() => navigate("/offer-letter-request")}
        >
          + Create
        </button>
      </div>

      <div className={styles.filters}>
        <input
          placeholder="Employee Name"
          value={filters.employee_name}
          onChange={(e) =>
            setFilters({ ...filters, employee_name: e.target.value })
          }
        />

        <select
          value={filters.zone_id}
          onChange={(e) =>
            setFilters({
              ...filters,
              zone_id: e.target.value,
              branch_id: "",
            })
          }
        >
          <option value="">Zone</option>
          {zones.map((zone) => (
            <option key={zone.zone_id ?? zone.id} value={zone.zone_id ?? zone.id}>
              {zone.name ?? zone.zone_name}
            </option>
          ))}
        </select>

        <select
          value={filters.branch_id}
          onChange={(e) =>
            setFilters({ ...filters, branch_id: e.target.value })
          }
        >
          <option value="">Branch</option>
          {filteredBranches.map((branch) => (
            <option
              key={branch.branch_id ?? branch.id}
              value={branch.branch_id ?? branch.id}
            >
              {branch.name ?? branch.branch_name}
            </option>
          ))}
        </select>

        <select
          value={filters.team_name}
          onChange={(e) =>
            setFilters({ ...filters, team_name: e.target.value })
          }
        >
          <option value="">Team</option>
          {teams.map((team) => (
            <option key={team.team_id ?? team.id} value={team.name ?? team.team_name}>
              {team.name ?? team.team_name}
            </option>
          ))}
        </select>

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
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>DOC</th>
              <th>Employee</th>
              <th>DOJ</th>
              <th>Zone</th>
              <th>Branch</th>
              <th>Phone</th>
              <th>Team</th>
              <th>Designation</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    type="button"
                    className={styles.docLink}
                    title={row.document_id}
                    onClick={() => navigate(`/offer-letter/edit/${row.id}`)}
                  >
                    {row.document_id}
                  </button>
                </td>

                <td>{row.employee_name}</td>
                <td>{formatDate(row.doj)}</td>
                <td>{row.zone_name || "-"}</td>
                <td>{row.branch_name || "-"}</td>
                <td>{row.phone}</td>
                <td>{row.team_name}</td>
                <td>{row.designation}</td>

                <td className={styles.actions}>
                  <span
                    title="Download"
                    onClick={() => handleDownload(row.id, row.document_id)}
                  >
                    <FaDownload />
                  </span>

                  <span
                    title="Send Mail"
                    onClick={() => handleSendMail(row)}
                  >
                    <FaEnvelope />
                  </span>

                  <span
                    title="Preview"
                    onClick={() => handlePreview(row.id)}
                  >
                    <FaEye />
                  </span>
                </td>
              </tr>
            ))}

            {paginatedData.length === 0 && (
              <tr>
                <td colSpan="9" className={styles.empty}>
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>

        <span>
          Page {page} / {totalPages || 1}
        </span>

        <button
          disabled={page === totalPages || totalPages === 0}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
