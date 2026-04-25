

import { useEffect, useMemo, useState } from "react";
import { getAllBranches, getZones } from "../services/employeeService";

const filterConfig = [
  {
    key: "first_name",
    label: "First Name",
    type: "text",
    placeholder: "Search First Name"
  },
  {
    key: "customer_id",
    label: "Customer ID",
    type: "text",
    placeholder: "Search Customer ID"
  },
  {
    key: "zone",
    label: "Zone",
    type: "select",
    optionKey: "zones"
  },
  {
    key: "branch",
    label: "Branch",
    type: "select",
    optionKey: "branchesByZone"
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    optionKey: "statuses"
  }
];

export default function CustomerFilters({
  filters = {},
  options = {},
  onChange,
  onReset
}) {
  const [zones, setZones] = useState([]);
  const [branchesByZone, setBranchesByZone] = useState({});

  useEffect(() => {
    const loadLocationOptions = async () => {
      try {
        const [zoneRes, branchRes] = await Promise.all([
          getZones(),
          getAllBranches()
        ]);

        const zoneRows = Array.isArray(zoneRes?.data) ? zoneRes.data : [];
        const branchRows = Array.isArray(branchRes?.data) ? branchRes.data : [];

        const normalizedZones = zoneRows
          .map((item) => item?.name || item?.zone_name || item?.value || "")
          .filter(Boolean);

        const branchMap = branchRows.reduce((acc, item) => {
          const zoneName = item?.zone_name || item?.zone || "";
          const branchName = item?.name || item?.branch_name || item?.value || "";

          if (!zoneName || !branchName) return acc;
          if (!acc[zoneName]) acc[zoneName] = [];
          if (!acc[zoneName].includes(branchName)) acc[zoneName].push(branchName);
          return acc;
        }, {});

        setZones(normalizedZones);
        setBranchesByZone(branchMap);
      } catch (error) {
        console.error("Failed to load customer filter location options:", error);
        setZones([]);
        setBranchesByZone({});
      }
    };

    loadLocationOptions();
  }, []);

  const availableBranches = useMemo(() => {
    if (!filters.zone) return [];
    return branchesByZone[filters.zone] || [];
  }, [branchesByZone, filters.zone]);

  const safeOptions = {
    zones,
    statuses: options.statuses || []
  };

  const renderSelectOptions = (field) => {
    if (field.key === "branch") {
      return availableBranches.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ));
    }

    const values = safeOptions[field.optionKey] || [];
    return values.map((value) => (
      <option key={value} value={value}>
        {value}
      </option>
    ));
  };

  const handleFieldChange = (key, value) => {
    if (key === "zone") {
      onChange("zone", value);
      onChange("branch", "");
      return;
    }

    onChange(key, value);
  };

  return (
    <div className="customer-filter-row">
      <input
        type="text"
        value={filters.first_name || ""}
        placeholder="Search First Name"
        onChange={(e) => handleFieldChange("first_name", e.target.value)}
        className="customer-filter-input"
      />

      <input
        type="text"
        value={filters.customer_id || ""}
        placeholder="Search Customer ID"
        onChange={(e) => handleFieldChange("customer_id", e.target.value)}
        className="customer-filter-input"
      />

      <select
        value={filters.zone || ""}
        onChange={(e) => handleFieldChange("zone", e.target.value)}
        className="customer-filter-select"
      >
        <option value="">All Zones</option>
        {renderSelectOptions(filterConfig[2])}
      </select>

      <select
        value={filters.branch || ""}
        onChange={(e) => handleFieldChange("branch", e.target.value)}
        disabled={!filters.zone}
        className="customer-filter-select"
      >
        <option value="">
          {!filters.zone ? "Select Zone First" : "All Branches"}
        </option>
        {renderSelectOptions(filterConfig[3])}
      </select>

      <select
        value={filters.status || ""}
        onChange={(e) => handleFieldChange("status", e.target.value)}
        className="customer-filter-select"
      >
        <option value="">All Status</option>
        {renderSelectOptions(filterConfig[4])}
      </select>

      <button
        type="button"
        className="customer-reset-btn"
        onClick={onReset}
      >
        Reset
      </button>
    </div>
  );
}
