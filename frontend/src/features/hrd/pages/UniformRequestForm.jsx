import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../../css/hrd/UniformRequest.css";
import "../../../css/hrd/UniformRequestForm.css";
import {
  getZones,
  getBranchesByZone,
  getTeams,
  getDesignations,
} from "../../../services/employeeService";
import { createUniformRequest } from "../../../services/uniformService";
import { getEmployees as searchEmployees } from "../../../services/payslipService";

const REQUEST_TYPES = [
  { value: "UNIFORM", label: "Uniform Request" },
  { value: "BUSINESS_CARD", label: "Business Card Request" },
  { value: "ID_CARD", label: "ID Card Request" },
];

const initialForm = {
  request_type: "UNIFORM",
  zone_id: "",
  branch_id: "",
  team_id: "",
  designation_id: "",
  employee_id: "",
  employee_name: "",
  designation: "",
  department: "",
  mobile_no: "",
  shirt_size: "",
  pant_size: "",
  tshirt_size: "",
  blazer_size: "",
  shoe_size: "",
  quantity: 1,
  remarks: "",
};

function UniformRequestForm() {
  const navigate = useNavigate();

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [form, setForm] = useState(initialForm);

  const resetFormState = (requestType = initialForm.request_type) => {
    setForm({
      ...initialForm,
      request_type: requestType,
    });
    setSelectedEmpId("");
    setBranches([]);
    setDesignations([]);
  };

  useEffect(() => {
    loadZones();
    loadTeams();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const searchText = String(form.employee_id || "").trim();

      if (searchText.length < 2 || searchText === selectedEmpId) {
        setEmployees([]);
        return;
      }

      try {
        setLoadingEmployees(true);
        const res = await searchEmployees({ search: searchText, limit: 10 });
        setEmployees(res.data?.data || []);
      } catch (error) {
        console.error("Error searching employees:", error);
        toast.error("Failed to search employees");
      } finally {
        setLoadingEmployees(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.employee_id, selectedEmpId]);

  useEffect(() => {
    if (form.zone_id) {
      loadBranches(form.zone_id);
    } else {
      setBranches([]);
      setForm((prev) => ({
        ...prev,
        branch_id: "",
      }));
    }
  }, [form.zone_id]);

  useEffect(() => {
    if (form.team_id) {
      loadDesignations(form.team_id);
    } else {
      setDesignations([]);
      setForm((prev) => ({
        ...prev,
        designation_id: "",
        designation: "",
      }));
    }
  }, [form.team_id]);

  const loadZones = async () => {
    try {
      const res = await getZones();
      setZones(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading zones:", error);
      toast.error("Failed to load zones");
      setZones([]);
    }
  };

  const loadTeams = async () => {
    try {
      const res = await getTeams();
      setTeams(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading teams:", error);
      toast.error("Failed to load teams");
      setTeams([]);
    }
  };

  const loadBranches = async (zoneId) => {
    try {
      const res = await getBranchesByZone(zoneId);
      setBranches(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading branches:", error);
      toast.error("Failed to load branches");
      setBranches([]);
    }
  };

  const loadDesignations = async (teamId) => {
    try {
      const res = await getDesignations(teamId);
      setDesignations(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error("Error loading designations:", error);
      toast.error("Failed to load designations");
      setDesignations([]);
    }
  };

  const handleRequestTypeChange = (type) => {
    resetFormState(type);
    setEmployees([]);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === "zone_id") {
      setForm((prev) => ({
        ...prev,
        zone_id: value,
        branch_id: "",
      }));
      return;
    }

    if (name === "team_id") {
      const selectedTeam = teams.find(
        (team) => String(team.team_id) === String(value)
      );

      setForm((prev) => ({
        ...prev,
        team_id: value,
        department: selectedTeam?.name || "",
        designation_id: "",
        designation: "",
      }));
      return;
    }

    if (name === "designation_id") {
      const selectedDesignation = designations.find(
        (designation) =>
          String(designation.designation_id) === String(value)
      );

      setForm((prev) => ({
        ...prev,
        designation_id: value,
        designation: selectedDesignation?.name || "",
      }));
      return;
    }

    if (name === "employee_id") {
      setSelectedEmpId("");
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEmployeeSelect = async (employee) => {
    const nextZoneId = String(employee.zone_id || "");
    const nextBranchId = String(employee.branch_id || "");
    const nextTeamId = String(employee.team_id || "");
    const nextDesignationId = String(employee.designation_id || "");

    setForm((prev) => ({
      ...prev,
      employee_id: employee.emp_id || "",
      employee_name: employee.employee_name || "",
      department: employee.department || employee.team_name || "",
      team_id: nextTeamId,
      designation_id: nextDesignationId,
      designation:
        employee.designation_name || employee.designation || "",
      mobile_no:
        employee.phone ||
        employee.mobile_no ||
        employee.mobile ||
        "",
      zone_id: nextZoneId,
      branch_id: nextBranchId,
    }));

    setSelectedEmpId(employee.emp_id || "");
    setEmployees([]);

    if (nextZoneId) {
      await loadBranches(nextZoneId);
    } else {
      setBranches([]);
    }

    if (nextTeamId) {
      await loadDesignations(nextTeamId);
    } else {
      setDesignations([]);
    }
  };

  const validateForm = () => {
    if (!form.request_type) return "Request type is required";
    if (!form.zone_id) return "Zone is required";
    if (!form.branch_id) return "Branch is required";
    if (!form.employee_id.trim()) return "Employee ID is required";
    if (!form.employee_name.trim()) return "Employee Name is required";

    if (form.request_type === "UNIFORM") {
      if (!form.shirt_size.trim()) return "Shirt size is required";
      if (!form.pant_size.trim()) return "Pant size is required";
    }

    if (!form.quantity || Number(form.quantity) < 1) {
      return "Quantity must be at least 1";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errorMessage = validateForm();
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }

    try {
      setSaving(true);

      const payload = {
        request_type: form.request_type,
        zone_id: Number(form.zone_id),
        branch_id: Number(form.branch_id),
        employee_id: form.employee_id.trim(),
        employee_name: form.employee_name.trim(),
        designation: form.designation.trim(),
        department: form.department.trim(),
        mobile_no: form.mobile_no.trim(),
        shirt_size:
          form.request_type === "UNIFORM" ? form.shirt_size.trim() : null,
        pant_size:
          form.request_type === "UNIFORM" ? form.pant_size.trim() : null,
        tshirt_size:
          form.request_type === "UNIFORM" ? form.tshirt_size.trim() : null,
        blazer_size:
          form.request_type === "UNIFORM" ? form.blazer_size.trim() : null,
        shoe_size:
          form.request_type === "UNIFORM" ? form.shoe_size.trim() : null,
        quantity: Number(form.quantity || 1),
        remarks: form.remarks.trim(),
      };

      const res = await createUniformRequest(payload);

      if (res?.status === 200 || res?.status === 201) {
        toast.success("Request saved successfully");
        resetFormState();
        navigate("/hrd/uniform");
      } else {
        toast.error("Failed to save request");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error?.response?.data?.message || "Failed to save request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="uniform-page">
      <div className="uniform-form-container">
        <div className="uniform-form-card">
          <div className="uniform-form-top">
            <button
              type="button"
              className="back-btn"
              onClick={() => navigate("/hrd/uniform")}
            >
              Back
            </button>
            <h1>Create New Request</h1>
          </div>

          <form className="uniform-centered-form" onSubmit={handleSubmit}>
            <div className="full-span request-type-tabs">
              {REQUEST_TYPES.map((type) => (
                <button
                  type="button"
                  key={type.value}
                  className={`tab-btn ${
                    form.request_type === type.value ? "active" : ""
                  }`}
                  onClick={() => handleRequestTypeChange(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div>
              <label className="field-label">Employee ID</label>
              <input
                type="text"
                name="employee_id"
                className="field-input"
                value={form.employee_id}
                onChange={handleFormChange}
                placeholder="Enter Employee ID"
              />
              {loadingEmployees && (
                <small className="employee-search-helper">Searching employee...</small>
              )}
              {!loadingEmployees && employees.length > 0 && (
                <div className="employee-search-results">
                  {employees.map((employee) => (
                    <button
                      type="button"
                      key={employee.id}
                      className="employee-search-option"
                      onClick={() => handleEmployeeSelect(employee)}
                    >
                      {employee.emp_id} - {employee.employee_name}
                      {employee.department ? ` - ${employee.department}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="field-label">Employee Name</label>
              <input
                type="text"
                name="employee_name"
                className="field-input"
                value={form.employee_name}
                placeholder="Employee name will autofill"
                disabled
              />
            </div>

            <div>
              <label className="field-label">Team</label>
              <select
                name="team_id"
                className="field-input"
                value={form.team_id}
                onChange={handleFormChange}
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.team_id} value={team.team_id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Designation</label>
              <select
                name="designation_id"
                className="field-input"
                value={form.designation_id}
                onChange={handleFormChange}
                disabled={!form.team_id}
              >
                <option value="">Select Designation</option>
                {designations.map((designation) => (
                  <option
                    key={designation.designation_id}
                    value={designation.designation_id}
                  >
                    {designation.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Zone</label>
              <select
                name="zone_id"
                className="field-input"
                value={form.zone_id}
                onChange={handleFormChange}
              >
                <option value="">Select Zone</option>
                {zones.map((zone) => (
                  <option key={zone.zone_id} value={zone.zone_id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Branch</label>
              <select
                name="branch_id"
                className="field-input"
                value={form.branch_id}
                onChange={handleFormChange}
                disabled={!form.zone_id}
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.branch_id} value={branch.branch_id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Mobile No</label>
              <input
                type="text"
                name="mobile_no"
                className="field-input"
                value={form.mobile_no}
                placeholder="Mobile number will autofill"
                disabled
              />
            </div>

            {(form.request_type === "BUSINESS_CARD" ||
              form.request_type === "ID_CARD") && (
              <div>
                <label className="field-label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  name="quantity"
                  className="field-input"
                  value={form.quantity}
                  onChange={handleFormChange}
                />
              </div>
            )}

            {form.request_type === "UNIFORM" && (
              <>
                <div>
                  <label className="field-label">Shirt Size</label>
                  <input
                    type="text"
                    name="shirt_size"
                    className="field-input"
                    value={form.shirt_size}
                    onChange={handleFormChange}
                    placeholder="e.g. 40"
                  />
                </div>

                <div>
                  <label className="field-label">Pant Size</label>
                  <input
                    type="text"
                    name="pant_size"
                    className="field-input"
                    value={form.pant_size}
                    onChange={handleFormChange}
                    placeholder="e.g. 32"
                  />
                </div>

                <div>
                  <label className="field-label">T-Shirt Size</label>
                  <input
                    type="text"
                    name="tshirt_size"
                    className="field-input"
                    value={form.tshirt_size}
                    onChange={handleFormChange}
                    placeholder="e.g. M / L / XL"
                  />
                </div>

                <div>
                  <label className="field-label">Blazer Size</label>
                  <input
                    type="text"
                    name="blazer_size"
                    className="field-input"
                    value={form.blazer_size}
                    onChange={handleFormChange}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="field-label">Shoe Size</label>
                  <input
                    type="text"
                    name="shoe_size"
                    className="field-input"
                    value={form.shoe_size}
                    onChange={handleFormChange}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="field-label">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    name="quantity"
                    className="field-input"
                    value={form.quantity}
                    onChange={handleFormChange}
                  />
                </div>
              </>
            )}

            <div className="full-span">
              <label className="field-label">Remarks</label>
              <textarea
                name="remarks"
                className="field-input field-textarea"
                value={form.remarks}
                onChange={handleFormChange}
                placeholder="Enter remarks if any"
              />
            </div>

            <div className="full-span form-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => navigate("/hrd/uniform")}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="full-submit-btn"
                disabled={saving}
              >
                {saving ? "Saving..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UniformRequestForm;
