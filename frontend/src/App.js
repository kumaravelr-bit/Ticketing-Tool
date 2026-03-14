import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import Login from "./components/Login";
import CreateEmployee from "./components/CreateEmployee";
import ActiveEmployees from "./components/ActiveEmployees";
import RelievedEmployees from "./components/RelievedEmployees";
import ProtectedRoute from "./components/ProtectedRoute";
import EditEmployee from "./components/EditEmployee";
import { checkSession } from "./utils/auth";
import NewTicket from "./ticketing_tools/NewTicket";
import PageNotFound from "./components/PageNotFound";
import OpenedTickets from "./ticketing_tools/OpenedTicket";
import Layout from "./layouts/Layout";


import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
export default function App() {

  useEffect(() => {
    checkSession();

    const interval = setInterval(() => {
      checkSession();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
    <ToastContainer
    position="top-right"
    autoClose={3000}
    hideProgressBar={false}
    newestOnTop
    closeOnClick
    pauseOnHover
    theme="colored"
  />
      <Routes>

        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* LAYOUT WRAPPER */}
        <Route element={<Layout />}>

          <Route path="/create" element={ <ProtectedRoute> <CreateEmployee />
              </ProtectedRoute> }/>

          <Route path="/active" element={ <ProtectedRoute> <ActiveEmployees />
              </ProtectedRoute> }/>

          <Route path="/relieved" element={ <ProtectedRoute><RelievedEmployees />
              </ProtectedRoute>}/>

          <Route path="/employee/edit/:empId" element={ <ProtectedRoute><EditEmployee />
              </ProtectedRoute>}/>

          <Route path="/tickets/create" element={ <ProtectedRoute><NewTicket />
              </ProtectedRoute>}/>

          <Route path="/tickets/open" element={ <ProtectedRoute><OpenedTickets />
              </ProtectedRoute>}/>
        </Route>

        {/* DEFAULT */}
        <Route path="/" element={<PageNotFound />} />
        <Route path="*" element={<PageNotFound />} />

      </Routes>
    </BrowserRouter>
  );
}