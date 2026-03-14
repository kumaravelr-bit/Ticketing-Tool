import api from "./api";

export const getBranches = () => api.get("/others/branches");

export const getTeams = () => api.get("/others/teams");

export const getMembers = (teamId) =>
  api.get(`/teams/${teamId}/members`);

export const getTicketTypes = () =>
  api.get("/tickets/types");

export const searchOpenedTickets = (params) =>
  api.post("/tickets/opened/search", params);

export const moveTicket = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/move`, data);

export const resolveTicket = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/resolve`, data);

export const closeTicket = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/close`, data);

export const updateTicket = (ticketId, data) =>
  api.post(`/tickets/${ticketId}/update`, data);