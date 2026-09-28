import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FlaskConical, LogOut } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("lab_logged_in");
    navigate("/login");
  }

  const isActive = (path) => (location.pathname === path ? "active" : "");

  return (
    <div className="navbar no-print">
      <div className="brand"><FlaskConical size={20} strokeWidth={2.2} /> Lab Management System</div>
      <nav>
        <Link to="/" className={isActive("/")}>Dashboard</Link>
        <Link to="/employees" className={isActive("/employees")}>Customer Records</Link>
        <Link to="/companies" className={isActive("/companies")}>Companies</Link>
        <Link to="/tat-list" className={isActive("/tat-list")}>TPA List</Link>
      </nav>
      <div className="right">
        <button className="btn btn-secondary btn-sm" onClick={logout}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );
}
