import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaDownload, FaEnvelope, FaEye, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import styles from "../../../css/hrd/PayslipDashboard.module.css";
import EmployeeBulkUpload from "../../masters/components/EmployeeBulkUpload";
import {
  deletePayslip,
  downloadPayslip,
  getPayslips,
  previewPayslip,
  sendPayslipMail,
} from "../../../services/payslipService";
import {
  bulkUploadPayslips,
  downloadPayslipBulkTemplate,
} from "../../../services/masterServices";
import {
  getAllBranches,
  getTeams,
  getZones,
} from "../../../services/employeeService";
import { PAYSLIP_MONTHS } from "./payslipUtils";
import { getAuthItem, getAuthUser } from "../../../utils/auth";

const DEFAULT_FILTERS = {
  search: "",
  zone_id: "",
  branch_id: "",
  team_id: "",
  month: "",
  year: new Date().getFullYear().toString(),
};

export default function PayslipDashboard() {
  const navigate = useNavigate();
  const savedUser = useMemo(() => {
    return getAuthUser() || {};
  }, []);
  const currentRole = String(savedUser?.role || getAuthItem("role") || "")
    .trim()
    .toUpperCase();
  const currentTeam = String(
    savedUser?.team_name || savedUser?.team || getAuthItem("team") || "",
  )
    .trim()
    .toUpperCase();
  const currentDesignation = String(
    savedUser?.designation_name ||
      savedUser?.designation ||
      getAuthItem("designation_name") ||
      getAuthItem("designation") ||
      "",
  )
    .trim()
    .toUpperCase();
  const canManagePayslipsUi =
    ["ADMIN", "SUPER_ADMIN"].includes(currentRole) ||
    (
      (currentTeam === "HRD" || currentTeam === "HRD TEAM") &&
      ["MANAGER", "ADMIN", "RECRUITER", "RECRUTIER"].includes(currentDesignation)
    );
  const canDeletePayslips = ["ADMIN", "SUPER_ADMIN"].includes(currentRole);

  const [rows, setRows] = useState([]);
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [access, setAccess] = useState({ fullAccess: false, canManage: false });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState(DEFAULT_FILTERS.search);

  useEffect(() => {
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
      } catch (error) {
        console.error(error);
        toast.error("Failed to load master data");
      }
    };

    loadMasters();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
    setFilters((prev) => (
        prev.search === searchInput ? prev : { ...prev, search: searchInput }
      ));
      setPage(1);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        ...filters,
      };

      const res = await getPayslips(params);
      setRows(res.data?.data || []);
      setTotalPages(res.data?.pagination?.totalPages || 1);
      setAccess(res.data?.access || { fullAccess: false, canManage: false });
    } catch (error) {
      console.error(error);
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const filteredBranches = useMemo(() => {
    if (!filters.zone_id) return branches;
    return branches.filter(
      (branch) => String(branch.zone_id) === String(filters.zone_id),
    );
  }, [branches, filters.zone_id]);

  const handleFilterChange = useCallback((name, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchInput(DEFAULT_FILTERS.search);
    setPage(1);
  }, []);

  const handlePreview = async (id) => {
    try {
      const res = await previewPayslip(id);
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      toast.error("Preview failed");
    }
  };

  const handleDownload = async (id, payslipNo) => {
    try {
      const res = await downloadPayslip(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${payslipNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("Download failed");
    }
  };

  const handleSendMail = async (row) => {
    try {
      await sendPayslipMail({
        payslip_id: row.id,
        email: row.email,
      });
      toast.success("Payslip mailed successfully");
    } catch (error) {
      console.error(error);
      toast.error("Mail send failed");
    }
  };

  const handleDelete = async (row) => {
    const confirmed = window.confirm(
      `Delete payslip ${row.payslip_no} for ${row.employee_name}?`,
    );
    if (!confirmed) return;

    try {
      await deletePayslip(row.id);
      toast.success("Payslip deleted successfully");
      fetchPayslips();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to delete payslip");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerSpacer} />
        <h2>Payslip Dashboard</h2>
        <div className={styles.headerActions}>
          {access.canManage && canManagePayslipsUi && (
            <>
              <EmployeeBulkUpload
                triggerLabel="Bulk Upload"
                modalTitle="Bulk Upload Payslips"
                note="Upload `.csv`, `.xlsx`, or `.xls` to create payslips and generate PDFs in bulk. Use one row per employee for the payroll month."
                templateFields={[
                  "emp_id",
                  "salary_month",
                  "salary_year",
                  "salary_date",
                  "account_number",
                  "lop",
                  "salary_days",
                  "remarks",
                  "basicPay",
                  "hra",
                  "otherAllowance",
                  "foodAllowance",
                  "vehicleAllowance",
                  "ot",
                  "positionAllowance",
                  "arrear",
                  "holidayPay",
                  "esi",
                  "pf",
                  "insurance",
                  "uniform",
                  "specialDeductions",
                  "salaryAdvance",
                  "tds",
                ]}
                templateFileName="payslip-bulk-upload-template.csv"
                errorReportFileName="payslip-bulk-upload-errors.csv"
                downloadTemplate={downloadPayslipBulkTemplate}
                uploadAction={bulkUploadPayslips}
                insertedColumns={[
                  { key: "row_number", label: "Row" },
                  { key: "emp_id", label: "Emp ID" },
                  { key: "employee_name", label: "Employee" },
                  { key: "payslip_no", label: "Payslip No" },
                  { key: "month", label: "Month" },
                ]}
                failedColumns={[
                  { key: "row_number", label: "Row" },
                  { key: "emp_id", label: "Emp ID" },
                  { key: "error", label: "Error" },
                ]}
                onUploaded={() => {
                  fetchPayslips();
                  toast.success("Payslip bulk upload completed");
                }}
              />
              <button
                className={styles.createBtn}
                onClick={() => navigate("/hrd/payslip/create")}
              >
                + Create Payslip
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.filters}>
        <input
          placeholder="Search Employee / EMP ID / Email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <select
          value={filters.zone_id}
          onChange={(e) => {
            handleFilterChange("zone_id", e.target.value);
            handleFilterChange("branch_id", "");
          }}
        >
          <option value="">Zone</option>
          {zones.map((zone) => (
            <option key={zone.id ?? zone.zone_id} value={zone.id ?? zone.zone_id}>
              {zone.zone_name ?? zone.name}
            </option>
          ))}
        </select>

        <select
          value={filters.branch_id}
          onChange={(e) => handleFilterChange("branch_id", e.target.value)}
        >
          <option value="">Branch</option>
          {filteredBranches.map((branch) => (
            <option key={branch.id ?? branch.branch_id} value={branch.id ?? branch.branch_id}>
              {branch.branch_name ?? branch.name}
            </option>
          ))}
        </select>

        <select
          value={filters.team_id}
          onChange={(e) => handleFilterChange("team_id", e.target.value)}
        >
          <option value="">Team</option>
          {teams.map((team) => (
            <option key={team.id ?? team.team_id} value={team.id ?? team.team_id}>
              {team.team_name ?? team.name}
            </option>
          ))}
        </select>

        <select
          value={filters.month}
          onChange={(e) => handleFilterChange("month", e.target.value)}
        >
          <option value="">Month</option>
          {PAYSLIP_MONTHS.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="2020"
          max="2100"
          value={filters.year}
          onChange={(e) => handleFilterChange("year", e.target.value)}
          placeholder="Year"
        />

        <button className={styles.resetBtn} onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Payslip No</th>
              <th>EMP ID</th>
              <th>Employee Name</th>
              <th>Zone</th>
              <th>Branch</th>
              <th>Team</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading && rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {access.canManage && canManagePayslipsUi ? (
                    <button
                      type="button"
                      className={styles.payslipLink}
                      title={`Edit ${row.payslip_no}`}
                      onClick={() => navigate(`/hrd/payslip/edit/${row.id}`)}
                    >
                      {row.payslip_no}
                    </button>
                  ) : (
                    <span>{row.payslip_no}</span>
                  )}
                </td>
                <td>{row.emp_id}</td>
                <td>{row.employee_name}</td>
                <td>{row.zone_name || "-"}</td>
                <td>{row.branch_name || "-"}</td>
                <td>{row.department || "-"}</td>
                <td className={styles.actions}>
                  <button type="button" title="Download" onClick={() => handleDownload(row.id, row.payslip_no)}>
                    <FaDownload />
                  </button>
                  {access.fullAccess && (
                    <button type="button" title="Send Mail" onClick={() => handleSendMail(row)}>
                      <FaEnvelope />
                    </button>
                  )}
                  <button type="button" title="Preview" onClick={() => handlePreview(row.id)}>
                    <FaEye />
                  </button>
                  {canDeletePayslips && (
                    <button
                      type="button"
                      title="Delete"
                      className={styles.deleteAction}
                      onClick={() => handleDelete(row)}
                    >
                      <FaTrash />
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="7" className={styles.empty}>No records found</td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan="7" className={styles.empty}>Loading...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button disabled={page === 1 || loading} onClick={() => setPage((prev) => prev - 1)}>
          Prev
        </button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages || loading} onClick={() => setPage((prev) => prev + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
