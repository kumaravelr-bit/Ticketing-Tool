import api from "./api";

export const getLeads = async (params = {}) => {
  const response = await api.get("/new-connections", { params });
  return Array.isArray(response.data) ? response.data : [];
};

export const getLeadById = async (id) => {
  const response = await api.get(`/new-connections/${id}`);
  return response.data;
};

export const createLead = async (payload) => {
  const response = await api.post("/new-connections", payload);
  return response.data;
};

export const updateLead = async (id, payload) => {
  const response = await api.put(`/new-connections/${id}`, payload);
  return response.data;
};

export const deleteLead = async (id) => {
  const response = await api.delete(`/new-connections/${id}`);
  return response.data;
};
