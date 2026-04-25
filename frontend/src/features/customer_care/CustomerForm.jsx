import { useEffect, useMemo, useState } from "react";
import "../css/CustomerForm.css";

const fallbackOptions = {
  connectionModes: ["FIBER", "RF"],
  statuses: ["ACTIVE", "DROP", "DISCONNECTED"],
  plans: [
    "100MB 1000GB FUP 0KBPS",
    "100MB 1000GB FUP 1MBPS",
    "100MB 1000GB FUP 2MBPS"
  ],
  paymentModes: ["MONTHLY", "HALF YEARLY", "YEARLY", "QUARTERLY"],
  connectionTypes: ["BB"],
  towerTypes: ["STRAIGHT", "GUYED", "ROOFTOP", "GROUND BASED"],
  teamNames: ["IT", "NETWORK", "RF", "FIBER"],
  towerNames: [],
  apNames: [],
  branchEntryApNames: [],
  nldIds: []
};

const sections = [
  {
    title: "Customer Details",
    fields: [
      { name: "customer_id", label: "Customer ID", type: "text", required: true },
      { name: "zone", label: "Zone", type: "select", optionKey: "zones", required: true },
      { name: "branch", label: "Branch", type: "select", optionKey: "branches", required: true },
      { name: "first_name", label: "First Name", type: "text" },
      { name: "connection_mode", label: "Connection Mode", type: "select", optionKey: "connectionModes" },
      { name: "status", label: "Status", type: "select", optionKey: "statuses" },
      { name: "plan_name", label: "Plan Name", type: "select", optionKey: "plans" },
      { name: "plan_value", label: "Plan value", type: "number", readOnly: true },
      { name: "connection_starting_date", label: "Connection starting date", type: "date" },
      { name: "payment_mode", label: "Payment Mode", type: "select", optionKey: "paymentModes" },
      { name: "drop_date", label: "Drop date", type: "date" },
      { name: "age", label: "Age", type: "number" },
      { name: "lat_long", label: "Lat & Long", type: "text" },
      { name: "connection_type", label: "Connection Type", type: "select", optionKey: "connectionTypes" },
      { name: "customer_ip", label: "Customer ip", type: "text" },
      { name: "tower_id", label: "Tower ID", type: "text" },
      { name: "ap_name_ssid", label: "AP Name(SSID)", type: "select", optionKey: "apNames" }
    ]
  },
  {
    title: "Branch Entry",
    fields: [
      { name: "bridge_mode_ip_branch_entry", label: "Bridge Mode IP(Branch Entry)", type: "text" },
      { name: "lat_long_branch_entry", label: "Lat & Long (Branch Entry)", type: "text" },
      { name: "area_name_branch_entry", label: "Area Name(Branch Entry)", type: "text" },
      { name: "area_incharge_emp_id", label: "Area Incharge Emp ID", type: "text" },
      { name: "area_incharge_emp_name", label: "Area Incharge Emp Name", type: "text" },
      { name: "technical_emp_id", label: "Technical Emp ID", type: "text" },
      { name: "technical_emp_name", label: "Technical Emp Name", type: "text" },
      { name: "bi_name", label: "BI Name", type: "text" },
      { name: "tl_name", label: "TL Name", type: "text" },
      { name: "tower_name", label: "Tower Name", type: "select", optionKey: "towerNames" },
      { name: "team_name", label: "Team Name", type: "select", optionKey: "teamNames" }
    ]
  },
  {
    title: "Billing",
    fields: [
      { name: "current_bill", label: "Current bill", type: "number" },
      { name: "outstanding", label: "Outstanding", type: "number" },
      { name: "total_bill", label: "Total bill", type: "number", readOnly: true },
      { name: "total_paid", label: "Total Paid", type: "number", readOnly: true },
      { name: "old_balance_paid", label: "Old Balance Paid", type: "number" },
      { name: "balance", label: "Balance", type: "number", readOnly: true },
      { name: "new_collection_paid", label: "New Collection Paid", type: "number" },
      { name: "excess_pay", label: "Excess Pay", type: "number", readOnly: true }
    ]
  },
  {
    title: "Tower Metrics",
    fields: [
      { name: "tower_type", label: "Tower Type", type: "select", optionKey: "towerTypes" },
      { name: "total_bw", label: "Total BW", type: "number" },
      { name: "max_utilisation", label: "Max Utilisation", type: "number" },
      { name: "avg_utilisation", label: "Avg Utilisation", type: "number" },
      { name: "tower_height", label: "Tower Height", type: "number" }
    ]
  },
  {
    title: "Device Details",
    fields: [
      { name: "device_name_ssid", label: "Device Name - SSID", type: "text" },
      { name: "bridge_ip", label: "Bridge IP", type: "text" },
      { name: "wep_key", label: "Wep Key", type: "text" },
      { name: "wireless_mac", label: "Wireless Mac", type: "text" },
      { name: "user_name", label: "User Name", type: "text" },
      { name: "password", label: "Password", type: "text" },
      { name: "port_number", label: "Port Number", type: "text" },
      { name: "device_product_name", label: "Device Product Name", type: "text" },
      { name: "device_model", label: "Device Model", type: "text" }
    ]
  },
  {
    title: "NLD Mapping",
    fields: [
      { name: "nld_id", label: "Nld Id", type: "select", optionKey: "nldIds" },
      { name: "tower_id_branch_entry", label: "Tower ID(Branch Entry)", type: "text" },
      { name: "ap_name_ssid_branch_entry", label: "AP Name(SSID) - (Branch Entry)", type: "select", optionKey: "branchEntryApNames" },
      { name: "code", label: "Code", type: "text" }
    ]
  }
];

const allFields = sections.flatMap((section) => section.fields);
const numericFields = new Set(
  allFields.filter((field) => field.type === "number").map((field) => field.name)
);

const initialState = allFields.reduce((acc, field) => {
  acc[field.name] = "";
  return acc;
}, {});

function normalizeText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseNumber(value) {
  const normalized = normalizeText(value);
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function CustomerForm({
  options = {},
  onClose,
  onSubmit,
  submitting,
  initialData = null,
  mode = "create",
  standalone = false
}) {
  const [formData, setFormData] = useState(initialState);

  const availableBranches = useMemo(() => {
    if (!formData.zone) return [];
    return options.branches?.[formData.zone] || [];
  }, [formData.zone, options.branches]);

  useEffect(() => {
    if (initialData) {
      const nextState = { ...initialState };

      allFields.forEach((field) => {
        const rawValue = initialData[field.name];
        nextState[field.name] =
          rawValue === null || rawValue === undefined ? "" : String(rawValue);
      });

      setFormData(nextState);
      return;
    }

    setFormData(initialState);
  }, [initialData]);

  useEffect(() => {
    setFormData((prev) => {
      const currentBill = parseNumber(prev.current_bill);
      const outstanding = parseNumber(prev.outstanding);
      const oldBalancePaid = parseNumber(prev.old_balance_paid);
      const newCollectionPaid = parseNumber(prev.new_collection_paid);

      const totalBill = currentBill + outstanding;
      const totalPaid = oldBalancePaid + newCollectionPaid;
      const balance = Math.max(totalBill - totalPaid, 0);
      const excessPay = Math.max(totalPaid - totalBill, 0);

      const nextTotalBill = totalBill ? String(totalBill) : "";
      const nextTotalPaid = totalPaid ? String(totalPaid) : "";
      const nextBalance = balance ? String(balance) : "";
      const nextExcessPay = excessPay ? String(excessPay) : "";

      if (
        prev.total_bill === nextTotalBill &&
        prev.total_paid === nextTotalPaid &&
        prev.balance === nextBalance &&
        prev.excess_pay === nextExcessPay
      ) {
        return prev;
      }

      return {
        ...prev,
        total_bill: nextTotalBill,
        total_paid: nextTotalPaid,
        balance: nextBalance,
        excess_pay: nextExcessPay
      };
    });
  }, [
    formData.current_bill,
    formData.outstanding,
    formData.old_balance_paid,
    formData.new_collection_paid
  ]);

  const handleChange = (name, value) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "zone") {
        next.branch = "";
      }

      if (name === "plan_name") {
        const amount = options.planAmountByName?.[value];
        if (amount !== undefined && amount !== null) {
          next.plan_value = String(amount);
        }
      }

      return next;
    });
  };

  const normalizePayload = (data) => {
    const payload = {};

    allFields.forEach((field) => {
      const value = data[field.name];

      if (value === "") {
        payload[field.name] = null;
        return;
      }

      if (numericFields.has(field.name)) {
        const parsed = Number(value);
        payload[field.name] = Number.isNaN(parsed) ? null : parsed;
        return;
      }

      payload[field.name] = value;
    });

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!normalizeText(formData.customer_id)) {
      alert("Customer ID is required");
      return;
    }

    if (!normalizeText(formData.zone)) {
      alert("Zone is required");
      return;
    }

    if (!normalizeText(formData.branch)) {
      alert("Branch is required");
      return;
    }

    await onSubmit(normalizePayload(formData));
  };

  const renderSelectOptions = (field) => {
    if (field.name === "branch") {
      const branchOptions = Array.from(
        new Set([...(availableBranches || []), formData.branch || ""].filter(Boolean))
      );

      return branchOptions.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ));
    }

    const optionKey = field.optionKey;
    const sourceValues =
      field.name === "zone"
        ? options.zones || []
        : options[optionKey] || fallbackOptions[optionKey] || [];

    const values = Array.from(
      new Set([...(sourceValues || []), formData[field.name] || ""].filter(Boolean))
    );

    return values.map((value) => (
      <option key={value} value={value}>
        {value}
      </option>
    ));
  };

  return (
    <div className={standalone ? "customer-form-page" : "customer-form-overlay"}>
      <div className={`customer-form-modal${standalone ? " customer-form-modal-standalone" : ""}`}>
        <div className="customer-form-header">
          <div className="customer-form-title">
            <h2>{mode === "edit" ? "Edit Customer" : "Create Customer"}</h2>
          </div>
          <button type="button" className="customer-form-close" onClick={onClose}>
            {standalone ? "Back" : "Close"}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {sections.map((section) => (
            <section className="customer-form-section" key={section.title}>
              <h2 className="customer-form-section-title">{section.title}</h2>

              <div className="customer-form-grid">
                {section.fields.map((field) => (
                  <div className="customer-form-group" key={field.name}>
                    <label htmlFor={field.name}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>

                    {field.type === "select" ? (
                      <select
                        id={field.name}
                        value={formData[field.name] || ""}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        required={field.required}
                        disabled={field.name === "branch" && !formData.zone}
                      >
                        <option value="">
                          {field.name === "branch" && !formData.zone
                            ? "Select Zone First"
                            : "Select"}
                        </option>
                        {renderSelectOptions(field)}
                      </select>
                    ) : (
                      <input
                        id={field.name}
                        type={field.type}
                        value={formData[field.name] || ""}
                        placeholder={field.placeholder || ""}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        required={field.required}
                        readOnly={field.readOnly}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="customer-form-actions">
            <button type="button" className="customer-form-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="customer-form-primary-btn" disabled={submitting}>
              {submitting
                ? mode === "edit"
                  ? "Updating..."
                  : "Saving..."
                : mode === "edit"
                ? "Update Customer"
                : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
