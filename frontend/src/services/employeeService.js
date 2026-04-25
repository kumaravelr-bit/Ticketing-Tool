import api, { cachedGet } from "./api";

/* ─── Master / Lookup ─── */
export const getZones          = ()           => cachedGet("/others/zones", { ttl: 5 * 60 * 1000 });
export const getTeams          = ()           => cachedGet("/others/teams", { ttl: 5 * 60 * 1000 });
export const getAllBranches     = ()           => cachedGet("/others/branches", { ttl: 5 * 60 * 1000 });
export const getBranchesByZone = (zone_id)    => api.get(`/others/branches/by-zone/${zone_id}`);
export const getAreasByBranch  = (branch_id)  => api.get(`/others/areas/by-branch/${branch_id}`);
export const getDesignations   = (team_id)    => cachedGet(`/others/designations/by-team/${team_id}`, { ttl: 5 * 60 * 1000 });
export const getManagers       = (params)     => api.get("/employee/managers", { params });

/* ─── Employee CRUD ─── */
export const createEmployee = (data) =>
  api.post("/employee/employees", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateEmployee = (empId, data) =>
  api.put(`/employee/employees/${empId}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getEmployeeById      = (empId)   => api.get(`/employee/employees/${empId}`);
export const getEmployees         = ()        => api.get("/employee/employees");
export const getActiveEmployees   = (params)  => api.get("/employee/active",   { params });
export const getRelievedEmployees = (params)  => api.get("/employee/relieved", { params });
export const reactivateEmployee   = (empId)   => api.put(`/employee/reactivate/${empId}`);
export const deleteEmployee       = (empId)   => api.delete(`/employee/employees/${empId}`);
export const bulkUploadEmployees  = (data)    =>
  api.post("/employee/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const downloadEmployeeBulkTemplate = () =>
  api.get("/employee/bulk-upload/template", { responseType: "blob" });

/* ─── Export (all rows, no limit, same scope as list) ─── */
export const exportActiveEmployees   = (params) => api.get("/employee/export/active",   { params });
export const exportRelievedEmployees = (params) => api.get("/employee/export/relieved", { params });

/* ─── Areas (Master management) ─── */
export const createArea = (data)     => api.post("/others/areas",         data);
export const updateArea = (id, data) => api.put(`/others/areas/${id}`,    data);
export const deleteArea = (id)       => api.delete(`/others/areas/${id}`);

export const getFormOptions = () => api.get("/employee/options");
