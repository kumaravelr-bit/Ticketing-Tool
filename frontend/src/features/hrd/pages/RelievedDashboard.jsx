import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaDownload,
  FaEnvelope,
  FaEye,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/RelievingDashboard.module.css";
import {
  getRelievingEmployees,
  previewRelievingLetter,
  downloadRelievingLetter,
  sendRelievingLetterMail,
  approveRelievingLetter,
  rejectRelievingLetter,
} from "../../../services/hrdService";
import {
  getAllBranches,
  getTeams,
  getZones,
} from "../../../services/employeeService";
import { getAuthItem, getAuthUser } from "../../../utils/auth";

const DEFAULT_FILTERS = {
  employee_name: "",
  zone_id: "",
  branch_id: "",
  team_id: "",
  fromDate: "",
  toDate: "",
};

const pad = (value) => String(value).padStart(2, "0");

const normalizeDateValue = (value) => {
  if (!value) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
      value.getDate(),
    )}`;
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
};

const getCurrentUser = () => {
  const user = getAuthUser();
  if (user) return user;

  return {
    role: getAuthItem("role") || "",
    team: getAuthItem("team") || "",
    team_name: getAuthItem("team") || "",
    designation: getAuthItem("designation") || getAuthItem("designation_name") || "",
    designation_name:
      getAuthItem("designation_name") || getAuthItem("designation") || "",
  };
};

const canApprove = (user) => {
  if (!user) return false;

  const role = String(user.role || "").trim().toUpperCase();
  const teamName = String(user.team_name || user.department || "").trim().toUpperCase();
  const designation = String(user.designation || user.designation_name || "")
    .trim()
    .toUpperCase();

  const isAllowedRole = role === "ADMIN" || role === "SUPER_ADMIN";
  const isHrdManager =
    (teamName === "HRD TEAM" || teamName === "HRD") &&
    designation.includes("MANAGER");

  return isAllowedRole || isHrdManager;
};

export default function RelievingDashboard() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const showApprovalActions = canApprove(currentUser);

  const [data, setData] = useState([]);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadMasters = async () => {
    try {
      const [zoneRes, branchRes, teamRes] = await Promise.all([
        getZones(),
        getAllBranches(),
        getTeams(),
      ]);

      setZones(zoneRes.data || []);
      setBranches(branchRes.data || []);
      setTeams(teamRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load master data");
    }
  };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getRelievingEmployees({
        page,
        limit,
        ...filters,
      });

      setData(res.data?.data || []);
      setTotalPages(res.data?.pagination?.totalPages || 1);
      setTotalRecords(res.data?.pagination?.total || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load relieving dashboard");
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const filteredBranches = useMemo(() => {
    if (!filters.zone_id) return branches;
    return branches.filter(
      (branch) => String(branch.zone_id) === String(filters.zone_id),
    );
  }, [branches, filters.zone_id]);

  const formatDate = (value) => {
    const normalized = normalizeDateValue(value);
    if (!normalized) return "-";

    const [year, month, day] = normalized.split("-");
    return `${day}/${month}/${year}`;
  };

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setLimit(10);
  };

  const handlePreview = async (id) => {
    try {
      const res = await previewRelievingLetter(id);
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 3000);
    } catch (err) {
      console.error("Preview failed:", err);
      toast.error("Failed to preview relieving letter");
    }
  };

  const handleDownload = async (id, documentId) => {
    try {
      const res = await downloadRelievingLetter(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 3000);
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to download relieving letter");
    }
  };

  const handleSendMail = async (row) => {
    try {
      if (String(row.approval_status || "").trim().toUpperCase() !== "APPROVED") {
        toast.info("Mail is available only after approval");
        return;
      }

      await sendRelievingLetterMail({
        relieving_id: row.id,
        email: row.email,
      });
      toast.success("Mail sent successfully");
    } catch (err) {
      console.error("Mail send failed:", err);
      toast.error(err.response?.data?.message || "Failed to send mail");
    }
  };

  const handleApprove = async (row) => {
    try {
      await approveRelievingLetter(row.id, {
        approved_by_emp_id: currentUser?.emp_id,
      });
      toast.success("Relieving letter approved");
      loadDashboard();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.status === 403
          ? "You are not authorized to approve this request"
          : err.response?.data?.message || "Failed to approve",
      );
    }
  };

  const handleReject = async (row) => {
    const reason = window.prompt("Enter rejection reason (optional):", "");
    if (reason === null) return;

    try {
      await rejectRelievingLetter(row.id, {
        approved_by_emp_id: currentUser?.emp_id,
        reason,
      });
      toast.success("Relieving letter rejected");
      loadDashboard();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.status === 403
          ? "You are not authorized to reject this request"
          : err.response?.data?.message || "Failed to reject",
      );
    }
  };

  const isApproved = (row) =>
    String(row.approval_status || "").trim().toUpperCase() === "APPROVED";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerSpacer} />
        <h2>Relieving Dashboard</h2>
        <button
          className={styles.createBtn}
          onClick={() => navigate("/hrd/relieving/create")}
        >
          + Create
        </button>
      </div>

      <div className={styles.filters}>
        <input
          placeholder="Employee Name / Employee ID"
          value={filters.employee_name}
          onChange={(e) => updateFilter("employee_name", e.target.value)}
        />

        <select
          value={filters.zone_id}
          onChange={(e) => {
            updateFilter("zone_id", e.target.value);
            updateFilter("branch_id", "");
          }}
        >
          <option value="">Zone</option>
          {zones.map((zone) => (
            <option
              key={zone.zone_id ?? zone.id}
              value={zone.zone_id ?? zone.id}
            >
              {zone.name ?? zone.zone_name}
            </option>
          ))}
        </select>

        <select
          value={filters.branch_id}
          onChange={(e) => updateFilter("branch_id", e.target.value)}
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
          value={filters.team_id}
          onChange={(e) => updateFilter("team_id", e.target.value)}
        >
          <option value="">Department</option>
          {teams.map((team) => (
            <option key={team.team_id ?? team.id} value={team.team_id ?? team.id}>
              {team.name ?? team.team_name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => updateFilter("fromDate", e.target.value)}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => updateFilter("toDate", e.target.value)}
        />

        <button className={styles.resetBtn} onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className={styles.toolbarMeta}>
        <span>Total Records: {totalRecords}</span>

        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
          className={styles.pageSize}
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Document ID</th>
              <th>Date</th>
              <th>Employee Name</th>
              <th>Employee ID</th>
              <th>Department</th>
              <th>Relieving Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading &&
              data.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.document_id ? (
                      <button
                        type="button"
                        className={styles.docLink}
                        onClick={() => navigate(`/hrd/relieving/edit/${row.id}`)}
                        title="Edit relieving request"
                      >
                        {row.document_id}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{formatDate(row.date || row.letter_date)}</td>
                  <td>{row.employee_name || "-"}</td>
                  <td>{row.employee_id || "-"}</td>
                  <td>{row.department || "-"}</td>
                  <td>{formatDate(row.relieving_date)}</td>
                  <td>{row.approval_status || "-"}</td>

                  <td className={styles.actions}>
                    <span
                      title="Download"
                      onClick={() => handleDownload(row.id, row.document_id)}
                    >
                      <FaDownload />
                    </span>

                    <span
                      title={
                        isApproved(row)
                          ? "Send Mail"
                          : "Mail is available only for approved requests"
                      }
                      onClick={() => isApproved(row) && handleSendMail(row)}
                      className={!isApproved(row) ? styles.actionDisabled : ""}
                    >
                      <FaEnvelope />
                    </span>

                    <span title="Preview" onClick={() => handlePreview(row.id)}>
                      <FaEye />
                    </span>

                    {showApprovalActions && row.approval_status === "PENDING" && (
                      <>
                        <span title="Approve" onClick={() => handleApprove(row)}>
                          <FaCheck />
                        </span>

                        <span title="Reject" onClick={() => handleReject(row)}>
                          <FaTimes />
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}

            {!loading && data.length === 0 && (
              <tr>
                <td colSpan="8" className={styles.empty}>
                  No records found
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan="8" className={styles.empty}>
                  Loading...
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
