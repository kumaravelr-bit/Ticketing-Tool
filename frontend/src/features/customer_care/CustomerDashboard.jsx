

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCustomer,
  fetchCustomerById,
  fetchCustomers,
  fetchFilterOptions,
  updateCustomer
} from "../services/customerService";
import CustomerFilters from "./CustomerFilters";
import CustomerForm from "./CustomerForm";
import CustomerTable from "./CustomerTable";
import Pagination from "./Pagination";
import "../css/CustomerDashboard.css";

const initialFilters = {
  search: "",
  customer_id: "",
  first_name: "",
  zone: "",
  branch: "",
  status: "",
  connection_mode: "",
  payment_mode: ""
};

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
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

  const [page, setPage] = useState(1);
  const limit = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingCustomer, setEditingCustomer] = useState(null);

  const queryParams = useMemo(() => {
    return {
      ...filters,
      page,
      limit
    };
  }, [filters, page]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await fetchCustomers(queryParams);
      setCustomers(data?.rows || []);
      setTotalPages(data?.pagination?.totalPages || 1);
      setTotalRecords(data?.pagination?.totalRecords || 0);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      alert(
        error?.response?.data?.message ||
          "Unable to load customers. Check backend and database connection."
      );
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [queryParams]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value
    }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const openCreateForm = () => {
    setFormMode("create");
    setEditingCustomer(null);
    navigate("/customercare/customers/new");
  };

  const handleEditCustomer = async (id) => {
    try {
      const data = await fetchCustomerById(id);
      setFormMode("edit");
      setEditingCustomer(data);
      setShowForm(true);
    } catch (error) {
      console.error("Edit customer load failed:", error);
      alert(error?.response?.data?.message || "Failed to load customer");
    }
  };

  const handleSubmitCustomer = async (payload) => {
    try {
      setSubmitting(true);

      if (formMode === "edit" && editingCustomer?.id) {
        await updateCustomer(editingCustomer.id, payload);
        alert("Customer updated successfully");
      } else {
        await createCustomer(payload);
        alert("Customer created successfully");
      }

      setShowForm(false);
      setEditingCustomer(null);
      setFormMode("create");
      await loadCustomers();
    } catch (error) {
      console.error("Submit customer failed:", error);
      alert(error?.response?.data?.message || "Failed to save customer");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  };

  return (
    <div className="customer-dashboard-page">
      <div className="customer-dashboard-card">
        <div className="customer-dashboard-title-row">
          <h1>Customer Master Requests</h1>

          <button
            type="button"
            className="customer-primary-btn"
            onClick={openCreateForm}
          >
            + Create Customer
          </button>
        </div>

        <div className="customer-stats-row">
          <div className="customer-stat-card">
            <div className="customer-stat-label">Total</div>
            <div className="customer-stat-value">{totalRecords}</div>
          </div>

          <div className="customer-stat-card">
            <div className="customer-stat-label">Current Page</div>
            <div className="customer-stat-value">{page}</div>
          </div>

          <div className="customer-stat-card">
            <div className="customer-stat-label">Total Pages</div>
            <div className="customer-stat-value">{totalPages}</div>
          </div>

          <div className="customer-stat-card">
            <div className="customer-stat-label">Showing</div>
            <div className="customer-stat-value">{customers.length}</div>
          </div>
        </div>

        <CustomerFilters
          filters={filters}
          options={options}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        <CustomerTable
          rows={customers}
          loading={loading}
          onEdit={handleEditCustomer}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />

        {showForm && (
          <CustomerForm
            options={options}
            onClose={() => {
              setShowForm(false);
              setEditingCustomer(null);
              setFormMode("create");
            }}
            onSubmit={handleSubmitCustomer}
            submitting={submitting}
            initialData={editingCustomer}
            mode={formMode}
          />
        )}
      </div>
    </div>
  );
}
