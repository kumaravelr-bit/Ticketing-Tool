import api from "./api";

export const getUniformRequests = () => api.get("/uniform/requests");
export const getUniformRequestById = (id) => api.get(`/uniform/requests/${id}`);
export const createUniformRequest = (data) => api.post("/uniform/requests", data);
export const reviewUniformRequest = (id, data) =>
  api.put(`/uniform/requests/${id}/review`, data);
export const exportUniformRequests = (params) =>
  api.get("/uniform/requests/export", {
    params,
    responseType: "blob"
  });
