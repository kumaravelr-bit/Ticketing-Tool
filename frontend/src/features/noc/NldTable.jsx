

import React from "react";
import { useNavigate } from "react-router-dom";

function NldTable({ rows }) {
  const navigate = useNavigate();

  return (
    <div className="nld-table-wrap">
      <table className="nld-table">
        <thead>
          <tr>
            <th>NLD Name</th>
            <th>Date</th>
            <th>NLD Location</th>
            <th>Zone</th>
            <th>Branch</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                <span className="nld-no-data">No data found</span>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    type="button"
                    className="nld-link-btn"
                    onClick={() => navigate(`/customer/nld-tracker/view/${row.id}`)}
                  >
                    {row.nld_name || "-"}
                  </button>
                </td>
                <td>{row.date ? new Date(row.date).toLocaleString() : "-"}</td>
                <td>{row.nld_location || "-"}</td>
                <td>{row.zone || "-"}</td>
                <td>{row.branch || "-"}</td>
                <td>
                  <span
                    className={`nld-status-badge ${
                      row.status === "OPEN" ? "open" : "closed"
                    }`}
                  >
                    {row.status || "-"}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default NldTable;
