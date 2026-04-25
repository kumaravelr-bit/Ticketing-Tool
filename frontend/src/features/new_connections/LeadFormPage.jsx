import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { createLead, getLeadById, updateLead } from "../../services/newConnectionService";
import {
  createEmptyLead,
  DB_ACTIVITY_TYPES,
  DB_CONNECTION_STAGES,
  DB_CONNECTION_TYPES,
  DB_CUSTOMER_TYPES,
  DB_INTEREST_OPTIONS,
  DB_LEAD_REFS,
  DB_PAYMENT_MODES,
  DB_STATUS_OPTIONS,
  getLoggedInLeadOwner,
  normalizeLeadForForm,
  validateLeadForm,
} from "./leadFormUtils";
import SegmentedControl from "./SegmentedControl";
import FormField from "./FormField";
import LatLongMapField from "./LatLongMapField";
import formStyles from "../../css/new_connections/NewConnectionForm.module.css";
import createStyles from "../../css/new_connections/NewConnectionCreation.module.css";
import updateStyles from "../../css/new_connections/NewConnectionUpdate.module.css";
import { getAllDesignations, getBranches, getTeams } from "../../services/masterServices";
import { getZones } from "../../services/masterServices";
import { getEmployees } from "../../services/employeeService";

function LeadFormPage({ mode = "create" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = mode === "edit";
  const isViewMode = mode === "view";
  const isExistingLeadMode = isEditMode || isViewMode;
  const [form, setForm] = useState(createEmptyLead());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedZones, setLoadedZones] = useState([]);
  const [loadedBranches, setLoadedBranches] = useState([]);
  const [asmOptions, setAsmOptions] = useState([]);
  const [vendorMovementOptions, setVendorMovementOptions] = useState([]);
  const pageStyles = isExistingLeadMode ? updateStyles : createStyles;
  const pageTitle = isViewMode
    ? "New Connection Request Details"
    : isEditMode
      ? "Edit New Connection Request"
      : "New Connection Request Form";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const loadMasterOptions = async () => {
      try {
        const [zoneResponse, branchResponse, teamResponse, designationResponse, employeeResponse] =
          await Promise.all([
            getZones(),
            getBranches(),
            getTeams(),
            getAllDesignations(),
            getEmployees(),
          ]);

        const zones = Array.isArray(zoneResponse.data) ? zoneResponse.data : [];
        const branches = Array.isArray(branchResponse.data) ? branchResponse.data : [];
        const teams = Array.isArray(teamResponse.data) ? teamResponse.data : [];
        const designations = Array.isArray(designationResponse.data)
          ? designationResponse.data
          : [];
        const employees = Array.isArray(employeeResponse.data)
          ? employeeResponse.data
          : Array.isArray(employeeResponse.data?.rows)
            ? employeeResponse.data.rows
            : Array.isArray(employeeResponse.data?.activeEmployees)
              ? employeeResponse.data.activeEmployees
              : [];

        setLoadedZones(zones);
        setLoadedBranches(branches);

        const salesTeamIds = teams
          .filter((team) =>
            String(team.name || team.team_name || "")
              .trim()
              .toUpperCase() === "SALES"
          )
          .map((team) => String(team.team_id || team.id));

        const asmDesignationIds = designations
          .filter((designation) =>
            String(designation.name || designation.designation_name || "")
              .trim()
              .toUpperCase() === "ASM"
          )
          .map((designation) => String(designation.designation_id || designation.id));

        const vendorDesignationIds = designations
          .filter((designation) =>
            ["VENDOR SALES", "VENDOR COORDINATOR"].includes(
              String(designation.name || designation.designation_name || "")
                .trim()
                .toUpperCase()
            )
          )
          .map((designation) => String(designation.designation_id || designation.id));

        const salesEmployees = employees.filter((employee) => {
          const employeeStatus = String(employee.status || "").trim().toUpperCase();
          const employeeTeamId = String(employee.team_id || employee.teamId || "");
          const employeeTeamName = String(employee.team_name || employee.team || "")
            .trim()
            .toUpperCase();

          if (employeeStatus && employeeStatus !== "ACTIVE") {
            return false;
          }

          return salesTeamIds.includes(employeeTeamId) || employeeTeamName === "SALES";
        });

        const isAsmEmployee = (employee) => {
          const designationId = String(employee.designation_id || employee.designationId || "");
          const designationName = String(
            employee.designation_name || employee.designation || ""
          )
            .trim()
            .toUpperCase();

          return asmDesignationIds.includes(designationId) || designationName === "ASM";
        };

        const isVendorEmployee = (employee) => {
          const designationId = String(employee.designation_id || employee.designationId || "");
          const designationName = String(
            employee.designation_name || employee.designation || ""
          )
            .trim()
            .toUpperCase();

          return (
            vendorDesignationIds.includes(designationId) ||
            ["VENDOR SALES", "VENDOR COORDINATOR"].includes(designationName)
          );
        };

        const formatEmployeeOption = (employee) =>
          `${employee.emp_id || employee.employee_id || ""} - ${
            employee.name || employee.employee_name || ""
          }`.trim();

        const uniqueOptions = (options) => [...new Set(options.filter(Boolean))];

        setAsmOptions(
          uniqueOptions(salesEmployees.filter(isAsmEmployee).map(formatEmployeeOption))
        );

        setVendorMovementOptions(
          uniqueOptions(salesEmployees.filter(isVendorEmployee).map(formatEmployeeOption))
        );
      } catch {
        setLoadedZones([]);
        setLoadedBranches([]);
        setAsmOptions([]);
        setVendorMovementOptions([]);
      }
    };

    loadMasterOptions();
  }, []);

  useEffect(() => {
    if (!isExistingLeadMode || !id) {
      const owner = getLoggedInLeadOwner();
      setForm({
        ...createEmptyLead(),
        empId: owner.empId,
        empName: owner.empName,
        date: owner.date,
      });
      setErrors({});
      return;
    }

    const loadLead = async () => {
      try {
        setLoading(true);
        const data = await getLeadById(id);
        const owner = getLoggedInLeadOwner();
        const normalized = normalizeLeadForForm(data);
        setForm({
          ...normalized,
          empId: normalized.empId || owner.empId,
          empName: normalized.empName || owner.empName,
          date: normalized.date || owner.date,
        });
        setErrors({});
      } catch (error) {
        toast.error(error.response?.data?.message || "Unable to load new connection request");
      } finally {
        setLoading(false);
      }
    };

    loadLead();
  }, [id, isExistingLeadMode]);

  const zoneOptions = useMemo(
    () =>
      loadedZones
        .map((item) => item.zone_name || item.name || item.value || "")
        .filter(Boolean),
    [loadedZones]
  );

  const filteredBranches = useMemo(() => {
    if (!form.zone) {
      return loadedBranches;
    }

    const selectedZone = loadedZones.find(
      (zone) => (zone.zone_name || zone.name || zone.value || "") === form.zone
    );

    const selectedZoneId = String(selectedZone?.zone_id || selectedZone?.id || "");

    return loadedBranches.filter((branch) => {
      const branchZoneId = String(branch.zone_id || branch.zoneId || "");
      const branchZoneName = String(branch.zone_name || branch.zone || "").trim();
      return branchZoneId === selectedZoneId || branchZoneName === form.zone;
    });
  }, [form.zone, loadedBranches, loadedZones]);

  const branchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...filteredBranches
              .map((item) => item.branch_name || item.name || item.value || "")
              .filter(Boolean),
            form.branch,
          ].filter(Boolean)
        )
      ),
    [filteredBranches, form.branch]
  );
  const connectionBranchOptions = useMemo(
    () => Array.from(new Set([...branchOptions, form.connectionBranch].filter(Boolean))),
    [branchOptions, form.connectionBranch]
  );
  const asmSelectOptions = useMemo(
    () => Array.from(new Set([...asmOptions, form.moveToAsm].filter(Boolean))),
    [asmOptions, form.moveToAsm]
  );
  const vendorMovementSelectOptions = useMemo(
    () => Array.from(new Set([...vendorMovementOptions, form.vendorMovement].filter(Boolean))),
    [form.vendorMovement, vendorMovementOptions]
  );
  const hasAsmOptions = asmSelectOptions.length > 0;
  const hasVendorMovementOptions = vendorMovementSelectOptions.length > 0;

  const updateField = (key, value) => {
    if (isViewMode) {
      return;
    }

    setForm((previous) => {
      const applyTotals = (nextState) => {
        const planValue = Number(nextState.planValueWithoutGst || 0);
        const otcValue = Number(nextState.otcWithoutGst || 0);
        const depositValue = Number(nextState.depositWithoutGst || 0);

        return {
          ...nextState,
          totalRevenueWithoutGst:
            planValue || otcValue || depositValue
              ? String(planValue + otcValue + depositValue)
              : "",
        };
      };

      if (key === "zone") {
        const nextState = {
          ...previous,
          zone: value,
          branch: "",
          connectionBranch: "",
        };
        return applyTotals(nextState);
      }

      if (key === "branch") {
        const nextState = {
          ...previous,
          branch: value,
          connectionBranch:
            previous.connectionBranch && previous.connectionBranch !== value
              ? ""
              : previous.connectionBranch,
        };
        return applyTotals(nextState);
      }

      return applyTotals({ ...previous, [key]: value });
    });

    setErrors((previous) => ({ ...previous, [key]: "" }));
  };

  const goBackToList = () => {
    navigate("/customer-onboarding/lead-process");
  };

  const openEditMode = () => {
    if (!id) {
      return;
    }

    navigate(`/customer-onboarding/lead-process/edit/${id}`);
  };

  const submitForm = async () => {
    if (isViewMode) {
      return;
    }

    const owner = getLoggedInLeadOwner();
    const payload = {
      ...form,
      empId: form.empId || owner.empId,
      empName: form.empName || owner.empName,
      date: form.date || owner.date,
    };
    const nextErrors = validateLeadForm(payload);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      toast.error("Please fix the required fields");
      return;
    }

    try {
      setSaving(true);

      if (isEditMode && id) {
        await updateLead(id, payload);
        toast.success("New connection request updated successfully");
      } else {
        await createLead(payload);
        toast.success("New connection request created successfully");
      }

      goBackToList();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save new connection request");
    } finally {
      setSaving(false);
    }
  };

  const renderLeadRefFields = () => {
    if (form.leadRef === "CUSTOMER") {
      return (
        <div className={`${formStyles.grid} ${formStyles.gridTwo}`}>
          <FormField
            label="EX.CUSTOMER ID *"
            value={form.exCustomerId}
            onChange={(value) => updateField("exCustomerId", value)}
            error={errors.exCustomerId}
            readOnly={isViewMode}
          />
          <FormField
            label="EX.CUSTOMER NAME *"
            value={form.exCustomerName}
            onChange={(value) => updateField("exCustomerName", value)}
            error={errors.exCustomerName}
            readOnly={isViewMode}
          />
          <div className={formStyles.spanFull}>
            <FormField
              label="REMARKS"
              as="textarea"
              value={form.remarks}
              onChange={(value) => updateField("remarks", value)}
              readOnly={isViewMode}
            />
          </div>
        </div>
      );
    }

    if (form.leadRef === "TECH TEAM") {
      return (
        <div className={`${formStyles.grid} ${formStyles.gridTwo}`}>
          <FormField
            label="TECH ID *"
            value={form.techId}
            onChange={(value) => updateField("techId", value)}
            error={errors.techId}
            readOnly={isViewMode}
          />
          <FormField
            label="TECH NAME *"
            value={form.techName}
            onChange={(value) => updateField("techName", value)}
            error={errors.techName}
            readOnly={isViewMode}
          />
          <div className={formStyles.spanFull}>
            <FormField
              label="REMARKS"
              as="textarea"
              value={form.remarks}
              onChange={(value) => updateField("remarks", value)}
              readOnly={isViewMode}
            />
          </div>
        </div>
      );
    }

    return (
      <FormField
        label="REMARKS"
        as="textarea"
        value={form.remarks}
        onChange={(value) => updateField("remarks", value)}
        readOnly={isViewMode}
      />
    );
  };

  const renderStatusFields = () => {
    if (form.status === "FOLLOWUP") {
      return (
        <div className={`${formStyles.grid} ${formStyles.gridTwo}`}>
          <FormField
            label="NEXT FOLLOW DATE *"
            type="date"
            value={form.nextFollowDate}
            onChange={(value) => updateField("nextFollowDate", value)}
            error={errors.nextFollowDate}
            min={today}
            readOnly={isViewMode}
          />
          <FormField
            label="CURRENT UPDATES *"
            value={form.currentUpdates}
            onChange={(value) => updateField("currentUpdates", value)}
            error={errors.currentUpdates}
            readOnly={isViewMode}
          />
        </div>
      );
    }

    if (form.status === "ID CREATED") {
      return (
        <div className={`${formStyles.grid} ${formStyles.gridThree}`}>
          <FormField
            label="CUSTOMER ID *"
            value={form.customerId}
            onChange={(value) => updateField("customerId", value)}
            error={errors.customerId}
            readOnly={isViewMode}
          />
          <FormField
            label="PLAN *"
            value={form.plan}
            onChange={(value) => updateField("plan", value)}
            error={errors.plan}
            readOnly={isViewMode}
          />
          <FormField
            label="PLAN VALUE (WITHOUT GST) *"
            type="number"
            value={form.planValueWithoutGst}
            onChange={(value) => updateField("planValueWithoutGst", value)}
            error={errors.planValueWithoutGst}
            readOnly={isViewMode}
          />
          <div className={formStyles.spanFull}>
              <SegmentedControl
                label="Payment Mode"
                options={DB_PAYMENT_MODES}
                value={form.paymentMode}
                onChange={(value) => updateField("paymentMode", value)}
                disabled={isViewMode}
              />
            {errors.paymentMode ? <span className={formStyles.error}>{errors.paymentMode}</span> : null}
          </div>
          <FormField
            label="OTC (WITHOUT GST) *"
            type="number"
            value={form.otcWithoutGst}
            onChange={(value) => updateField("otcWithoutGst", value)}
            error={errors.otcWithoutGst}
            readOnly={isViewMode}
          />
          <FormField
            label="DEPOSIT (WITHOUT GST) *"
            type="number"
            value={form.depositWithoutGst}
            onChange={(value) => updateField("depositWithoutGst", value)}
            error={errors.depositWithoutGst}
            readOnly={isViewMode}
          />
          <FormField
            label="TOTAL REVENUE (WITHOUT GST) *"
            type="number"
            value={form.totalRevenueWithoutGst}
            onChange={() => {}}
            error={errors.totalRevenueWithoutGst}
            disabled
          />
        </div>
      );
    }

    if (form.status === "CANCELLED") {
      return (
        <FormField
          label="FEEDBACK *"
          as="textarea"
          value={form.feedback}
          onChange={(value) => updateField("feedback", value)}
          error={errors.feedback}
          readOnly={isViewMode}
        />
      );
    }

    return (
      <div className={`${formStyles.grid} ${formStyles.gridThree}`}>
        <FormField
          label="PAYMENT MODE *"
          as="select"
          options={DB_PAYMENT_MODES}
          value={form.paymentMode}
          onChange={(value) => updateField("paymentMode", value)}
          error={errors.paymentMode}
          readOnly={isViewMode}
        />
        <FormField
          label="OTC (WITHOUT GST) *"
          type="number"
          value={form.otcWithoutGst}
          onChange={(value) => updateField("otcWithoutGst", value)}
          error={errors.otcWithoutGst}
          readOnly={isViewMode}
        />
        <FormField
          label="DEPOSIT (WITHOUT GST) *"
          type="number"
          value={form.depositWithoutGst}
          onChange={(value) => updateField("depositWithoutGst", value)}
          error={errors.depositWithoutGst}
          readOnly={isViewMode}
        />
      </div>
    );
  };

  if (loading) {
    return <div className={formStyles.emptyState}>Loading new connection request details...</div>;
  }

  return (
    <div className={`${formStyles.pageShell} ${pageStyles.shellAccent}`}>
      <div className={`${formStyles.pageCard} ${pageStyles.pageAccent}`}>
        <div className={`${formStyles.pageHeader} ${pageStyles.headerAccent}`}>
          <button type="button" className={formStyles.buttonSecondary} onClick={goBackToList}>
            Back
          </button>
          <div className={formStyles.headerTitle}>
            <h1>{pageTitle}</h1>
          </div>
          <div className={formStyles.headerActions}>
            {isViewMode ? (
              <button type="button" className={formStyles.buttonPrimary} onClick={openEditMode}>
                Edit
              </button>
            ) : (
              <div className={formStyles.headerSpacer} />
            )}
          </div>
        </div>

        <div className={formStyles.body}>
          <div className={formStyles.sectionCard}>
            <div className={formStyles.sectionTitle}>Location Details</div>
            <div className={`${formStyles.grid} ${formStyles.gridTwo}`}>
              <FormField
                label="ZONE *"
                as={zoneOptions.length ? "select" : "input"}
                options={zoneOptions}
                value={form.zone}
                onChange={(value) => updateField("zone", value)}
                error={errors.zone}
                readOnly={isViewMode}
              />
              <FormField
                label="BRANCH *"
                as={branchOptions.length ? "select" : "input"}
                options={branchOptions}
                value={form.branch}
                onChange={(value) => updateField("branch", value)}
                error={errors.branch}
                disabled={(!form.zone && branchOptions.length > 0) || isViewMode}
                readOnly={isViewMode}
              />
              <div className={formStyles.spanFull}>
                <FormField
                  label="CONNECTION BRANCH *"
                  as="select"
                  placeholder="Select Connection Branch"
                  options={connectionBranchOptions}
                  value={form.connectionBranch}
                  onChange={(value) => updateField("connectionBranch", value)}
                  error={errors.connectionBranch}
                  disabled={!form.zone || !connectionBranchOptions.length || isViewMode}
                  readOnly={isViewMode}
                />
              </div>
            </div>
          </div>

          <div className={formStyles.sectionCard}>
            <SegmentedControl
              label="Activity Type"
              options={DB_ACTIVITY_TYPES}
              value={form.activityType}
              onChange={(value) => updateField("activityType", value)}
              disabled={isViewMode}
            />
            <SegmentedControl
              label="Customer Type"
              options={DB_CUSTOMER_TYPES}
              value={form.customerType}
              onChange={(value) => updateField("customerType", value)}
              disabled={isViewMode}
            />
            <SegmentedControl
              label="Customer Interested In"
              options={DB_INTEREST_OPTIONS}
              value={form.interestedIn}
              onChange={(value) => updateField("interestedIn", value)}
              disabled={isViewMode}
            />
            {form.interestedIn === "INTERNET" ? (
              <SegmentedControl
                label="Connection Type"
                options={DB_CONNECTION_TYPES}
                value={form.connectionType}
                onChange={(value) => updateField("connectionType", value)}
                disabled={isViewMode}
              />
            ) : null}
            <SegmentedControl
              label="Connection Stage"
              options={DB_CONNECTION_STAGES}
              value={form.connectionStage}
              onChange={(value) => updateField("connectionStage", value)}
              disabled={isViewMode}
            />
          </div>

          <div className={formStyles.sectionCard}>
            <div className={formStyles.sectionTitle}>Basic Customer Details</div>
            <div className={`${formStyles.grid} ${formStyles.gridTwo}`}>
              <FormField
                label="Customer Name *"
                value={form.customerName}
                onChange={(value) => updateField("customerName", value)}
                error={errors.customerName}
                readOnly={isViewMode}
              />
              <FormField
                label="Mobile No *"
                value={form.mobileNo}
                onChange={(value) => updateField("mobileNo", value)}
                error={errors.mobileNo}
                readOnly={isViewMode}
              />
              <FormField
                label="Mail"
                type="email"
                value={form.mail}
                onChange={(value) => updateField("mail", value)}
                error={errors.mail}
                readOnly={isViewMode}
              />
              <div className={formStyles.spanFull}>
                <LatLongMapField
                  value={form.latLong}
                  onChange={(value) => updateField("latLong", value)}
                  error={errors.latLong}
                  readOnly={isViewMode}
                />
              </div>
              <div className={formStyles.spanFull}>
                <FormField
                  label="Address *"
                  as="textarea"
                  value={form.address}
                  onChange={(value) => updateField("address", value)}
                  error={errors.address}
                  readOnly={isViewMode}
                />
              </div>
            </div>
          </div>

          <div className={formStyles.sectionCard}>
            <SegmentedControl
              label="Lead Ref"
              options={DB_LEAD_REFS}
              value={form.leadRef}
              onChange={(value) => updateField("leadRef", value)}
              disabled={isViewMode}
            />
            {renderLeadRefFields()}
          </div>

          <div className={formStyles.sectionCard}>
            <SegmentedControl
              label="Status"
              options={DB_STATUS_OPTIONS}
              value={form.status}
              onChange={(value) => updateField("status", value)}
              disabled={isViewMode}
            />
            {renderStatusFields()}
          </div>

            <div className={formStyles.sectionCard}>
              <div className={formStyles.sectionTitle}>Connection Movement</div>
              <div className={`${formStyles.grid} ${formStyles.gridTwo}`}>
                <FormField
                  label="MOVE TO ASM"
                  as="select"
                  options={asmSelectOptions}
                  value={form.moveToAsm}
                  onChange={(value) => updateField("moveToAsm", value)}
                  error={errors.moveToAsm}
                  disabled={!hasAsmOptions || isViewMode}
                  readOnly={isViewMode}
                />
              </div>

              <div className={formStyles.chipRow}>
                <div className={formStyles.spanFull}>
                  <FormField
                    label="Vendor Movement"
                    as="select"
                    options={vendorMovementSelectOptions}
                    value={form.vendorMovement}
                    onChange={(value) => updateField("vendorMovement", value)}
                    error={errors.vendorMovement}
                    disabled={!hasVendorMovementOptions || isViewMode}
                    readOnly={isViewMode}
                  />
                </div>
            </div>
          </div>
        </div>

        {isViewMode ? null : (
          <div className={formStyles.formFooter}>
            <button type="button" className={formStyles.buttonGhost} onClick={goBackToList}>
              Cancel
            </button>
            <button type="button" className={formStyles.buttonPrimary} onClick={submitForm} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadFormPage;
