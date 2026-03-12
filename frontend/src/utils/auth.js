export const isAuthenticated = () => {
  return !!localStorage.getItem("token");
};

export const checkSession = () => {
  const loginTime = localStorage.getItem("loginTime");
  if (!loginTime) return;

  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - Number(loginTime) > TWO_HOURS) {
    logout();
  }
};

export const logout = () => {
  localStorage.clear();
  window.location.href = "/login";
};
