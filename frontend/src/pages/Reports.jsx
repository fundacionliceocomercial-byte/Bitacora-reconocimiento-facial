import React from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";

import {
  BarChart3,
  UserRound,
  CalendarDays,
  FileText,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

const reports = [
  {
    title: "Resumen de asistencia",
    description:
      "Consulta indicadores generales de asistencia y comportamiento del personal por período y sede.",
    icon: BarChart3,
    path: "/reportes/resumen",
    featured: true,
  },
  {
    title: "Historial de empleado",
    description:
      "Consulta el historial de marcaciones de un empleado específico durante un período.",
    icon: UserRound,
    path: "/reportes/empleado",
  },
  {
    title: "Control diario",
    description:
      "Consulta quién registró entrada, quién registró salida y quién continúa dentro en una fecha determinada.",
    icon: CalendarDays,
    path: "/reportes/control-diario",
  },
  {
    title: "Bitácora mensual",
    description:
      "Genera y consulta el informe detallado de asistencia de un mes, con opciones de exportación.",
    icon: FileText,
    path: "/reportes/bitacora-mensual",
  },
  {
    title: "Lista de evacuación",
    description:
      "Consulta y exporta quién está actualmente dentro de cada sede, con sus contactos de emergencia, para usar en caso de desastre natural.",
    icon: AlertTriangle,
    path: "/reportes/evacuacion",
  },
];

function ReportCard({ report, onClick }) {
  const Icon = report.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full
        text-left
        bg-white
        border border-gray-200
        rounded-xl
        p-5
        shadow-sm
        hover:shadow-md
        hover:border-brand-200
        transition-all
        duration-200
        group
      "
    >
      <div className="flex items-start gap-4">
        <div
          className="
            w-11 h-11
            flex items-center justify-center
            rounded-lg
            bg-brand-50
            text-brand-600
            flex-shrink-0
            group-hover:bg-brand-100
            transition
          "
        >
          <Icon size={21} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-800">
            {report.title}
          </h3>

          <p className="text-sm text-gray-500 mt-1 leading-5">
            {report.description}
          </p>

          <div
            className="
              inline-flex items-center gap-1.5
              mt-4
              text-sm font-medium
              text-brand-600
              group-hover:text-brand-700
              transition
            "
          >
            Abrir reporte

            <ChevronRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Reports() {
  const navigate = useNavigate();

  return (
    <Layout>
      {/* Encabezado */}
      <div className="mb-7">
        <h2 className="text-xl font-semibold text-gray-800">
          Reportes
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Genera, consulta y analiza información de asistencia del
          personal.
        </p>
      </div>

      {/* Reporte destacado */}
      <div className="mb-4">
        <ReportCard
          report={reports[0]}
          onClick={() => navigate(reports[0].path)}
        />
      </div>

      {/* Reportes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reports.slice(1).map((report) => (
          <ReportCard
            key={report.path}
            report={report}
            onClick={() => navigate(report.path)}
          />
        ))}
      </div>
    </Layout>
  );
}