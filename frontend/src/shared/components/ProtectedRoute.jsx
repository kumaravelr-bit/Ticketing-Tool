import { Navigate } from "react-router-dom";
import { getAuthItem, getAuthUser, isAuthenticated } from "../../utils/auth";

export default function ProtectedRoute({
  children,
  roles = [],
  teams = [],
  designations = [],
}) {
  const user = getAuthUser();
  const fallbackRole = getAuthItem("role");
  const fallbackTeam = getAuthItem("team");
  const fallbackDesignation =
    getAuthItem("designation_name") || getAuthItem("designation");

  const userRole = (
    user?.role || fallbackRole || ""
  ).toString().trim().toUpperCase();

  const userTeam = (
    user?.team || user?.team_name || fallbackTeam || ""
  ).toString().trim().toUpperCase();

  const userDesignation = (
    user?.designation_name ||
    user?.designation ||
    fallbackDesignation ||
    ""
  ).toString().trim().toUpperCase();

  const allowedRoles = roles.map((role) => role.toUpperCase());
  const allowedTeams = teams.map((team) => team.toUpperCase());
  const allowedDesignations = designations.map((designation) =>
    designation.toUpperCase(),
  );

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (
    roles.length === 0 &&
    teams.length === 0 &&
    designations.length === 0
  ) {
    return children;
  }

  const isSuperPrivileged =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  const roleAllowed =
    roles.length === 0 || allowedRoles.includes(userRole);

  const teamAllowed =
    teams.length === 0 ||
    isSuperPrivileged ||
    allowedTeams.includes(userTeam);

  const designationAllowed =
    designations.length === 0 ||
    isSuperPrivileged ||
    allowedDesignations.includes(userDesignation);

  if (!(roleAllowed && teamAllowed && designationAllowed)) {
    console.warn("Access Denied:", {
      userRole,
      userTeam,
      userDesignation,
      allowedRoles,
      allowedTeams,
      allowedDesignations,
    });
    return <Navigate to="/active" replace />;
  }

  return children;
}
