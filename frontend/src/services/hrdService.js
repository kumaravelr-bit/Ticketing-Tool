import api from "./api";

// ✅ Generate Offer Letter
export const generateOfferLetter = (data) =>
  api.post("/offer-letter/generate", data);

// ✅ Get All Offer Letters
export const getOfferLetters = () =>
  api.get("/offer-letter/list");

// ✅ Get Offer Letter By ID
export const getOfferLetterById = (id) =>
  api.get(`/offer-letter/${id}`);

// ✅ Update Offer Letter
export const updateOfferLetter = (id, data) =>
  api.put(`/offer-letter/${id}`, data);

// ✅ Download Offer Letter (uses document_id internally in backend)
export const downloadOfferLetter = (id) =>
  api.get(`/offer-letter/download/${id}`, {
    responseType: "blob"
  });

export const previewOfferLetter = async (id) => {
  const res = await api.get(`/offer-letter/preview/${id}`, { responseType: "blob" });
  return res.data;
};

// ✅ Send Mail
export const sendOfferLetterMail = (data) =>
  api.post("/offer-letter/send-mail", data);

/* =========================
   RELIEVING LETTER
========================= */

export const getRelievingEmployees = (params = {}) =>
  api.get("/relieving/dashboard", { params });

export const getRelievingCandidates = (params = {}) =>
  api.get("/relieving/candidates", { params });

export const createRelievingLetter = (payload) =>
  api.post("/relieving/generate", payload);

export const getRelievingLetterById = (id) =>
  api.get(`/relieving/${id}`);

export const updateRelievingLetter = (id, payload) =>
  api.put(`/relieving/${id}`, payload);

export const previewRelievingLetter = (id) =>
  api.get(`/relieving/preview/${id}`, {
    responseType: "blob",
  });

export const downloadRelievingLetter = (id) =>
  api.get(`/relieving/download/${id}`, {
    responseType: "blob",
  });

export const sendRelievingLetterMail = (payload) =>
  api.post("/relieving/send-mail", payload);

export const approveRelievingLetter = (id, payload) =>
  api.post(`/relieving/${id}/approve`, payload);

export const rejectRelievingLetter = (id, payload) =>
  api.post(`/relieving/${id}/reject`, payload);