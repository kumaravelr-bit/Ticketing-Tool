import api from "./api";

export const getEmployees = (params) =>
  api.get("/payslip/employees", { params });

export const createPayslip = (data) =>
  api.post("/payslip", data);

export const updatePayslip = (id, data) =>
  api.put(`/payslip/${id}`, data);

export const deletePayslip = (id) =>
  api.delete(`/payslip/${id}`);

export const getPayslips = (params) =>
  api.get("/payslip", { params });

export const getPayslipById = (id) =>
  api.get(`/payslip/${id}`);

export const previewPayslip = (id) =>
  api.get(`/payslip/${id}/preview`, { responseType: "blob" });

export const downloadPayslip = (id) =>
  api.get(`/payslip/${id}/download`, { responseType: "blob" });

export const sendPayslipMail = (data) =>
  api.post("/payslip/send-mail", data);
