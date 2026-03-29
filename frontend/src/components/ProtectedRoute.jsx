import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";

export default function ProtectedRoute({ children, roles = [] }) {

  /* ✅ GET USER SAFELY */
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }

  /* 🔥 FALLBACK (VERY IMPORTANT) */
  const fallbackRole = localStorage.getItem("role");

  const userRole = (
    user?.role ||
    fallbackRole ||
    ""
  )
    .toString()
    .trim()
    .toUpperCase();

  const allowedRoles = roles.map(r => r.toUpperCase());

  /* 🔒 NOT LOGGED IN */
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  /* 🔒 ROLE CHECK */
  if (roles.length > 0) {
    if (!userRole || !allowedRoles.includes(userRole)) {
      console.log("❌ Role Denied:", userRole, "Allowed:", allowedRoles);
      return <Navigate to="/active" replace />;
    }
  }
  
  return children;
}