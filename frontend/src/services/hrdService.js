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