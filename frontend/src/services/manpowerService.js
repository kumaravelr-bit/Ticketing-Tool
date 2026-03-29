import api from "./api";

/* ================= MANPOWER ================= */

// CREATE REQUEST
export const createManpowerRequest = (data) =>
  api.post("/manpower/requests", data);

// SUMMARY
export const getManpowerSummary = () =>
  api.get("/manpower/home-summary");

// LIST
export const getManpowerRequests = (params) =>
  api.get("/manpower/requests", { params });

// DETAIL
export const getManpowerById = (id) =>
  api.get(`/manpower/requests/${id}`);