import axios from "axios";
import { getCached, prefetchCached } from "./queryCache";
import { clearAuthSession, getAuthItem } from "../utils/auth";
import { API_BASE_URL } from "../config/apiConfig";

const api = axios.create({
  baseURL: API_BASE_URL,
});

/* Attach token */
api.interceptors.request.use(config => {
  const token = getAuthItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* Auto logout on 401 */
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearAuthSession();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const cachedGet = (url, options = {}) =>
  getCached((targetUrl, requestOptions) => api.get(targetUrl, requestOptions), url, options);

export const prefetchGet = (url, options = {}) =>
  prefetchCached((targetUrl, requestOptions) => api.get(targetUrl, requestOptions), url, options);

export default api;
