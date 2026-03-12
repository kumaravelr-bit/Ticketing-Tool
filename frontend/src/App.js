import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";

import Login from "./components/Login";
import CreateEmployee from "./components/CreateEmployee";
import ActiveEmployees from "./components/ActiveEmployees";
import RelievedEmployees from "./components/RelievedEmployees";
import ProtectedRoute from "./components/ProtectedRoute";
import EditEmployee from "./components/EditEmployee";
import { checkSession } from "./utils/auth";

export default function App() {

  // 🔐 Auto logout after 2 hours
  useEffect(() => {
    checkSession(); // run once on load

    const interval = setInterval(() => {
      checkSession();
    }, 60 * 1000); // check every 1 minute

    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* PROTECTED */}
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <CreateEmployee />
            </ProtectedRoute>
          }
        />

        <Route
          path="/active"
          element={
            <ProtectedRoute>
              <ActiveEmployees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/relieved"
          element={
            <ProtectedRoute>
              <RelievedEmployees />
            </ProtectedRoute>
          }
        />

        <Route
  path="/employee/edit/:empId"
  element={
    <ProtectedRoute>
      <EditEmployee />
    </ProtectedRoute>
  }
/>
        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />

      </Routes>
    </BrowserRouter>
  );
}
