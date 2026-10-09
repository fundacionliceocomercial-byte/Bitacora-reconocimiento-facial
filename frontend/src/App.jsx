import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login.jsx";
import Employees from "./pages/Employees.jsx";
import Attendance from "./pages/Attendance.jsx";
import Reports from "./pages/Reports.jsx";
import MonthlyReport from "./pages/MonthlyReport.jsx";
import AttendanceSummary from "./pages/AttendanceSummary.jsx";
import GeneralAttendanceReport from "./pages/GeneralAttendanceReport.jsx";
import EvacuationList from "./pages/EvacuationList.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/empleados"
        element={
          <ProtectedRoute>
            <Employees />
          </ProtectedRoute>
        }
      />

      <Route
        path="/bitacora"
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes/resumen"
        element={
          <ProtectedRoute>
            <AttendanceSummary />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes/empleado"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes/control-diario"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reportes/bitacora-mensual"
        element={
          <ProtectedRoute>
            <MonthlyReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/general"
        element={
          <ProtectedRoute>
            <GeneralAttendanceReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/evacuacion"
        element={
          <ProtectedRoute>
            <EvacuationList />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/empleados" replace />} />

      <Route path="*" element={<Navigate to="/empleados" replace />} />
    </Routes>
  );
}
