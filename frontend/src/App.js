import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./shared/components/Login";
import CreateEmployee from "./features/employees/pages/CreateEmployee";
import ActiveEmployees from "./features/employees/pages/ActiveEmployees";
import RelievedEmployees from "./features/employees/pages/RelievedEmployees";
import ProtectedRoute from "./shared/components/ProtectedRoute";
import EditEmployee from "./features/employees/pages/EditEmployee";
import {
  checkSession,
  clearLegacyAuthStorage,
  getAuthItem,
  getAuthUser,
} from "./utils/auth";

import NewTicket from "./features/tickets/pages/NewTicket";
import OpenedTickets from "./features/tickets/pages/OpenedTicket";
import TicketHistoryPage from "./features/tickets/pages/TicketHistory";
import ClosedTickets from "./features/tickets/pages/ClosedTicket";
import Layout from "./layouts/Layout";

import OfferLetterRequest from "./features/hrd/pages/OfferLetterRequest";
import OfferLetterDashboard from "./features/hrd/pages/OfferLetterDashboard";
import OfferLetterEdit from "./features/hrd/pages/OfferLetterEdit";
import CreatePayslip from "./features/hrd/pages/CreatePayslip";
import EditPayslip from "./features/hrd/pages/EditPayslip";
import PayslipDashboard from "./features/hrd/pages/PayslipDashboard";
import RelievingRequest from "./features/hrd/pages/RelievingRequest";
import EditRelieving from "./features/hrd/pages/EditRelieving";
import RelievedDashboard from "./features/hrd/pages/RelievedDashboard";

import ManpowerRequest from "./features/hrd/pages/ManpowerDashboard";
import NewRequest from "./features/hrd/pages/ManpowerNewRequest";
import RequestDetail from "./features/hrd/pages/ManpowerRequestEdit";
import UniformRequest from "./features/hrd/pages/UniformRequest";
import UniformRequestForm from "./features/hrd/pages/UniformRequestForm";
import LeadMasterPage from "./features/new_connections/LeadMasterPage";
import LeadFormPage from "./features/new_connections/LeadFormPage";

import ItemMaster from "./features/masters/components/ItemMaster";
import PageNotFound from "./shared/components/PageNotFound";
import FeaturePlaceholder from "./shared/components/FeaturePlaceholder";
import ITContactMatrix from "./shared/components/ITContactMatrix";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function getDefaultRoute() {
  const user = getAuthUser() || {};
  const role = (user.role || getAuthItem("role") || "")
    .toString()
    .trim()
    .toUpperCase();

  return ["ADMIN", "SUPER_ADMIN"].includes(role) ? "/create" : "/active";
}

function DefaultRedirect() {
  return <Navigate to={getDefaultRoute()} replace />;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    clearLegacyAuthStorage();

    const runCheck = () => {
      if (getAuthItem("token")) {
        checkSession();
      }
    };

    runCheck();
    setAuthReady(true);
    const interval = setInterval(runCheck, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!authReady) {
    return null;
  }

  return (
    <BrowserRouter>

      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
      />

      <Routes>

        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* PROTECTED + LAYOUT */}
        <Route element={<Layout />}>

          {/* DEFAULT */}
          <Route path="/" element={<DefaultRedirect />} />

          {/* EMPLOYEE */}
          <Route
            path="/create"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>
                <CreateEmployee />
              </ProtectedRoute>
            }
          />

          <Route
            path="/active"
            element={<ProtectedRoute><ActiveEmployees /></ProtectedRoute>}
          />

          <Route
            path="/relieved"
            element={<ProtectedRoute><RelievedEmployees /></ProtectedRoute>}
          />

          <Route
            path="/employee/edit/:empId"
            element={<ProtectedRoute><EditEmployee /></ProtectedRoute>}
          />

          {/* MASTERS */}
          <Route
            path="/masters"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>
                <ItemMaster />
              </ProtectedRoute>
            }
          />

          {/* TICKETS */}
          <Route
            path="/tickets/create"
            element={<ProtectedRoute><NewTicket /></ProtectedRoute>}
          />

          <Route
            path="/tickets/open"
            element={<ProtectedRoute><OpenedTickets /></ProtectedRoute>}
          />

          <Route
            path="/tickets/closed"
            element={<ProtectedRoute><ClosedTickets /></ProtectedRoute>}
          />

          <Route
            path="/tickets/history/:ticketId"
            element={<ProtectedRoute><TicketHistoryPage /></ProtectedRoute>}
          />

          {/* HRD - OFFER LETTER */}
          <Route
            path="/hrd/offer-letter"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD", "MANAGEMENT"]}
              >
                <OfferLetterDashboard />
              </ProtectedRoute>
            }
          />


          <Route
            path="/offer-letter-request"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD", "MANAGEMENT"]}
              >
                <OfferLetterRequest />
              </ProtectedRoute>
            }
          />


          <Route
            path="/offer-letter/edit/:id"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD", "MANAGEMENT"]}
              >
                <OfferLetterEdit />
              </ProtectedRoute>
            }
          />

          {/* ✅ HRD - MANPOWER (FIXED STRUCTURE) */}
          <Route
            path="/hrd/payslip"
            element={
              <ProtectedRoute>
                <PayslipDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hrd/payslip/create"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD", "HRD TEAM"]}
                designations={["MANAGER", "ADMIN", "RECRUITER", "RECRUTIER"]}
              >
                <CreatePayslip />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hrd/payslip/edit/:id"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD", "HRD TEAM"]}
                designations={["MANAGER", "ADMIN", "RECRUITER", "RECRUTIER"]}
              >
                <EditPayslip />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hrd/relieving"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD"]}
                designations={["MANAGER", "RECRUITER", "RECRUTIER", "ADMIN"]}
              >
                <RelievedDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hrd/relieving/create"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD"]}
                designations={["MANAGER", "RECRUITER", "RECRUTIER", "ADMIN"]}
              >
                <RelievingRequest />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hrd/relieving/create/:employeeId"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD"]}
                designations={["MANAGER", "RECRUITER", "RECRUTIER", "ADMIN"]}
              >
                <RelievingRequest />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hrd/relieving/edit/:id"
            element={
              <ProtectedRoute
                roles={["ADMIN", "SUPER_ADMIN", "USER_ACCOUNT"]}
                teams={["HRD"]}
                designations={["MANAGER", "RECRUITER", "RECRUTIER", "ADMIN"]}
              >
                <EditRelieving />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hrd/manpower"
            element={
              <ProtectedRoute>
                <ManpowerRequest />
              </ProtectedRoute>
            }
          />

          {/* ✅ NEW REQUEST PAGE */}
          <Route
            path="/hrd/manpower/new"
            element={
              <ProtectedRoute>
                <NewRequest />
              </ProtectedRoute>
            }
          />

          {/* ✅ REQUEST DETAIL PAGE */}
          <Route
            path="/hrd/manpower/:id"
            element={
              <ProtectedRoute>
                <RequestDetail />
              </ProtectedRoute>
            }
          />

          {/* UNIFORM */}
          <Route
            path="/hrd/uniform"
            element={<ProtectedRoute><UniformRequest /></ProtectedRoute>}
          />

          <Route
            path="/hrd/uniform/new"
            element={<ProtectedRoute><UniformRequestForm /></ProtectedRoute>}
          />

          <Route
            path="/customer-onboarding/lead-process"
            element={
              <ProtectedRoute>
                <LeadMasterPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer-onboarding/lead-process/new"
            element={
              <ProtectedRoute>
                <LeadFormPage mode="create" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer-onboarding/lead-process/view/:id"
            element={
              <ProtectedRoute>
                <LeadFormPage mode="view" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer-onboarding/lead-process/edit/:id"
            element={
              <ProtectedRoute>
                <LeadFormPage mode="edit" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer-onboarding/feasibility"
            element={
              <ProtectedRoute>
                <FeaturePlaceholder
                  title="Feasibility"
                  description="Customer onboarding feasibility workflow can be plugged in here next."
                />
              </ProtectedRoute>
            }
          />

          <Route
            path="/support/it-contact-matrix"
            element={
              <ProtectedRoute>
                <ITContactMatrix />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<PageNotFound />} />

        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
