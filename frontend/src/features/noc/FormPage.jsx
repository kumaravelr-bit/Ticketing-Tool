import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../css/NldOverall.css";
import {
  createNldRecord,
  getNldFormOptions,
  getNldRecordById,
  lookupNldMasterData,
  updateNldRecord,
} from "../services/nldService";

function getCurrentDateTimeLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function createInitialForm() {
  return {
    nld_name: "",
    nld_location: "",
    operator_nld: "",
    circuit_id: "",
    ticket_id: "",
    sr_number: "",
    branch: "",
    zone: "",
    district: "",
    upstream_provider: "",
    bandwidth: "",
    infonet_nld_id: "",
    total_towers_connected: "",
    link_down_datetime: getCurrentDateTimeLocal(),
    ticket_status: "OPEN",
    current_update: "",
    failover_availability: "",
    failover_status: "",
    emp_id: "",
    emp_name: "",
    ticket_raised_department: "",
    no_of_incidents: 0,
    link_up_datetime: getCurrentDateTimeLocal(),
    total_duration: "",
    issue_side: "",
    rfo: "",
    closing_comments: "",
    ticket_closed_department: "",
    updated_by_emp_id: "",
    updated_by_emp_name: "",
    department_ownership: "",
    poa: "",
    record_status: "OPEN",
  };
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function calculateDuration(linkDown, linkUp) {
  if (!linkDown || !linkUp) return "";

  const start = new Date(linkDown);
  const end = new Date(linkUp);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  if (end < start) return "";

  let diff = Math.floor((end - start) / 1000);

  const days = Math.floor(diff / (24 * 3600));
  diff %= 24 * 3600;

  const hours = Math.floor(diff / 3600);
  diff %= 3600;

  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

function FormPage({ mode = "create" }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState(createInitialForm);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [formOptions, setFormOptions] = useState({
    nldNames: [],
    failoverAvailabilityOptions: ["AVAILABLE", "NOT AVAILABLE"],
    failoverStatusOptions: ["DOWN", "UP"],
  });

  useEffect(() => {
    if (mode === "edit" && id) {
      loadRecord();
    }
  }, [mode, id]);

  useEffect(() => {
    loadFormOptions();
  }, []);

  const loadFormOptions = async () => {
    try {
      const data = await getNldFormOptions();
      setFormOptions(data);
    } catch (error) {
      console.error("Failed to load NLD form options:", error);
    }
  };

  const loadRecord = async () => {
    try {
      setLoading(true);
      const data = (await getNldRecordById(id)) || {};

      const loadedForm = {
        ...createInitialForm(),
        ...data,
        link_down_datetime: toDateTimeLocal(data.link_down_datetime) || getCurrentDateTimeLocal(),
        link_up_datetime: toDateTimeLocal(data.link_up_datetime) || getCurrentDateTimeLocal(),
        no_of_incidents:
          data.no_of_incidents !== null && data.no_of_incidents !== undefined
            ? data.no_of_incidents
            : 0,
      };

      loadedForm.total_duration =
        calculateDuration(
          loadedForm.link_down_datetime,
          loadedForm.link_up_datetime
        ) ||
        data.total_duration ||
        "";

      setForm(loadedForm);
    } catch (error) {
      console.error("Load record error:", error);
      alert("Failed to load record");
    } finally {
      setLoading(false);
    }
  };

  const applyAutofill = (master) => {
    if (!master) return;

    setForm((prev) => ({
      ...prev,
      zone: master.zone || prev.zone,
      branch: master.branch || prev.branch,
      district: master.district || prev.district,
      circuit_id: master.circuit_id || prev.circuit_id,
      upstream_provider: master.upstream_provider || prev.upstream_provider,
      nld_location: master.nld_location || prev.nld_location,
      nld_name: master.nld_name || prev.nld_name,
      infonet_nld_id: master.infonet_nld_id || prev.infonet_nld_id,
      bandwidth:
        master.bw_purchased_in_mbps !== null &&
        master.bw_purchased_in_mbps !== undefined
          ? String(master.bw_purchased_in_mbps)
          : prev.bandwidth,
      total_towers_connected:
        master.total_tower_connected !== null &&
        master.total_tower_connected !== undefined
          ? master.total_tower_connected
          : prev.total_towers_connected,
      failover_availability:
        master.failover_availability || prev.failover_availability,
      failover_status:
        prev.failover_status ||
        (master.failover_availability === "AVAILABLE" ? "UP" : "DOWN"),
      emp_id: master.emp_id || prev.emp_id,
      emp_name: master.emp_name || prev.emp_name,
      no_of_incidents:
        master.next_incident_count !== null &&
        master.next_incident_count !== undefined
          ? master.next_incident_count
          : prev.no_of_incidents,
    }));
  };

  const lookupMasterData = async (nextForm) => {
    try {
      const params = {};

      if (nextForm.nld_name?.trim()) params.nld_name = nextForm.nld_name.trim();
      if (nextForm.nld_location?.trim()) {
        params.nld_location = nextForm.nld_location.trim();
      }
      if (nextForm.circuit_id?.trim()) {
        params.circuit_id = nextForm.circuit_id.trim();
      }
      if (nextForm.infonet_nld_id?.trim()) {
        params.infonet_nld_id = nextForm.infonet_nld_id.trim();
      }

      if (!Object.keys(params).length) return;

      setLookupLoading(true);
      const masterData = await lookupNldMasterData(params);

      if (masterData) {
        applyAutofill(masterData);
      }
    } catch (error) {
      console.error("Autofill error:", error);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;

    let nextForm = {
      ...form,
      [name]: value,
    };

    if (mode === "edit" && (name === "link_down_datetime" || name === "link_up_datetime")) {
      nextForm.total_duration = calculateDuration(
        nextForm.link_down_datetime,
        nextForm.link_up_datetime
      );
    }

    setForm(nextForm);

    if (["nld_name", "nld_location", "circuit_id", "infonet_nld_id"].includes(name) && value.trim() !== "") {
      await lookupMasterData(nextForm);
    }
  };

  const isAutoFilledField = (name) =>
    mode === "create" &&
    [
      "nld_location",
      "circuit_id",
      "branch",
      "zone",
      "district",
      "upstream_provider",
      "bandwidth",
      "infonet_nld_id",
      "total_towers_connected",
      "emp_id",
      "emp_name",
      "no_of_incidents",
    ].includes(name);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.link_down_datetime) {
      alert("Please enter LINK DOWN DATE & TIME");
      return;
    }

    if (
      mode === "edit" &&
      form.link_down_datetime &&
      form.link_up_datetime &&
      new Date(form.link_up_datetime) < new Date(form.link_down_datetime)
    ) {
      alert("LINK UP DATE & TIME cannot be earlier than LINK DOWN DATE & TIME");
      return;
    }

    try {
      setLoading(true);

      let payload;

      if (mode === "create") {
        payload = {
          nld_name: form.nld_name || "",
          nld_location: form.nld_location || "",
          operator_nld: form.operator_nld || "",
          circuit_id: form.circuit_id || "",
          ticket_id: form.ticket_id || "",
          sr_number: form.sr_number || "",
          branch: form.branch || "",
          zone: form.zone || "",
          district: form.district || "",
          upstream_provider: form.upstream_provider || "",
          bandwidth: form.bandwidth || "",
          infonet_nld_id: form.infonet_nld_id || "",
          total_towers_connected:
            form.total_towers_connected === "" || form.total_towers_connected === null
              ? null
              : Number(form.total_towers_connected),
          link_down_datetime: form.link_down_datetime || null,
          ticket_status: form.ticket_status || "",
          current_update: form.current_update || "",
          failover_availability: form.failover_availability || "",
          failover_status: form.failover_status || "",
          emp_id: form.emp_id || "",
          emp_name: form.emp_name || "",
          ticket_raised_department: form.ticket_raised_department || "",
          no_of_incidents:
            form.no_of_incidents === "" || form.no_of_incidents === null
              ? 0
              : Number(form.no_of_incidents),

          // DO NOT send close-related fields in create
          link_up_datetime: null,
          total_duration: "",
          issue_side: "",
          rfo: "",
          closing_comments: "",
          ticket_closed_department: "",
          updated_by_emp_id: "",
          updated_by_emp_name: "",
          department_ownership: "",
          poa: "",
        };

        await createNldRecord(payload);
        alert("Record saved successfully");
        navigate("/customer/nld-tracker");
        return;
      }

      payload = {
        ...form,
        no_of_incidents:
          form.no_of_incidents === "" || form.no_of_incidents === null
            ? 0
            : Number(form.no_of_incidents),
        total_towers_connected:
          form.total_towers_connected === "" || form.total_towers_connected === null
            ? null
            : Number(form.total_towers_connected),
        link_down_datetime: form.link_down_datetime || null,
        link_up_datetime: form.link_up_datetime || null,
        total_duration: calculateDuration(
          form.link_down_datetime,
          form.link_up_datetime
        ),
      };

      const res = await updateNldRecord(id, payload);
      alert("Record updated successfully");

      const finalStatus =
        res?.data?.record_status || (payload.link_up_datetime ? "CLOSED" : "OPEN");

      navigate(
        finalStatus === "CLOSED"
          ? "/customer/nld-tracker?status=CLOSED"
          : "/customer/nld-tracker"
      );
    } catch (error) {
      console.error("Save error:", error);
      alert(error?.response?.data?.message || "Failed to save record");
    } finally {
      setLoading(false);
    }
  };

  const addFields = [
    ["nld_name", "NLD NAME", "select"],
    ["nld_location", "NLD LOCATION", "text", true],
    ["operator_nld", "OPERATOR NLD", "text"],
    ["circuit_id", "CIRCUIT ID", "text", true],
    ["ticket_id", "TICKET ID", "text"],
    ["sr_number", "SR NUMBER", "text"],
    ["branch", "BRANCH", "text", true],
    ["zone", "ZONE", "text", true],
    ["district", "DISTRICT", "text", true],
    ["upstream_provider", "UPSTREAM PROVIDER", "text", true],
    ["bandwidth", "BANDWIDTH", "text", true],
    ["infonet_nld_id", "INFONET NLD ID", "text", true],
    ["total_towers_connected", "TOTAL TOWERS CONNECTED", "number", true],
    ["link_down_datetime", "LINK DOWN DATE & TIME", "datetime-local"],
    ["ticket_status", "TICKET STATUS", "select"],
    ["current_update", "CURRENT UPDATE", "textarea"],
    ["failover_availability", "FAILOVER AVAILABILITY", "select"],
    ["failover_status", "FAILOVER STATUS", "button-group"],
    ["emp_id", "EMP ID", "text", true],
    ["emp_name", "EMP NAME", "text", true],
    ["ticket_raised_department", "TICKET RAISED DEPARTMENT", "text"],
    ["no_of_incidents", "NO OF INCIDENTS", "number", true],
  ];

  const editFields = [
    ["nld_name", "NLD NAME", "text"],
    ["nld_location", "NLD LOCATION", "text"],
    ["operator_nld", "OPERATOR NLD", "text"],
    ["circuit_id", "CIRCUIT ID", "text"],
    ["ticket_id", "TICKET ID", "text"],
    ["sr_number", "SR NUMBER", "text"],
    ["branch", "BRANCH", "text"],
    ["zone", "ZONE", "text"],
    ["upstream_provider", "UPSTREAM PROVIDER", "text"],
    ["bandwidth", "BANDWIDTH", "text"],
    ["infonet_nld_id", "INFONET NLD ID", "text"],
    ["total_towers_connected", "TOTAL TOWERS CONNECTED", "number"],
    ["link_down_datetime", "LINK DOWN DATE & TIME", "datetime-local"],
    ["link_up_datetime", "LINK UP DATE & TIME", "datetime-local"],
    ["total_duration", "TOTAL DURATION", "text", true],
    ["ticket_status", "TICKET STATUS", "select"],
    ["current_update", "CURRENT UPDATE", "textarea"],
    ["failover_availability", "FAILOVER AVAILABILITY", "text"],
    ["failover_status", "FAILOVER STATUS", "text"],
    ["emp_id", "EMP ID", "text"],
    ["emp_name", "EMP NAME", "text"],
    ["ticket_raised_department", "TICKET RAISED DEPARTMENT", "text"],
    ["no_of_incidents", "NO OF INCIDENTS", "number"],
    ["issue_side", "ISSUE SIDE", "text"],
    ["rfo", "RFO", "textarea"],
    ["closing_comments", "CLOSING COMMENTS", "textarea"],
    ["ticket_closed_department", "TICKET CLOSED DEPARTMENT", "text"],
    ["updated_by_emp_id", "UPDATED BY EMP ID", "text"],
    ["updated_by_emp_name", "UPDATED BY EMP NAME", "text"],
    ["department_ownership", "DEPARTMENT OWNERSHIP", "text"],
    ["poa", "POA", "textarea"],
  ];

  const fields = mode === "edit" ? editFields : addFields;

  if (loading && mode === "edit") {
    return <div className="nld-empty-state">Loading...</div>;
  }

  return (
    <div className="nld-form-page">
      <div className="nld-form-modal nld-form-modal-standalone">
      <div className="nld-form-header">
        <button
          className="nld-form-close"
          type="button"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <div className="nld-form-title">
          <h1>{mode === "edit" ? "Edit NLD Record" : "Add NLD Record"}</h1>
          <p>
            {lookupLoading
              ? "Auto-filling from master data..."
              : "Fill the NLD details"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="nld-form-grid">
        {fields.map(([name, label, type, readOnly]) => (
          <div className="nld-form-group" key={name}>
            <label>{label}</label>

            {type === "textarea" ? (
              <textarea
                name={name}
                value={form[name] ?? ""}
                onChange={handleChange}
                rows="4"
                readOnly={readOnly || isAutoFilledField(name)}
              />
            ) : type === "select" ? (
              <select
                name={name}
                value={form[name] ?? ""}
                onChange={handleChange}
                disabled={readOnly || isAutoFilledField(name)}
              >
                <option value="">
                  {name === "nld_name" ? "Select NLD Name" : "Select"}
                </option>
                {(name === "nld_name"
                  ? formOptions.nldNames
                  : name === "ticket_status"
                  ? ["OPEN", "CLOSED"]
                  : name === "failover_availability"
                  ? formOptions.failoverAvailabilityOptions
                  : []
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : type === "button-group" ? (
              <div className="nld-button-group">
                {formOptions.failoverStatusOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`nld-choice-btn ${form[name] === option ? "active" : ""}`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        [name]: option,
                      }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type={type}
                name={name}
                value={form[name] ?? ""}
                onChange={handleChange}
                readOnly={readOnly || isAutoFilledField(name)}
              />
            )}
          </div>
        ))}
        </div>

        <div className="nld-form-actions">
          <button className="nld-form-secondary-btn" type="button" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button className="nld-form-primary-btn" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

export default FormPage;
