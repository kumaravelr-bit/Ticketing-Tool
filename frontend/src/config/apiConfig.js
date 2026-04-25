const getDefaultApiOrigin = () => {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    return window.location.origin;
  }

  return "http://localhost:8090";
};

const API_ORIGIN = (process.env.REACT_APP_API_ORIGIN || getDefaultApiOrigin()).replace(/\/+$/, "");

export const API_BASE_URL = `${API_ORIGIN}/api`;
const ABSOLUTE_ASSET_PATTERN = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

export const buildApiUrl = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const buildAssetUrl = (path = "") => {
  if (!path) return API_ORIGIN;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_ORIGIN}${normalizedPath}`;
};

export const resolveAssetUrl = (assetPath = "", fallbackDirectory = "") => {
  const rawValue = String(assetPath || "").trim();
  if (!rawValue) return "";

  if (
    rawValue.startsWith("blob:") ||
    rawValue.startsWith("data:") ||
    ABSOLUTE_ASSET_PATTERN.test(rawValue)
  ) {
    return rawValue;
  }

  if (rawValue.startsWith("/")) {
    return buildAssetUrl(rawValue);
  }

  if (rawValue.startsWith("uploads/")) {
    return buildAssetUrl(`/${rawValue}`);
  }

  if (fallbackDirectory) {
    const normalizedDirectory = fallbackDirectory.replace(/^\/+|\/+$/g, "");
    return buildAssetUrl(`/${normalizedDirectory}/${rawValue}`);
  }

  return buildAssetUrl(`/${rawValue}`);
};

export default API_ORIGIN;
