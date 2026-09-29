import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Employees from "./pages/Employees.jsx";
import Companies from "./pages/Companies.jsx";
import TatList from "./pages/TatList.jsx";
import CustomerDetail from "./pages/CustomerDetail.jsx";

function isLoggedIn() {
  return localStorage.getItem("lab_logged_in") === "true";
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <PrivateRoute>
            <Employees />
          </PrivateRoute>
        }
      />
      <Route
        path="/records/:id"
        element={
          <PrivateRoute>
            <CustomerDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/companies"
        element={
          <PrivateRoute>
            <Companies />
          </PrivateRoute>
        }
      />
      <Route
        path="/tat-list"
        element={
          <PrivateRoute>
            <TatList />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
