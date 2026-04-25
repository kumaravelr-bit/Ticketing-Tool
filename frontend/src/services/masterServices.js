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
export const bulkUploadBranches = (data) =>
  api.post("/others/branches/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const downloadBranchBulkTemplate = () =>
  api.get("/others/branches/bulk-upload/template", { responseType: "blob" });

/* TEAM */
export const createTeam = (data)=>api.post("/others/teams",data);
export const updateTeam = (id,data)=>api.put(`/others/teams/${id}`,data);
export const deleteTeam = (id)=>api.delete(`/others/teams/${id}`);
export const bulkUploadTeams = (data) =>
  api.post("/others/teams/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const downloadTeamBulkTemplate = () =>
  api.get("/others/teams/bulk-upload/template", { responseType: "blob" });

/* DESIGNATION */
export const createDesignation = (data)=>api.post("/others/designations",data);
export const updateDesignation = (id,data)=>api.put(`/others/designations/${id}`,data);
export const deleteDesignation = (id)=>api.delete(`/others/designations/${id}`);
export const bulkUploadDesignations = (data) =>
  api.post("/others/designations/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const downloadDesignationBulkTemplate = () =>
  api.get("/others/designations/bulk-upload/template", { responseType: "blob" });

/* GET APIs (FIXED) */

export const getZones = () => api.get("/others/zones");

export const getBranches = () => api.get("/others/branches");

export const getTeams = () => api.get("/others/teams");

export const getDesignationsByTeam = (team_id) =>
  api.get(`/others/designations/by-team/${team_id}`);
export const getAllDesignations = () => api.get("/others/designations");
export const getDesignationManagerRules = () => api.get("/others/designation-manager-rules");
export const downloadManagerMappingBulkTemplate = () =>
  api.get("/others/designation-manager-rules/bulk-upload/template", { responseType: "blob" });
export const bulkUploadManagerMappings = (data) =>
  api.post("/others/designation-manager-rules/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const createDesignationManagerRule = (data) =>
  api.post("/others/designation-manager-rules", data);
export const updateDesignationManagerRule = (id, data) =>
  api.put(`/others/designation-manager-rules/${id}`, data);
export const deleteDesignationManagerRule = (id) =>
  api.delete(`/others/designation-manager-rules/${id}`);
export const getScopeOwnerEmployees = () => api.get("/others/scope-owner-employees");
export const getScopeOwnerMappings = () => api.get("/others/scope-owner-mappings");
export const downloadScopeOwnerMappingBulkTemplate = () =>
  api.get("/others/scope-owner-mappings/bulk-upload/template", { responseType: "blob" });
export const bulkUploadScopeOwnerMappings = (data) =>
  api.post("/others/scope-owner-mappings/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const createScopeOwnerMapping = (data) =>
  api.post("/others/scope-owner-mappings", data);
export const updateScopeOwnerMapping = (id, data) =>
  api.put(`/others/scope-owner-mappings/${id}`, data);
export const deleteScopeOwnerMapping = (id) =>
  api.delete(`/others/scope-owner-mappings/${id}`);

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

export const bulkUploadAreas = (data) =>
  api.post("/others/areas/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const downloadAreaBulkTemplate = () =>
  api.get("/others/areas/bulk-upload/template", { responseType: "blob" });

export const bulkUploadPayslips = (data) =>
  api.post("/payslip/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const downloadPayslipBulkTemplate = () =>
  api.get("/payslip/bulk-upload/template", { responseType: "blob" });

export const getHrManagerSign = () =>
  api.get("/others/hr-manager-sign");

export const uploadHrManagerSign = (data) =>
  api.post("/others/hr-manager-sign", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteHrManagerSign = () =>
  api.delete("/others/hr-manager-sign");

export const bulkUploadOfferLetters = (data) =>
  api.post("/offer-letter/bulk-upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const downloadOfferLetterBulkTemplate = () =>
  api.get("/offer-letter/bulk-upload/template", { responseType: "blob" });
