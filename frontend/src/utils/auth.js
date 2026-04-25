const AUTH_KEYS = [
  "token",
  "role",
  "team",
  "emp_id",
  "designation",
  "designation_name",
  "loginTime",
  "user",
];

const getSessionStore = () =>
  typeof window !== "undefined" ? window.sessionStorage : null;

const getLocalStore = () =>
  typeof window !== "undefined" ? window.localStorage : null;

export const getAuthItem = (key) => getSessionStore()?.getItem(key) || null;

export const setAuthSession = (entries = {}) => {
  const store = getSessionStore();
  if (!store) return;

  Object.entries(entries).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      store.removeItem(key);
      return;
    }

    store.setItem(key, String(value));
  });
};

export const getAuthUser = () => {
  try {
    return JSON.parse(getAuthItem("user") || "null");
  } catch {
    return null;
  }
};

export const clearLegacyAuthStorage = () => {
  const localStore = getLocalStore();
  if (!localStore) return;

  AUTH_KEYS.forEach((key) => localStore.removeItem(key));
};

export const clearAuthSession = () => {
  const sessionStore = getSessionStore();
  AUTH_KEYS.forEach((key) => {
    sessionStore?.removeItem(key);
  });

  clearLegacyAuthStorage();
};

export const isAuthenticated = () => !!getAuthItem("token");

export const checkSession = () => {
  const loginTime = getAuthItem("loginTime");
  if (!loginTime) return;

  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - Number(loginTime) > TWO_HOURS) {
    logout();
  }
};

export const logout = () => {
  clearAuthSession();
  window.location.href = "/login";
};
