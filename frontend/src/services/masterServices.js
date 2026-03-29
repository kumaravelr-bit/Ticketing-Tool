// masterService.js

import api from "./api";

/* ZONE */
export const createZone = (data)=>api.post("/others/zones",data);
export const updateZone = (id,data)=>api.put(`/others/zones/${id}`,data);
export const deleteZone = (id)=>api.delete(`/others/zones/${id}`);

/* BRANCH */
export const createBranch = (data)=>api.post("/others/branches",data);
export const updateBranch = (id,data)=>api.put(`/others/branches/${id}`,data);
export const deleteBranch = (id)=>api.delete(`/others/branches/${id}`);

/* TEAM */
export const createTeam = (data)=>api.post("/others/teams",data);
export const updateTeam = (id,data)=>api.put(`/others/teams/${id}`,data);
export const deleteTeam = (id)=>api.delete(`/others/teams/${id}`);

/* DESIGNATION */
export const createDesignation = (data)=>api.post("/others/designations",data);
export const updateDesignation = (id,data)=>api.put(`/others/designations/${id}`,data);
export const deleteDesignation = (id)=>api.delete(`/others/designations/${id}`);

/* GET APIs (FIXED) */

export const getZones = () => api.get("/others/zones");

export const getBranches = () => api.get("/others/branches");

export const getTeams = () => api.get("/others/teams");

export const getDesignationsByTeam = (team_id) =>
  api.get(`/others/designations/by-team/${team_id}`);

/* TICKET TYPES */
export const getTicketTypes = () => api.get("/tickets/types");
export const createTicketType = (data) => api.post("/tickets/types", data);
export const updateTicketType = (id, data) => api.put(`/tickets/types/${id}`, data);
export const deleteTicketType = (id) => api.delete(`/tickets/types/${id}`);

/* SUBTYPES */
export const getSubtypesByType = (type_id) =>
  api.get(`/tickets/subtypes/${type_id}`);

export const createSubtype = (data) =>
  api.post("/tickets/subtypes", data);

export const updateSubtype = (id, data) =>
  api.put(`/tickets/subtypes/${id}`, data);

export const deleteSubtype = (id) =>
  api.delete(`/tickets/subtypes/${id}`);

export const getAreasByBranch = (branchId) =>
  api.get(`/others/areas/by-branch/${branchId}`);

export const createArea = (data) =>
  api.post("/others/areas", data);

export const updateArea = (id, data) =>
  api.put(`/others/areas/${id}`, data);

export const deleteArea = (id) =>
  api.delete(`/others/areas/${id}`);