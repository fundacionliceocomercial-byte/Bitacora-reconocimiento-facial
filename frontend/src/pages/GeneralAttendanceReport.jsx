import React, { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client.js";
import {
  Search,
  RefreshCw,
  Users,
  LogIn,
  LogOut,
  ClipboardCheck,
  ClockAlert,
  FileSpreadsheet,
  CalendarDays,
  Building2,
  AlertCircle,
} from "lucide-react";

const todayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const firstDayOfMonth = () => `${todayLocal().slice(0, 7)}-01`;

const initialFilters = () => ({
  start_date: firstDayOfMonth(),
  end_date: todayLocal(),
  sede: "",
  employee: "",
});

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const formatTime = (value) => {
  if (!value) return "—";
  return value.slice(0, 5);
};

const statusLabels = {
  COMPLETA: "Jornada completa",
  PENDIENTE_SALIDA: "Salida pendiente",
  SALIDA_SIN_ENTRADA: "Salida sin entrada",
  JORNADA_EN_CURSO: "Jornada en curso",
  SIN_MARCADAS: "Sin marcaciones",
};

const statusClasses = {
  COMPLETA: "bg-green-100 text-green-800",
  PENDIENTE_SALIDA: "bg-amber-100 text-amber-800",
  SALIDA_SIN_ENTRADA: "bg-red-100 text-red-800",
  JORNADA_EN_CURSO: "bg-blue-100 text-blue-800",
  SIN_MARCADAS: "bg-gray-100 text-gray-700",
};

function MetricCard({ icon: Icon, title, value, description }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value ?? 0}</p>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700">
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function GeneralAttendanceReport() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async (selectedFilters) => {
    setLoading(true);
    setError("");

    try {
      const [reportData, employeeData] = await Promise.all([
        api.getGeneralAttendanceReport(selectedFilters),
        api.getEmployees(),
      ]);

      setReport(reportData);

      const employeeList = Array.isArray(employeeData)
        ? employeeData
        : (employeeData?.results ?? []);

      setEmployees(employeeList);
    } catch (err) {
      setError(
        err?.message ||
          "No fue posible cargar el reporte general de asistencia.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleSearch = (event) => {
    event.preventDefault();

    if (!filters.start_date || !filters.end_date) {
      setError("Selecciona una fecha inicial y una fecha final.");
      return;
    }

    if (filters.start_date > filters.end_date) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    setAppliedFilters({ ...filters });
  };

  const handleReset = () => {
    const defaults = initialFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
  };

  const summary = report?.summary ?? {};
  const rows = report?.results ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Reporte general de asistencia
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Consulta las entradas, salidas y novedades del personal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadReport(appliedFilters)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        <form
          onSubmit={handleSearch}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <Search size={19} className="text-emerald-700" />
            <h2 className="font-semibold text-gray-900">Filtros de consulta</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Fecha inicial
              </span>
              <input
                type="date"
                value={filters.start_date}
                max={todayLocal()}
                onChange={(event) =>
                  updateFilter("start_date", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Fecha final
              </span>
              <input
                type="date"
                value={filters.end_date}
                min={filters.start_date}
                max={todayLocal()}
                onChange={(event) =>
                  updateFilter("end_date", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Sede
              </span>
              <select
                value={filters.sede}
                onChange={(event) => updateFilter("sede", event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todas las sedes</option>
                <option value="CENTRO">Centro</option>
                <option value="NORTE">Norte</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Empleado
              </span>
              <select
                value={filters.employee}
                onChange={(event) =>
                  updateFilter("employee", event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todos los empleados</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name ||
                      `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Search size={16} />
              Consultar reporte
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Limpiar filtros
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No se pudo cargar el reporte</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={16} />
              {report
                ? `${formatDate(report.start_date)} — ${formatDate(report.end_date)}`
                : "Período seleccionado"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Building2 size={16} />
              {report?.sede || "Todas las sedes"}
            </span>
            <span>
              Horario de referencia:{" "}
              <strong>
                {report?.schedule
                  ? `${report.schedule.entry_time} a ${report.schedule.exit_time}`
                  : "—"}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Users}
            title="Días con marcaciones"
            value={summary.days_with_records}
            description="Filas agrupadas por empleado y día"
          />
          <MetricCard
            icon={LogIn}
            title="Entradas registradas"
            value={summary.entries}
          />
          <MetricCard
            icon={LogOut}
            title="Salidas registradas"
            value={summary.exits}
          />
          <MetricCard
            icon={ClipboardCheck}
            title="Jornadas completas"
            value={summary.complete_days}
          />
          <MetricCard
            icon={ClockAlert}
            title="Salidas pendientes"
            value={summary.pending_exits}
            description="Jornadas finalizadas sin salida"
          />
          <MetricCard
            icon={AlertCircle}
            title="Salidas sin entrada"
            value={summary.exits_without_entry}
            description="Requieren revisión"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Detalle de asistencia
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {report?.count ?? 0} filas encontradas
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
              <RefreshCw size={18} className="animate-spin" />
              Cargando reporte...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardCheck size={32} className="mx-auto text-gray-400" />
              <p className="mt-3 font-medium text-gray-800">
                No hay marcaciones para estos filtros
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Prueba con otro período o selecciona todas las sedes.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Empleado</th>
                    <th className="px-5 py-3 font-semibold">Documento</th>
                    <th className="px-5 py-3 font-semibold">Sede</th>
                    <th className="px-5 py-3 font-semibold">Fecha</th>
                    <th className="px-5 py-3 font-semibold">Entrada</th>
                    <th className="px-5 py-3 font-semibold">Salida</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr
                      key={`${row.employee}-${row.date}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900">
                        {row.employee_name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {row.document_id || "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.sede === "NORTE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {row.sede === "NORTE" ? "Norte" : "Centro"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {formatDate(row.date)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                        {formatTime(row.entrada_time)}
                        {row.entrada_tardia && (
                          <span className="ml-2 text-xs font-medium text-amber-700">
                            Tarde
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                        {formatTime(row.salida_time)}
                        {row.salida_anticipada && (
                          <span className="ml-2 text-xs font-medium text-amber-700">
                            Anticipada
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            statusClasses[row.status] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {statusLabels[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="max-w-xs px-5 py-4 text-gray-600">
                        {row.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Las marcaciones se agrupan por empleado y fecha local. Las referencias
          de horario son 08:00 y 17:00; no se aplica una tolerancia de
          puntualidad.
        </p>
      </div>
    </Layout>
  );
}
