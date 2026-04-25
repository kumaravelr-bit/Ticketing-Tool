import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomerForm from "./CustomerForm";
import { createCustomer, fetchFilterOptions } from "../services/customerService";

export default function CustomerCreatePage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState({
    zones: [],
    branches: {},
    connectionTypes: [],
    connectionModes: [],
    plans: [],
    paymentModes: [],
    towerTypes: [],
    towerNames: [],
    teamNames: [],
    apNames: [],
    branchEntryApNames: [],
    nldIds: [],
    ipTypes: [],
    deviceModes: [],
    statuses: [],
    connectedBranches: [],
    planAmountByName: {},
    branchMailByName: {},
    zoneMailByName: {},
    branchDepartmentByName: {}
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const data = await fetchFilterOptions();
        setOptions({
          zones: data?.zones || [],
          branches: data?.branches || {},
          connectionTypes: data?.connectionTypes || [],
          connectionModes: data?.connectionModes || [],
          plans: data?.plans || [],
          paymentModes: data?.paymentModes || [],
          towerTypes: data?.towerTypes || [],
          towerNames: data?.towerNames || [],
          teamNames: data?.teamNames || [],
          apNames: data?.apNames || [],
          branchEntryApNames: data?.branchEntryApNames || [],
          nldIds: data?.nldIds || [],
          ipTypes: data?.ipTypes || [],
          deviceModes: data?.deviceModes || [],
          statuses: data?.statuses || [],
          connectedBranches: data?.connectedBranches || [],
          planAmountByName: data?.planAmountByName || {},
          branchMailByName: data?.branchMailByName || {},
          zoneMailByName: data?.zoneMailByName || {},
          branchDepartmentByName: data?.branchDepartmentByName || {}
        });
      } catch (error) {
        console.error("Failed to load filter options:", error);
        alert(
          error?.response?.data?.message ||
            "Unable to load filter options. Check backend."
        );
      }
    };

    loadOptions();
  }, []);

  const handleSubmit = async (payload) => {
    try {
      setSubmitting(true);
      await createCustomer(payload);
      alert("Customer created successfully");
      navigate("/customercare/customers");
    } catch (error) {
      console.error("Submit customer failed:", error);
      alert(error?.response?.data?.message || "Failed to save customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerForm
      options={options}
      onClose={() => navigate("/customercare/customers")}
      onSubmit={handleSubmit}
      submitting={submitting}
      mode="create"
      standalone
    />
  );
}
