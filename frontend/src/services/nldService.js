import api from "./api";

export const getNldFilters = async () => {
  const res = await api.get("/filters");
  return {
    zones: res.data?.zones || [],
    branches: res.data?.branches || [],
  };
};

export const getNldFormOptions = async () => {
  const res = await api.get("/nld-form-options");
  return {
    nldNames: res.data?.nldNames || [],
    failoverAvailabilityOptions: res.data?.failoverAvailabilityOptions || [],
    failoverStatusOptions: res.data?.failoverStatusOptions || [],
  };
};

export const getNldDashboardCounts = async () => {
  const res = await api.get("/dashboard-counts");
  return {
    total_nld: Number(res.data?.total_nld || 0),
    open_count: Number(res.data?.open_count || 0),
    closed_count: Number(res.data?.closed_count || 0),
    total_records: Number(res.data?.total_records || 0),
  };
};

export const getNldDashboardRows = async (queryString = "") => {
  const url = queryString ? `/dashboard?${queryString}` : "/dashboard";
  const res = await api.get(url);
  return Array.isArray(res.data) ? res.data : [];
};

export const getNldRecordById = async (id) => {
  const res = await api.get(`/linkdown/${id}`);
  return res.data || null;
};

export const createNldRecord = (payload) => api.post("/linkdown", payload);

export const updateNldRecord = (id, payload) => api.put(`/linkdown/${id}`, payload);

export const lookupNldMasterData = async (params) => {
  const res = await api.get("/master-lookup", { params });
  return res.data || null;
};
