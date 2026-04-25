import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import MasterTable from "./MasterTable";
import EmployeeBulkUpload from "./EmployeeBulkUpload";
import ManagerMappingMaster from "./ManagerMappingMaster";
import ScopeOwnerMappingMaster from "./ScopeOwnerMappingMaster";
import * as masterService from "../../../services/masterServices";
import {
  bulkUploadEmployees,
  downloadEmployeeBulkTemplate,
} from "../../../services/employeeService";
import { toast } from "react-toastify";
import { FaTimes } from "react-icons/fa";
import styles from "../../../css/masters/ItemMaster.module.css";
import { getAuthItem } from "../../../utils/auth";
import { resolveAssetUrl } from "../../../config/apiConfig";

export default function ItemMaster() {
  const employeeTemplateFields = [
    "emp_id",
    "joining_status",
    "name",
    "father_name",
    "gender",
    "dob",
    "email",
    "phone",
    "emergency_contact",
    "password",
    "marital_status",
    "experience",
    "role",
    "team",
    "designation",
    "manager_emp_id",
    "primary_branch",
    "zone",
    "qualification",
    "joining_date",
    "permanent_address",
    "temporary_address",
    "status",
    "crm_branch_access",
    "ticket_lead_branch_access",
    "erp_area_access",
  ];

  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [types, setTypes] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [areas, setAreas] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [hrManagerSignInfo, setHrManagerSignInfo] = useState({
    exists: false,
    fileName: "",
    url: "",
  });
  const [selectedHrManagerSign, setSelectedHrManagerSign] = useState(null);
  const [selectedHrManagerSignPreview, setSelectedHrManagerSignPreview] = useState("");
  const [currentSignatureVisible, setCurrentSignatureVisible] = useState(true);
  const [isHrManagerSignLoading, setIsHrManagerSignLoading] = useState(false);
  const [isHrManagerSignUploading, setIsHrManagerSignUploading] = useState(false);
  const [isHrManagerSignDeleting, setIsHrManagerSignDeleting] = useState(false);
  const [signatureViewerSrc, setSignatureViewerSrc] = useState("");
  const currentRole = String(getAuthItem("role") || "").trim().toUpperCase();
  const canManageHrManagerSign = ["ADMIN", "SUPER_ADMIN"].includes(currentRole);
  const showToast = (msg) => toast.success(msg);

  const getSafe = (res) => res?.data || res || [];

  const loadAll = useCallback(async () => {
    try {
      const [z, b, t] = await Promise.all([
        masterService.getZones(),
        masterService.getBranches(),
        masterService.getTeams()
      ]);

      setZones(getSafe(z));
      setBranches(getSafe(b));
      setTeams(getSafe(t));
    } catch (err) {
      console.error("Load error:", err);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedHrManagerSign) {
      setSelectedHrManagerSignPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedHrManagerSign);
    setSelectedHrManagerSignPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedHrManagerSign]);

const loadTypes = async () => {
  try {
    const res = await masterService.getTicketTypes();
    setTypes(res.data || []);
  } catch (err) {
    console.error("Type load error:", err);
  }
};

const loadSubtypes = async (typeId) => {
  if (!typeId) return setSubtypes([]);

  try {
    const res = await masterService.getSubtypesByType(typeId);
    setSubtypes(res.data || []);
  } catch (err) {
    console.error("Subtype load error:", err);
  }
};

const loadAreas = async (branchId) => {
  if (!branchId) {
    setAreas([]);
    return;
  }

  try {
    const res = await masterService.getAreasByBranch(branchId);
    setAreas(res.data || []);
  } catch (err) {
    console.error("Area load error:", err);
    setAreas([]);
  }
};

const handleBranchChange = (branchId) => {
  const id = Number(branchId);
  setSelectedBranch(id);
  loadAreas(id);

  setActiveTab("Area");
};

const handleTypeChange = (id) => {
  setSelectedType(id);
  loadSubtypes(id);

  setActiveTab("Subtype");
};

useEffect(() => {
  loadTypes();
}, []);

  const loadHrManagerSign = useCallback(async () => {
    if (!canManageHrManagerSign) return;

    try {
      setIsHrManagerSignLoading(true);
      const res = await masterService.getHrManagerSign();
      setHrManagerSignInfo(res.data || { exists: false, fileName: "", url: "" });
    } catch (err) {
      console.error("HR manager sign load error:", err);
      toast.error("Failed to load HR manager signature");
    } finally {
      setIsHrManagerSignLoading(false);
    }
  }, [canManageHrManagerSign]);

  useEffect(() => {
    loadHrManagerSign();
  }, [loadHrManagerSign]);

  useEffect(() => {
    setCurrentSignatureVisible(true);
  }, [hrManagerSignInfo.url, hrManagerSignInfo.fileName]);

  const loadDesignation = async (teamId) => {
    if (!teamId) {
      setDesignations([]);
      return;
    }

    try {
      const res = await masterService.getDesignationsByTeam(Number(teamId));
      setDesignations(getSafe(res));
    } catch (err) {
      console.error(err);
    }
  };

  const handleTeamChange = (teamId) => {
    const id = Number(teamId);
    setSelectedTeam(id);
    loadDesignation(id);

    setActiveTab("Designation");
  };

  const refresh = (teamId) => {
    loadAll();
    const id = teamId || selectedTeam;
    if (id) loadDesignation(id);
  };

  const handleHrManagerSignSelect = (event) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setSelectedHrManagerSign(null);
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (file.type !== "image/png" || ext !== "png") {
      toast.error("Only PNG file is allowed");
      event.target.value = "";
      setSelectedHrManagerSign(null);
      return;
    }

    setSelectedHrManagerSign(file);
  };

  const handleUploadHrManagerSign = async () => {
    if (!selectedHrManagerSign) {
      toast.error("Please select a PNG file");
      return;
    }

    try {
      setIsHrManagerSignUploading(true);
      const formData = new FormData();
      formData.append("file", selectedHrManagerSign);
      await masterService.uploadHrManagerSign(formData);
      showToast("HR manager signature uploaded successfully");
      setSelectedHrManagerSign(null);
      await loadHrManagerSign();
    } catch (err) {
      console.error("HR manager sign upload error:", err);
      toast.error(err.response?.data?.message || "Failed to upload HR manager signature");
    } finally {
      setIsHrManagerSignUploading(false);
    }
  };

  const handleDeleteHrManagerSign = async () => {
    const confirmed = window.confirm("Delete the current HR manager signature?");
    if (!confirmed) return;

    try {
      setIsHrManagerSignDeleting(true);
      await masterService.deleteHrManagerSign();
      showToast("HR manager signature deleted successfully");
      await loadHrManagerSign();
    } catch (err) {
      console.error("HR manager sign delete error:", err);
      toast.error(err.response?.data?.message || "Failed to delete HR manager signature");
    } finally {
      setIsHrManagerSignDeleting(false);
    }
  };

  const currentHrManagerSignUrl = resolveAssetUrl(
    hrManagerSignInfo.url || hrManagerSignInfo.fileName,
    "uploads/template/hr-manager-sign"
  );

  return (
    <div className={styles.container}>

      <div className={styles.quickAccessCard}>
        <div>
          <h3 className={styles.quickAccessTitle}>Payslip Operations</h3>
          {/* <p className={styles.quickAccessText}>
            Use the optimized payslip workspace for month-end processing, fresh PDF generation,
            bulk review, and one-click editing from the dashboard.
          </p> */}
        </div>
        <div className={styles.quickAccessActions}>
          <EmployeeBulkUpload
            triggerLabel="Offer Letter Bulk Upload"
            modalTitle="Bulk Upload Offer Letters"
            note="Upload `.csv`, `.xlsx`, or `.xls` to import existing offer letters in bulk. Use zone and branch names or ids, and the system will generate the PDF with the current template for each successful row."
            templateFields={[
              "employee_name",
              "email",
              "phone",
              "zone",
              "branch",
              "designation",
              "team_name",
              "doj",
              "gender",
              "marital_status",
              "grade",
              "probation_period",
              "gross_pay",
              "insurance",
            ]}
            templateFileName="offer-letter-bulk-upload-template.csv"
            errorReportFileName="offer-letter-bulk-upload-errors.csv"
            downloadTemplate={masterService.downloadOfferLetterBulkTemplate}
            uploadAction={masterService.bulkUploadOfferLetters}
            insertedColumns={[
              { key: "row_number", label: "Row" },
              { key: "employee_name", label: "Employee" },
              { key: "document_id", label: "Document ID" },
              { key: "branch", label: "Branch" },
            ]}
            failedColumns={[
              { key: "row_number", label: "Row" },
              { key: "employee_name", label: "Employee" },
              { key: "branch", label: "Branch" },
              { key: "error", label: "Error" },
            ]}
            onUploaded={() => {
              showToast("Offer letter bulk upload completed");
            }}
          />
          <EmployeeBulkUpload
            triggerLabel="Bulk Payslip Upload"
            modalTitle="Bulk Upload Payslips"
            note="Upload `.csv`, `.xlsx`, or `.xls` to create payslips and generate PDFs in bulk. Use one row per employee for the selected payroll month."
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
            downloadTemplate={masterService.downloadPayslipBulkTemplate}
            uploadAction={masterService.bulkUploadPayslips}
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
              showToast("Payslip bulk upload completed");
            }}
          />
          <Link to="/hrd/payslip" className={styles.bulkTrigger}>
          Payslip Dashboard
          </Link>
        </div>
      </div>

      {canManageHrManagerSign && (
        <div className={styles.signatureCard}>
          <div className={styles.signatureHeader}>
            <div>
              <h3 className={styles.quickAccessTitle}>HR Manager Signature</h3>
              <p className={styles.signatureText}>
                Upload only one PNG file for relieving-letter HR sign. Backend will save it as
                <strong> hr_manager_sign.png</strong>.
              </p>
            </div>
            <div className={styles.signatureActions}>
              <label className={styles.bulkTrigger}>
                Select PNG
                <input
                  type="file"
                  accept=".png,image/png"
                  className={styles.hiddenFileInput}
                  onClick={(event) => {
                    event.target.value = null;
                  }}
                  onChange={handleHrManagerSignSelect}
                />
              </label>
              <button
                type="button"
                className={styles.bulkTrigger}
                onClick={handleUploadHrManagerSign}
                disabled={!selectedHrManagerSign || isHrManagerSignUploading}
              >
                {isHrManagerSignUploading ? "Uploading..." : "Upload"}
              </button>
              <button
                type="button"
                className={styles.signatureDeleteBtn}
                onClick={handleDeleteHrManagerSign}
                disabled={!hrManagerSignInfo.exists || isHrManagerSignDeleting}
              >
                {isHrManagerSignDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>

          <div className={styles.signatureGrid}>
            <div className={styles.signaturePanel}>
              <span className={styles.signatureLabel}>Selected PNG Preview</span>
              {selectedHrManagerSignPreview ? (
                <>
                  <img
                    src={selectedHrManagerSignPreview}
                    alt="Selected HR manager signature preview"
                    className={styles.signaturePreview}
                  />
                  <p className={styles.signatureMeta}>
                    {selectedHrManagerSign?.name} will be uploaded as `hr_manager_sign.png`
                  </p>
                </>
              ) : (
                <p className={styles.signatureEmpty}>
                  Select a PNG file to preview before upload.
                </p>
              )}
            </div>

            <div className={styles.signaturePanel}>
              <span className={styles.signatureLabel}>Current Uploaded Signature</span>
              {isHrManagerSignLoading ? (
                <p className={styles.signatureEmpty}>Loading current signature...</p>
              ) : hrManagerSignInfo.exists && currentHrManagerSignUrl && currentSignatureVisible ? (
                <>
                  <img
                    src={currentHrManagerSignUrl}
                    alt="Current HR manager signature"
                    className={styles.signaturePreview}
                    onError={() => setCurrentSignatureVisible(false)}
                  />
                  <div className={styles.signaturePreviewActions}>
                    <button
                      type="button"
                      className={styles.bulkTrigger}
                      onClick={() => setSignatureViewerSrc(currentHrManagerSignUrl)}
                    >
                      Preview
                    </button>
                  </div>
                  <p className={styles.signatureMeta}>{hrManagerSignInfo.fileName}</p>
                </>
              ) : hrManagerSignInfo.exists ? (
                <p className={styles.signatureEmpty}>
                  Current signature exists, but the image could not be loaded. Check the production uploads path.
                </p>
              ) : (
                <p className={styles.signatureEmpty}>
                  No HR manager signature uploaded yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ZONE */}
      <MasterTable
        title="Zone"
        data={zones}
        fields={["zone_name"]}
        isOpen={activeTab === "Zone"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "Zone" ? "" : "Zone"))
        }
        onAdd={async (d) => {
          await masterService.createZone(d);
          showToast("Zone Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateZone(id, d);
          showToast("Zone Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteZone(id);
          showToast("Zone Deleted");
        }}
        refresh={refresh}
      />

      {/* BRANCH */}
      <MasterTable
        title="Branch"
        data={branches}
        fields={["branch_name", "short_name"]}
        parentOptions={zones}
        parentKey="zone_id"
        headerActions={
          <EmployeeBulkUpload
            triggerLabel="Bulk Upload"
            modalTitle="Bulk Upload Branches"
            note="Upload `.csv`, `.xlsx`, or `.xls`. Use zone name or zone id in the `zone` column. Short name is optional."
            templateFields={["branch_name", "short_name", "zone"]}
            templateFileName="branch-bulk-upload-template.csv"
            errorReportFileName="branch-bulk-upload-errors.csv"
            downloadTemplate={masterService.downloadBranchBulkTemplate}
            uploadAction={masterService.bulkUploadBranches}
            insertedColumns={[
              { key: "row_number", label: "Row" },
              { key: "name", label: "Branch" },
              { key: "short_name", label: "Short Name" },
              { key: "zone", label: "Zone" },
            ]}
            failedColumns={[
              { key: "row_number", label: "Row" },
              { key: "name", label: "Branch" },
              { key: "zone", label: "Zone" },
              { key: "error", label: "Error" },
            ]}
            onUploaded={() => {
              loadAll();
              showToast("Branch bulk upload completed");
            }}
          />
        }
        isOpen={activeTab === "Branch"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "Branch" ? "" : "Branch"))
        }
        onAdd={async (d) => {
          await masterService.createBranch(d);
          showToast("Branch Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateBranch(id, d);
          showToast("Branch Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteBranch(id);
          showToast("Branch Deleted");
        }}
        refresh={refresh}
      />

      {/* AREA FILTER */}
      <div className={styles.teamFilter}>
        <label>Select Branch for Area</label>

        <select
          value={selectedBranch || ""}
          onChange={(e) => handleBranchChange(e.target.value)}
        >
          <option value="">Select Branch</option>
          {branches.map((b) => (
            <option key={b.branch_id} value={b.branch_id}>
              {b.name || b.branch_name}
            </option>
          ))}
        </select>
      </div>

      {/* AREA */}
      <MasterTable
        title="Area"
        data={areas}
        fields={["area_name"]}
        parentOptions={branches}
        parentKey="branch_id"
        headerActions={
          <EmployeeBulkUpload
            triggerLabel="Bulk Upload"
            modalTitle="Bulk Upload Areas"
            note="Upload `.csv`, `.xlsx`, or `.xls`. Use branch name, branch short name, or branch id in the `branch` column."
            templateFields={["area_name", "branch"]}
            templateFileName="area-bulk-upload-template.csv"
            errorReportFileName="area-bulk-upload-errors.csv"
            downloadTemplate={masterService.downloadAreaBulkTemplate}
            uploadAction={masterService.bulkUploadAreas}
            insertedColumns={[
              { key: "row_number", label: "Row" },
              { key: "name", label: "Area" },
              { key: "branch", label: "Branch" },
              { key: "zone", label: "Zone" },
            ]}
            failedColumns={[
              { key: "row_number", label: "Row" },
              { key: "name", label: "Area" },
              { key: "branch", label: "Branch" },
              { key: "error", label: "Error" },
            ]}
            onUploaded={() => {
              loadAll();
              if (selectedBranch) loadAreas(selectedBranch);
              showToast("Area bulk upload completed");
            }}
          />
        }
        isOpen={activeTab === "Area"}
        onToggle={() => setActiveTab("Area")}
        onAdd={async (d) => {
          await masterService.createArea(d);
          showToast("Area Added");
          loadAreas(selectedBranch);
        }}
        onUpdate={async (id, d) => {
          await masterService.updateArea(id, d);
          showToast("Area Updated");
          loadAreas(selectedBranch);
        }}
        onDelete={async (id) => {
          await masterService.deleteArea(id);
          showToast("Area Deleted");
          loadAreas(selectedBranch);
        }}
        refresh={() => loadAreas(selectedBranch)}
      />

      {/* TEAM */}
      <MasterTable
        title="Team"
        data={teams}
        fields={["team_name"]}
        headerActions={
          <EmployeeBulkUpload
            triggerLabel="Bulk Upload"
            modalTitle="Bulk Upload Teams"
            note="Upload `.csv`, `.xlsx`, or `.xls`. Team upload uses one field only: `team_name`."
            templateFields={["team_name"]}
            templateFileName="team-bulk-upload-template.csv"
            errorReportFileName="team-bulk-upload-errors.csv"
            downloadTemplate={masterService.downloadTeamBulkTemplate}
            uploadAction={masterService.bulkUploadTeams}
            insertedColumns={[
              { key: "row_number", label: "Row" },
              { key: "name", label: "Team" },
            ]}
            failedColumns={[
              { key: "row_number", label: "Row" },
              { key: "name", label: "Team" },
              { key: "error", label: "Error" },
            ]}
            onUploaded={() => {
              loadAll();
              showToast("Team bulk upload completed");
            }}
          />
        }
        isOpen={activeTab === "Team"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "Team" ? "" : "Team"))
        }
        onAdd={async (d) => {
          await masterService.createTeam(d);
          showToast("Team Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateTeam(id, d);
          showToast("Team Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteTeam(id);
          showToast("Team Deleted");
        }}
        refresh={refresh}
      />

      {/* TEAM FILTER */}
      <div className={styles.teamFilter}>
        <label>Select Team for Designation</label>

        <select
          value={selectedTeam || ""}
          onChange={(e) => handleTeamChange(e.target.value)}
        >
          <option value="">Select Team</option>

          {teams.map((t, i) => (
            <option key={t.team_id ?? i} value={t.team_id}>
              {t.team_name || t.name}
            </option>
          ))}
        </select>
      </div>

      {/* DESIGNATION */}
      <MasterTable
        title="Designation"
        data={designations}
        fields={["designation_name", "level"]}
        parentOptions={teams}
        parentKey="team_id"
        headerActions={
          <>
            <EmployeeBulkUpload
              triggerLabel="Designation Bulk"
              modalTitle="Bulk Upload Designations"
              note="Upload `.csv`, `.xlsx`, or `.xls`. Use `designation_name`, `team`, and `level`. Team can be team name or team id."
              templateFields={["designation_name", "team", "level"]}
              templateFileName="designation-bulk-upload-template.csv"
              errorReportFileName="designation-bulk-upload-errors.csv"
              downloadTemplate={masterService.downloadDesignationBulkTemplate}
              uploadAction={masterService.bulkUploadDesignations}
              insertedColumns={[
                { key: "row_number", label: "Row" },
                { key: "name", label: "Designation" },
                { key: "team", label: "Team" },
                { key: "level", label: "Level" },
              ]}
              failedColumns={[
                { key: "row_number", label: "Row" },
                { key: "name", label: "Designation" },
                { key: "team", label: "Team" },
                { key: "level", label: "Level" },
                { key: "error", label: "Error" },
              ]}
              onUploaded={() => {
                loadAll();
                if (selectedTeam) loadDesignation(selectedTeam);
                showToast("Designation bulk upload completed");
              }}
            />
            <EmployeeBulkUpload
              triggerLabel="Employee Bulk"
              modalTitle="Bulk Upload Employees"
              note="Upload `.csv`, `.xlsx`, or `.xls`. For access columns, use values separated by `|`. Example: `Namakkal|Rasipuram`. Use `ALL` when a user should get all CRM branches, all Ticket/Lead branches, or all ERP areas."
              templateFields={employeeTemplateFields}
              templateFileName="employee-bulk-upload-template.csv"
              errorReportFileName="employee-bulk-upload-errors.csv"
              downloadTemplate={downloadEmployeeBulkTemplate}
              uploadAction={bulkUploadEmployees}
              insertedColumns={[
                { key: "row_number", label: "Row" },
                { key: "emp_id", label: "Emp ID" },
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
              ]}
              failedColumns={[
                { key: "row_number", label: "Row" },
                { key: "emp_id", label: "Emp ID" },
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "error", label: "Error" },
              ]}
              onUploaded={() => {
                showToast("Employee bulk upload completed");
              }}
            />
          </>
        }
        isOpen={activeTab === "Designation"}
        onToggle={() =>
          setActiveTab((prev) =>
            prev === "Designation" ? "" : "Designation"
          )
        }
        onAdd={async (d) => {
          await masterService.createDesignation(d);
          showToast("Designation Added");
        }}
        onUpdate={async (id, d) => {
          await masterService.updateDesignation(id, d);
          showToast("Designation Updated");
        }}
        onDelete={async (id) => {
          await masterService.deleteDesignation(id);
          showToast("Designation Deleted");
        }}
        refresh={(teamId) => refresh(teamId || selectedTeam)}
      />

      <ManagerMappingMaster
        isOpen={activeTab === "ManagerMapping"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "ManagerMapping" ? "" : "ManagerMapping"))
        }
        showToast={showToast}
      />

      <ScopeOwnerMappingMaster
        isOpen={activeTab === "ScopeOwnerMapping"}
        onToggle={() =>
          setActiveTab((prev) => (prev === "ScopeOwnerMapping" ? "" : "ScopeOwnerMapping"))
        }
        showToast={showToast}
      />

      <MasterTable
  title="Ticket Type"
  data={types}
  fields={["type_name"]}
  isOpen={activeTab === "Type"}
  onToggle={() =>
  setActiveTab((prev) => (prev === "Type" ? "" : "Type"))
}
  onAdd={async (d) => {
    await masterService.createTicketType(d);
    showToast("Type Added");
    loadTypes();
  }}
  onUpdate={async (id, d) => {
    await masterService.updateTicketType(id, d);
    showToast("Type Updated");
    loadTypes();
  }}
  onDelete={async (id) => {
    await masterService.deleteTicketType(id);
    showToast("Type Deleted");
    loadTypes();
  }}
  refresh={loadTypes}
/>

<div className={styles.teamFilter}>
  <label>Select Type for Subtype</label>

  <select
    value={selectedType || ""}
    onChange={(e) => handleTypeChange(e.target.value)}
  >
    <option value="">Select Type</option>

{types.map((t) => (
  <option key={t.type_id} value={t.type_id}>
    {t.name || t.type_name}
  </option>
))}
  </select>
</div>

<MasterTable
  title="Ticket Subtype"
  data={subtypes}
  fields={["subtype_name"]}
  parentOptions={types}
  parentKey="type_id"
  isOpen={activeTab === "Subtype"}
  onToggle={() =>
  setActiveTab((prev) => (prev === "Subtype" ? "" : "Subtype"))
}
  onAdd={async (d) => {
    await masterService.createSubtype(d);
    showToast("Subtype Added");
    loadSubtypes(selectedType);
  }}
  onUpdate={async (id, d) => {
    await masterService.updateSubtype(id, d);
    showToast("Subtype Updated");
    loadSubtypes(selectedType);
  }}
  onDelete={async (id) => {
    await masterService.deleteSubtype(id);
    showToast("Subtype Deleted");
    loadSubtypes(selectedType);
  }}
  refresh={() => loadSubtypes(selectedType)}
/>

      {signatureViewerSrc && (
        <div
          className={styles.signatureViewerOverlay}
          onClick={() => setSignatureViewerSrc("")}
          role="presentation"
        >
          <div
            className={styles.signatureViewerModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="HR manager signature preview"
          >
            <button
              type="button"
              className={styles.signatureViewerClose}
              onClick={() => setSignatureViewerSrc("")}
              aria-label="Close preview"
            >
              <FaTimes />
            </button>
            <img
              src={signatureViewerSrc}
              alt="HR manager signature enlarged preview"
              className={styles.signatureViewerImage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
