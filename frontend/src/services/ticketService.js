import api from "./api";

export const getBranches = () => api.get("/others/branches");

export const getTeams = () => api.get("/others/teams");

// FIX THIS (IMPORTANT)
export const getMembers = (branchId, teamId) =>
  api.get(`/others/employees/by-branch-team`, {
    params: { branch_id: branchId, team_id: teamId }
  });

export const getTicketTypes = () =>
  api.get("/tickets/types");

export const searchOpenedTickets = (params) =>
  api.post("/tickets/opened/search", params);

export const createTicket = (data) =>
  api.post("/tickets", data);

export const moveTicket = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/move`, data);

export const resolveTicket = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/resolve`, data);

export const closeTicket = (ticketId, data) =>
  api.post(`/tickets/close/${ticketId}`, data);

export const updateTicket = (ticketId, data) => {
  return api.post(`/tickets/${ticketId}/update`, data);
};

export const getTicketHistory = (ticketId) => {
  return api.get(`/tickets/${ticketId}/history`);
};

export const getSubtypes = (typeId) =>
  api.get(`/tickets/subtypes/${typeId}`);

export const searchClosedTickets = (params) =>
  api.post("/tickets/closed/search", params);