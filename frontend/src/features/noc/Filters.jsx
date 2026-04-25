import React from "react";

function Filters({ filters, setFilters, options, onExport }) {
  const zones = options?.zones || [];
  const branches = options?.branches || [];

  return (
    <div className="nld-filter-row">
      <input
        className="nld-filter-input"
        type="text"
        placeholder="Search by NLD / Ticket / Circuit"
        value={filters.search}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, search: e.target.value }))
        }
      />

      <select
        className="nld-filter-select"
        value={filters.zone}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, zone: e.target.value }))
        }
      >
        <option value="">All Zones</option>
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>

      <select
        className="nld-filter-select"
        value={filters.branch}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, branch: e.target.value }))
        }
      >
        <option value="">All Branches</option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
      </select>

      <select
        className="nld-filter-select"
        value={filters.status}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, status: e.target.value }))
        }
      >
        <option value="">All Status</option>
        <option value="OPEN">OPEN</option>
        <option value="CLOSED">CLOSED</option>
      </select>

      <input
        className="nld-filter-input"
        type="date"
        value={filters.fromDate}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, fromDate: e.target.value }))
        }
      />

      <input
        className="nld-filter-input"
        type="date"
        value={filters.toDate}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, toDate: e.target.value }))
        }
      />

      <button type="button" className="nld-primary-btn nld-export-btn" onClick={onExport}>
        Export to Excel
      </button>
    </div>
  );
}

export default Filters;
