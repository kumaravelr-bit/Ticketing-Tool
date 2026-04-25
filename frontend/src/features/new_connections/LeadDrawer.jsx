import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ACTIVITY_TYPES,
  ASM_OPTIONS,
  BRANCH_OPTIONS,
  CONNECTION_BRANCH_OPTIONS,
  CONNECTION_STAGES,
  CONNECTION_TYPES,
  CUSTOMER_TYPES,
  EMPLOYEE_DIRECTORY,
  INTEREST_OPTIONS,
  LEAD_REFS,
  PAYMENT_MODES,
  STATUS_OPTIONS,
  ZONE_OPTIONS,
} from "./constants";
import { createLead, getLeadById, updateLead } from "../../services/newConnectionService";
import {
  createEmptyLead,
  normalizeLeadForForm,
  syncEmployeeFields,
  validateLeadForm,
} from "./leadFormUtils";
import SegmentedControl from "./SegmentedControl";
import SearchableSelect from "./SearchableSelect";
import FormField from "./FormField";

function LeadDrawer({ open, leadId, onClose, onSaved }) {
  const [form, setForm] = useState(createEmptyLead());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!leadId) {
      setForm(createEmptyLead());
      setErrors({});
      setLoading(false);
      return;
    }

    const loadLead = async () => {
      try {
        setLoading(true);
        const data = await getLeadById(leadId);
        setForm(normalizeLeadForForm(data));
        setErrors({});
      } catch (error) {
        toast.error(error.response?.data?.message || "Unable to load lead");
      } finally {
        setLoading(false);
      }
    };

    loadLead();
  }, [open, leadId]);

  const selectedEmployeeOptions = useMemo(
    () => EMPLOYEE_DIRECTORY.map((employee) => employee.empName),
    []
  );

  if (!open) {
    return null;
  }

  const updateField = (key, value) => {
    setForm((previous) => {
      if (key === "empName") {
        return { ...previous, ...syncEmployeeFields(value) };
      }

      return { ...previous, [key]: value };
    });

    setErrors((previous) => ({ ...previous, [key]: "" }));
  };

  const submitForm = async () => {
    const nextErrors = validateLeadForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      toast.error("Please fix the required fields");
      return;
    }

    try {
      setSaving(true);

      if (leadId) {
        await updateLead(leadId, form);
        toast.success("Lead updated successfully");
      } else {
        await createLead(form);
        toast.success("Lead created successfully");
      }

      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save lead");
    } finally {
      setSaving(false);
    }
  };

  const renderLeadRefFields = () => {
    if (form.leadRef === "CUSTOMER") {
      return (
        <div className="leads-grid two-column">
          <FormField
            label="EX.CUSTOMER ID *"
            value={form.exCustomerId}
            onChange={(value) => updateField("exCustomerId", value)}
            error={errors.exCustomerId}
          />
          <FormField
            label="EX.CUSTOMER NAME *"
            value={form.exCustomerName}
            onChange={(value) => updateField("exCustomerName", value)}
            error={errors.exCustomerName}
          />
          <div className="leads-grid-span-full">
            <FormField
              label="REMARKS"
              as="textarea"
              value={form.remarks}
              onChange={(value) => updateField("remarks", value)}
            />
          </div>
        </div>
      );
    }

    if (form.leadRef === "TECH TEAM") {
      return (
        <div className="leads-grid two-column">
          <FormField
            label="TECH ID *"
            value={form.techId}
            onChange={(value) => updateField("techId", value)}
            error={errors.techId}
          />
          <FormField
            label="TECH NAME *"
            value={form.techName}
            onChange={(value) => updateField("techName", value)}
            error={errors.techName}
          />
          <div className="leads-grid-span-full">
            <FormField
              label="REMARKS"
              as="textarea"
              value={form.remarks}
              onChange={(value) => updateField("remarks", value)}
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
      />
    );
  };

  const renderStatusFields = () => {
    if (form.status === "FOLLOWUP") {
      return (
        <div className="leads-grid two-column">
          <FormField
            label="NEXT FOLLOW DATE *"
            type="date"
            value={form.nextFollowDate}
            onChange={(value) => updateField("nextFollowDate", value)}
            error={errors.nextFollowDate}
          />
          <FormField
            label="CURRENT UPDATES *"
            value={form.currentUpdates}
            onChange={(value) => updateField("currentUpdates", value)}
            error={errors.currentUpdates}
          />
        </div>
      );
    }

    if (form.status === "ID CREATED") {
      return (
        <div className="leads-grid three-column">
          <FormField
            label="CUSTOMER ID *"
            value={form.customerId}
            onChange={(value) => updateField("customerId", value)}
            error={errors.customerId}
          />
          <FormField
            label="PLAN *"
            value={form.plan}
            onChange={(value) => updateField("plan", value)}
            error={errors.plan}
          />
          <FormField
            label="PLAN VALUE (WITHOUT GST) *"
            type="number"
            value={form.planValueWithoutGst}
            onChange={(value) => updateField("planValueWithoutGst", value)}
            error={errors.planValueWithoutGst}
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
        />
      );
    }

    return (
      <div className="leads-grid three-column">
        <FormField
          label="PAYMENT MODE *"
          as="select"
          options={PAYMENT_MODES}
          value={form.paymentMode}
          onChange={(value) => updateField("paymentMode", value)}
          error={errors.paymentMode}
        />
        <FormField
          label="OTC (WITHOUT GST) *"
          type="number"
          value={form.otcWithoutGst}
          onChange={(value) => updateField("otcWithoutGst", value)}
          error={errors.otcWithoutGst}
        />
        <FormField
          label="DEPOSIT (WITHOUT GST) *"
          type="number"
          value={form.depositWithoutGst}
          onChange={(value) => updateField("depositWithoutGst", value)}
          error={errors.depositWithoutGst}
        />
      </div>
    );
  };

  return (
    <div className="leads-drawer-overlay">
      <div className="leads-drawer leads-form-modal">
        <div className="leads-drawer-header">
          <button type="button" className="nld-form-close leads-form-close" onClick={onClose}>
            Back
          </button>
          <div className="leads-form-title">
            <p className="leads-kicker">Lead Master</p>
            <h2>{leadId ? "Edit Lead" : "Create Lead"}</h2>
          </div>
          <div className="leads-header-actions">
            <button type="button" className="nld-form-secondary-btn ghost-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="nld-form-primary-btn primary-btn" onClick={submitForm} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="leads-drawer-body">
          {loading ? (
            <div className="leads-empty-state">Loading lead details...</div>
          ) : (
            <>
              <div className="leads-section-card">
                <SegmentedControl
                  label="Activity Type"
                  options={ACTIVITY_TYPES}
                  value={form.activityType}
                  onChange={(value) => updateField("activityType", value)}
                />
                <SegmentedControl
                  label="Customer Type"
                  options={CUSTOMER_TYPES}
                  value={form.customerType}
                  onChange={(value) => updateField("customerType", value)}
                />
                <SegmentedControl
                  label="Customer Interested In"
                  options={INTEREST_OPTIONS}
                  value={form.interestedIn}
                  onChange={(value) => updateField("interestedIn", value)}
                />
                <SegmentedControl
                  label="Connection Type"
                  options={CONNECTION_TYPES}
                  value={form.connectionType}
                  onChange={(value) => updateField("connectionType", value)}
                />
                <SegmentedControl
                  label="Connection Stage"
                  options={CONNECTION_STAGES}
                  value={form.connectionStage}
                  onChange={(value) => updateField("connectionStage", value)}
                />
              </div>

              <div className="leads-section-card">
                <div className="leads-section-title">Basic Customer Details</div>
                <div className="leads-grid two-column">
                  <FormField
                    label="Customer Name *"
                    value={form.customerName}
                    onChange={(value) => updateField("customerName", value)}
                    error={errors.customerName}
                  />
                  <FormField
                    label="Mobile No *"
                    value={form.mobileNo}
                    onChange={(value) => updateField("mobileNo", value)}
                    error={errors.mobileNo}
                  />
                  <FormField
                    label="Mail"
                    type="email"
                    value={form.mail}
                    onChange={(value) => updateField("mail", value)}
                    error={errors.mail}
                  />
                  <FormField
                    label="LatLong *"
                    value={form.latLong}
                    onChange={(value) => updateField("latLong", value)}
                    error={errors.latLong}
                  />
                  <div className="leads-grid-span-full">
                    <FormField
                      label="Address *"
                      as="textarea"
                      value={form.address}
                      onChange={(value) => updateField("address", value)}
                      error={errors.address}
                    />
                  </div>
                </div>
              </div>

              <div className="leads-section-card">
                <SegmentedControl
                  label="Lead Ref"
                  options={LEAD_REFS}
                  value={form.leadRef}
                  onChange={(value) => updateField("leadRef", value)}
                />
                {renderLeadRefFields()}
              </div>

              <div className="leads-section-card">
                <SegmentedControl
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(value) => updateField("status", value)}
                />
                {renderStatusFields()}
              </div>

              <div className="leads-section-card">
                <div className="leads-section-title">Employee & Connection</div>
                <div className="leads-grid two-column">
                  <SearchableSelect
                    label="EMP NAME *"
                    placeholder="Select employee"
                    options={selectedEmployeeOptions}
                    value={form.empName}
                    onChange={(value) => updateField("empName", value)}
                    error={errors.empName}
                  />
                  <FormField
                    label="MOVE TO ASM *"
                    as="select"
                    options={ASM_OPTIONS}
                    value={form.moveToAsm}
                    onChange={(value) => updateField("moveToAsm", value)}
                    error={errors.moveToAsm}
                  />
                  <SearchableSelect
                    label="CONNECTION BRANCH *"
                    placeholder="Search connection branch"
                    options={CONNECTION_BRANCH_OPTIONS}
                    value={form.connectionBranch}
                    onChange={(value) => updateField("connectionBranch", value)}
                    error={errors.connectionBranch}
                  />
                  <FormField
                    label="DATE *"
                    type="date"
                    value={form.date}
                    onChange={(value) => updateField("date", value)}
                    error={errors.date}
                  />
                  <FormField
                    label="ZONE *"
                    as="select"
                    options={ZONE_OPTIONS}
                    value={form.zone}
                    onChange={(value) => updateField("zone", value)}
                    error={errors.zone}
                  />
                  <FormField
                    label="BRANCH *"
                    as="select"
                    options={BRANCH_OPTIONS}
                    value={form.branch}
                    onChange={(value) => updateField("branch", value)}
                    error={errors.branch}
                  />
                </div>

                <div className="leads-chip-row">
                  <div className="leads-badge-card">
                    <span>EMP ID *</span>
                    <strong>{form.empId || "--"}</strong>
                  </div>
                  <div className="leads-badge-card accent">
                    <span>VENDOR MOVEMENT *</span>
                    <strong>{form.vendorMovement || "--"}</strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeadDrawer;
