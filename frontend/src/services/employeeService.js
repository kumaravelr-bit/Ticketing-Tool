import api from "./api";

/* ================= MASTER ================= */

export const getZones = () => api.get("/others/zones");
export const getTeams = () => api.get("/others/teams");
export const getAllBranches = () => api.get("/others/branches");
export const getBranchesByZone = (zone_id) =>
  api.get(`/others/branches/by-zone/${zone_id}`);

export const getAreasByBranch = (branch_id) =>
  api.get(`/others/areas/by-branch/${branch_id}`);

export const getDesignations = (team_id) =>
  api.get(`/others/designations/by-team/${team_id}`);

export const getManagers = (params) =>
  api.get("/employee/managers", { params });

/* ================= EMPLOYEE ================= */

export const createEmployee = (data) =>
  api.post("/employee/employees", data, {
    headers: { "Content-Type": "multipart/form-data" }
  });

export const updateEmployee = (empId, data) =>
  api.put(`/employee/employees/${empId}`, data);

export const getEmployeeById = (empId) =>
  api.get(`/employee/employees/${empId}`);

export const getActiveEmployees = (params) =>
  api.get("/employee/active", { params });

export const getRelievedEmployees = (params) =>
  api.get("/employee/relieved", { params });

export const reactivateEmployee = (empId) =>
  api.put(`/employee/reactivate/${empId}`);

export const createArea = (data) =>
  api.post("/others/areas", data);

export const updateArea = (id, data) =>
  api.put(`/others/areas/${id}`, data);

export const deleteArea = (id) =>
  api.delete(`/others/areas/${id}`);

export const createNewRequest = () => api.get("/employee/options");