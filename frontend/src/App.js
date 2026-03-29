import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";

import Login from "./components/Login";
import CreateEmployee from "./components/CreateEmployee";
import ActiveEmployees from "./components/ActiveEmployees";
import RelievedEmployees from "./components/RelievedEmployees";
import ProtectedRoute from "./components/ProtectedRoute";
import EditEmployee from "./components/EditEmployee";
import { checkSession } from "./utils/auth";

import NewTicket from "./ticketing_tools/NewTicket";
import OpenedTickets from "./ticketing_tools/OpenedTicket";
import TicketHistoryPage from "./ticketing_tools/TicketHistory";
import ClosedTickets from "./ticketing_tools/ClosedTicket";
import Layout from "./layouts/Layout";

import OfferLetterRequest from "./hrd/OfferLetterRequest";
import OfferLetterDashboard from "./hrd/OfferLetterDashboard";
import OfferLetterEdit from "./hrd/OfferLetterEdit";

import ManpowerRequest from "./hrd/ManpowerRequest";
import NewRequest from "./hrd/ManpowerNewRequest";
import RequestDetail from "./hrd/RequestDetails";

import ItemMaster from "./components/ItemMaster";
import PageNotFound from "./components/PageNotFound";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function App() {

  useEffect(() => {
    const runCheck = () => {
      if (localStorage.getItem("token")) {
        checkSession();
      }
    };

    runCheck();
    const interval = setInterval(runCheck, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>

      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
      />

      <Routes>

        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* PROTECTED + LAYOUT */}
        <Route element={<Layout />}>

          {/* DEFAULT */}
          <Route path="/" element={<Navigate to="/active" replace />} />

          {/* EMPLOYEE */}
          <Route
            path="/create"
            element={<ProtectedRoute><CreateEmployee /></ProtectedRoute>}
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
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN", "HR", "IT_ADMIN"]}>
                <OfferLetterDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/offer-letter-request"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN", "HR", "IT_ADMIN"]}>
                <OfferLetterRequest />
              </ProtectedRoute>
            }
          />

          <Route
            path="/offer-letter/edit/:id"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN", "HR", "IT_ADMIN"]}>
                <OfferLetterEdit />
              </ProtectedRoute>
            }
          />

          {/* ✅ HRD - MANPOWER (FIXED STRUCTURE) */}
          <Route
            path="/hrd/manpower"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN", "HR", "IT_ADMIN"]}>
                <ManpowerRequest />
              </ProtectedRoute>
            }
          />

          {/* ✅ NEW REQUEST PAGE */}
          <Route
            path="/hrd/manpower/new"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN", "HR", "IT_ADMIN"]}>
                <NewRequest />
              </ProtectedRoute>
            }
          />

          {/* ✅ REQUEST DETAIL PAGE */}
          <Route
            path="/hrd/manpower/:id"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN", "HR", "IT_ADMIN"]}>
                <RequestDetail />
              </ProtectedRoute>
            }
          />

          {/* OTHER */}
          <Route
            path="/hrd/uniform"
            element={<ProtectedRoute><PageNotFound /></ProtectedRoute>}
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