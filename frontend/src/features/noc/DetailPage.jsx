import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getNldRecordById } from "../services/nldService";
import "../css/NldOverall.css";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRecord = async () => {
    try {
      setLoading(true);
      const record = await getNldRecordById(id);
      setData(record);
    } catch (error) {
      console.error("Detail load error:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadRecord();
    }
  }, [id]);

  if (loading) {
    return <div className="nld-empty-state">Loading...</div>;
  }

  if (!data) {
    return (
      <div className="nld-detail-page">
        <div className="nld-detail-card">
        <h1>NLD Record Details</h1>
        <p>Record not found.</p>
        <button
          className="nld-form-secondary-btn"
          onClick={() => navigate("/customer/nld-tracker")}
        >
          Back
        </button>
        </div>
      </div>
    );
  }

  const fields = [
    ["nld_name", "NLD NAME"],
    ["nld_location", "NLD LOCATION"],
    ["operator_nld", "OPERATOR NLD"],
    ["circuit_id", "CIRCUIT ID"],
    ["ticket_id", "TICKET ID"],
    ["sr_number", "SR NUMBER"],
    ["branch", "BRANCH"],
    ["zone", "ZONE"],
    ["district", "DISTRICT"],
    ["upstream_provider", "UPSTREAM PROVIDER"],
    ["bandwidth", "BANDWIDTH"],
    ["infonet_nld_id", "INFONET NLD ID"],
    ["total_towers_connected", "TOTAL TOWERS CONNECTED"],
    ["link_down_datetime", "LINK DOWN DATE & TIME", "datetime"],
    ["link_up_datetime", "LINK UP DATE & TIME", "datetime"],
    ["total_duration", "TOTAL DURATION"],
    ["ticket_status", "TICKET STATUS"],
    ["current_update", "CURRENT UPDATE"],
    ["failover_availability", "FAILOVER AVAILABILITY"],
    ["failover_status", "FAILOVER STATUS"],
    ["emp_id", "EMP ID"],
    ["emp_name", "EMP NAME"],
    ["ticket_raised_department", "TICKET RAISED DEPARTMENT"],
    ["no_of_incidents", "NO OF INCIDENTS"],
    ["issue_side", "ISSUE SIDE"],
    ["rfo", "RFO"],
    ["closing_comments", "CLOSING COMMENTS"],
    ["ticket_closed_department", "TICKET CLOSED DEPARTMENT"],
    ["updated_by_emp_id", "UPDATED BY EMP ID"],
    ["updated_by_emp_name", "UPDATED BY EMP NAME"],
    ["department_ownership", "DEPARTMENT OWNERSHIP"],
    ["poa", "POA"],
    ["record_status", "RECORD STATUS"],
  ];

  return (
    <div className="nld-detail-page">
      <div className="nld-detail-card">
      <div className="nld-form-header">
        <div className="nld-form-title">
          <h1>NLD Record Details</h1>
          <p>View full information</p>
        </div>

        <div className="nld-detail-actions">
          {data.record_status === "OPEN" && (
            <Link className="nld-form-primary-btn nld-detail-link" to={`/customer/nld-tracker/edit/${id}`}>
              Edit
            </Link>
          )}
          <button className="nld-form-secondary-btn" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>

      <div className="nld-detail-grid">
        {fields.map(([key, label, type]) => {
          let value = data[key];
          if (type === "datetime") value = formatDateTime(value);
          if (value === null || value === undefined || value === "") value = "-";

          return (
            <div className="nld-detail-item" key={key}>
              <div className="nld-detail-label">{label}</div>
              <div className="nld-detail-value">{value}</div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export default DetailPage;
