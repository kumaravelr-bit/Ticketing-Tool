

import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Filters from "./Filters";
import NldTable from "./NldTable";
import "../css/NldOverall.css";
import Pagination from "../customercare/Pagination";
import {
  getNldDashboardCounts,
  getNldDashboardRows,
  getNldFilters,
} from "../services/nldService";
import { buildApiUrl } from "../../config/apiConfig";

function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get("status") || "";
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState({ zones: [], branches: [] });
  const [counts, setCounts] = useState({
    total_nld: 0,
    open_count: 0,
    closed_count: 0,
    total_records: 0,
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const [filters, setFilters] = useState({
    search: "",
    zone: "",
    branch: "",
    status: urlStatus,
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      status: urlStatus,
    }));
  }, [urlStatus]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    setSearchParams((prevParams) => {
      const nextParams = new URLSearchParams(prevParams);

      if (filters.status) {
        nextParams.set("status", filters.status);
      } else {
        nextParams.delete("status");
      }

      return nextParams;
    }, { replace: true });
  }, [filters.status, setSearchParams]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    return params.toString();
  }, [filters]);

  const loadFilters = async () => {
    try {
      const nextOptions = await getNldFilters();
      setOptions(nextOptions);
    } catch (error) {
      console.error("Filters load error:", error);
      setOptions({ zones: [], branches: [] });
    }
  };

  const loadCounts = async () => {
    try {
      const nextCounts = await getNldDashboardCounts();
      setCounts(nextCounts);
    } catch (error) {
      console.error("Counts load error:", error);
      setCounts({
        total_nld: 0,
        open_count: 0,
        closed_count: 0,
        total_records: 0,
      });
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const nextRows = await getNldDashboardRows(queryString);
      setRows(nextRows);
    } catch (error) {
      console.error("Dashboard load error:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilters();
    loadCounts();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [queryString]);

  const handleExport = () => {
    window.open(`${buildApiUrl("/export")}?${queryString}`, "_blank");
  };

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [rows, page]);

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  return (
    <div className="nld-dashboard-page">
      <div className="nld-dashboard-card">
        <div className="nld-dashboard-title-row">
          <div className="nld-dashboard-heading">
            <h1>NLD Link Down Dashboard</h1>
            <p>Customer Care Dashboard</p>
          </div>

          {filters.status !== "CLOSED" && (
            <Link className="nld-primary-btn nld-header-add-btn" to="/customer/nld-tracker/new">
              + Add
            </Link>
          )}
        </div>

        <div className="nld-stats-row">
          <div className="nld-stat-card">
            <div className="nld-stat-label">Total NLD</div>
            <div className="nld-stat-value">{counts.total_nld}</div>
          </div>

          <div className="nld-stat-card">
            <div className="nld-stat-label">Current Page</div>
            <div className="nld-stat-value">{page}</div>
          </div>

          <div className="nld-stat-card">
            <div className="nld-stat-label">Total Pages</div>
            <div className="nld-stat-value">{totalPages}</div>
          </div>

          <div className="nld-stat-card">
            <div className="nld-stat-label">Showing</div>
            <div className="nld-stat-value">{paginatedRows.length}</div>
          </div>
        </div>

        <Filters
          filters={filters}
          setFilters={setFilters}
          options={options}
          onExport={handleExport}
        />

        <div className="nld-table-section">
          {loading ? (
            <div className="nld-empty-state">Loading dashboard...</div>
          ) : (
            <NldTable rows={paginatedRows} />
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

export default DashboardPage;
