import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const linkClass = ({ isActive }) =>
  `block px-4 py-2 rounded-lg text-sm font-medium transition ${
    isActive ? "bg-brand-500 text-white" : "text-gray-600 hover:bg-brand-50"
  }`;

export default function Layout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col p-4">
        <h1 className="text-lg font-semibold text-brand-700 mb-8 px-2">
          Bitácora de Personal
        </h1>
        <nav className="space-y-1 flex-1">
          <NavLink to="/empleados" className={linkClass}>
            Empleados
          </NavLink>
          <NavLink to="/bitacora" className={linkClass}>
            Bitácora
          </NavLink>
        </nav>
        <button
          onClick={handleLogout}
          className="mt-4 px-4 py-2 text-sm text-gray-500 hover:text-red-600 text-left"
        >
          Cerrar sesión
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
