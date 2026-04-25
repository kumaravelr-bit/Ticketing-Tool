import api, { cachedGet } from "./api";

/* ================= MANPOWER ================= */

// CREATE REQUEST
export const createManpowerRequest = (data) =>
  api.post("/manpower/requests", data);

// SUMMARY
export const getManpowerSummary = () =>
  cachedGet("/manpower/home-summary", { ttl: 20 * 1000 });

// LIST
export const getManpowerRequests = (params) =>
  api.get("/manpower/requests", { params });

// DETAIL
export const getManpowerById = (id) =>
  api.get(`/manpower/requests/${id}`);

// ✅ UPDATE REQUEST (EDIT)
export const updateManpowerRequest = (id, data) =>
  api.put(`/manpower/requests/${id}`, data);

// ✅ ACTION (APPROVE / REJECT)  ← 🔥 THIS WAS MISSING
export const updateManpowerAction = (id, type, data) =>
  api.put(`/manpower/requests/${id}/${type}`, data);
