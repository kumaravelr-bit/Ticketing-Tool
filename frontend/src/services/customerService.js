import API from "./api";

export const fetchCustomers = async (params) => {
  const response = await API.get("/customers", { params });
  return response.data;
};

export const fetchFilterOptions = async () => {
  const response = await API.get("/customers/options");
  return response.data;
};

export const fetchCustomerById = async (id) => {
  const response = await API.get(`/customers/${id}`);
  return response.data;
};

export const createCustomer = async (payload) => {
  const response = await API.post("/customers", payload);
  return response.data;
};

export const updateCustomer = async (id, payload) => {
  const response = await API.put(`/customers/${id}`, payload);
  return response.data;
};
