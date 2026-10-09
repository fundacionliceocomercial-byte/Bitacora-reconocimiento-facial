import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const linkClass = ({ isActive }) =>
  `block px-4 py-2 rounded-lg text-sm font-medium transition ${
    isActive ? "bg-brand-500 text-white" : "text-gray-600 hover:bg-brand-50"
  }`;

function LogoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Layout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col p-4 sticky top-0 h-screen">
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

          <NavLink to="/reportes" className={linkClass}>
            Reportes
          </NavLink>
        </nav>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
          >
            <LogoutIcon />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
