import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FiDownload,
  FiPlus,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import LeadsTable from "./LeadsTable";
import SearchableSelect from "./SearchableSelect";
import FormField from "./FormField";
import { deleteLead, getLeads } from "../../services/newConnectionService";
import { buildApiUrl } from "../../config/apiConfig";
import {
  DB_ACTIVITY_TYPES,
  DB_STATUS_OPTIONS,
  getEmployeeDirectory,
  getLoggedInLeadAccess,
} from "./leadFormUtils";
import styles from "../../css/new_connections/NewConnectionDashboard.module.css";

export default function LeadMasterPage() {
  const navigate = useNavigate();
  const perPage = 10;
  const [filters, setFilters] = useState({
    search: "",
    employee: "",
    status: "",
    activityType: "",
  });
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const leadAccess = useMemo(() => getLoggedInLeadAccess(), []);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLeads(filters);
      setLeads(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load new connection requests");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const filteredLeads = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const visibleLeads = !normalizedSearch
      ? leads
      : leads.filter((lead) =>
          [
            lead.customerName,
            lead.leadNumber,
            lead.zone,
            lead.branch,
            lead.connectionBranch,
            lead.status,
            lead.activityType,
          ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSearch))
        );

    return [...visibleLeads].sort((firstLead, secondLead) => {
      const firstTime = Date.parse(firstLead.updatedAt || firstLead.createdAt || 0);
      const secondTime = Date.parse(secondLead.updatedAt || secondLead.createdAt || 0);

      if (firstTime !== secondTime) {
        return secondTime - firstTime;
      }

      return Number(secondLead.id || 0) - Number(firstLead.id || 0);
    });
  }, [filters.search, leads]);

  const employees = useMemo(() => {
    return getEmployeeDirectory().map((employee) => ({
      ...employee,
      count: leads.filter((lead) => lead.empName === employee.empName).length,
    }));
  }, [leads]);

  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredLeads.slice(start, start + perPage);
  }, [filteredLeads, page]);

  const totalPages = Math.max(Math.ceil(filteredLeads.length / perPage), 1);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const handleAdd = () => {
    navigate("/customer-onboarding/lead-process/new");
  };

  const handleView = (lead) => {
    navigate(`/customer-onboarding/lead-process/view/${lead.id}`);
  };

  const handleDelete = async (lead) => {
    const confirmed = window.confirm(
      `Delete lead ${lead.leadNumber} for ${lead.customerName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteLead(lead.id);
      toast.success("New connection request deleted successfully");
      loadLeads();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete new connection request");
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        params.append(key, value);
      }
    });

    window.open(`${buildApiUrl("/new-connections/export/excel")}?${params.toString()}`, "_blank");
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      employee: "",
      status: "",
      activityType: "",
    });
  };

  return (
    <div className={styles.shell}>
      <main className={styles.card}>
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.headerKicker}>Request Dashboard</span>
            <h1>New Connection Request Dashboard</h1>
          </div>

          <div className={styles.actionGroup}>
            <button type="button" className={styles.primaryButton} onClick={handleAdd}>
              <FiPlus />
              Create New Request
            </button>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span>Total Requests</span>
            <strong>{filteredLeads.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Followup</span>
            <strong>{filteredLeads.filter((lead) => lead.status === "FOLLOWUP").length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>ID Created</span>
            <strong>{filteredLeads.filter((lead) => lead.status === "ID CREATED").length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Order Win</span>
            <strong>{filteredLeads.filter((lead) => lead.status === "ORDER WIN").length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Cancelled</span>
            <strong>{filteredLeads.filter((lead) => lead.status === "CANCELLED").length}</strong>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <FiSearch />
            <input
              value={filters.search}
              placeholder="Search customer, request number, zone, branch..."
              onChange={(event) =>
                setFilters((previous) => ({ ...previous, search: event.target.value }))
              }
            />
          </div>

          <SearchableSelect
            label=""
            placeholder="Filter by employee"
            options={employees.map((employee) => employee.empName)}
            value={filters.employee}
            onChange={(value) => setFilters((previous) => ({ ...previous, employee: value }))}
          />

          <FormField
            label=""
            as="select"
            value={filters.activityType}
            options={DB_ACTIVITY_TYPES}
            placeholder="Activity Type"
            onChange={(value) => setFilters((previous) => ({ ...previous, activityType: value }))}
          />

          <FormField
            label=""
            as="select"
            value={filters.status}
            options={DB_STATUS_OPTIONS}
            placeholder="Status"
            onChange={(value) => setFilters((previous) => ({ ...previous, status: value }))}
          />

          <div className={styles.toolbarActions}>
            <button type="button" className={styles.filterButton} onClick={resetFilters}>
              <FiRefreshCw />
              Reset
            </button>
            <button type="button" className={styles.exportButton} onClick={handleExport}>
              <FiDownload />
              Export
            </button>
          </div>
        </div>

        <LeadsTable
          rows={paginatedLeads}
          loading={loading}
          onView={handleView}
          onDelete={handleDelete}
          canDelete={leadAccess.canDelete}
        />

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.paginationButton}
            disabled={page === 1}
            onClick={() => setPage((previous) => previous - 1)}
          >
            Prev
          </button>
          <span className={styles.paginationInfo}>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.paginationButton}
            disabled={page === totalPages}
            onClick={() => setPage((previous) => previous + 1)}
          >
            Next
          </button>
        </div>
      </main>
    </div>
  );
}
