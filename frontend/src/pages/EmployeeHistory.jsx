import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client.js";
import {
  UserRound,
  Search,
  CalendarDays,
  Phone,
  Droplet,
  Building2,
  LogIn,
  LogOut,
  ClipboardCheck,
  ClockAlert,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const todayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const firstDayOfMonth = () => `${todayLocal().slice(0, 7)}-01`;

const formatDateLong = (value) => {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (value) => (value ? value.slice(0, 5) : null);

const statusConfig = {
  COMPLETA: { label: "Jornada completa", dot: "bg-green-500", text: "text-green-700" },
  PENDIENTE_SALIDA: { label: "Salida pendiente", dot: "bg-amber-500", text: "text-amber-700" },
  SALIDA_SIN_ENTRADA: { label: "Salida sin entrada", dot: "bg-red-500", text: "text-red-700" },
  JORNADA_EN_CURSO: { label: "Jornada en curso", dot: "bg-blue-500", text: "text-blue-700" },
  SIN_MARCADAS: { label: "Sin marcaciones", dot: "bg-gray-300", text: "text-gray-500" },
};

function MetricCard({ icon: Icon, title, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon size={19} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="mt-0.5 text-xl font-semibold text-gray-800">{value ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeHistory() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayLocal);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getEmployees()
      .then((data) => setEmployees(Array.isArray(data) ? data : data?.results ?? []))
      .catch(() => {});
  }, []);

  const selectedEmployee = employees.find((emp) => String(emp.id) === String(employeeId));

  const loadHistory = async () => {
    if (!employeeId) return;

    if (startDate > endDate) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api.getGeneralAttendanceReport({
        employee: employeeId,
        start_date: startDate,
        end_date: endDate,
      });
      setReport(data);
    } catch (err) {
      setError(err?.message || "No fue posible cargar el historial.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      loadHistory();
    } else {
      setReport(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadHistory();
  };

  const summary = report?.summary ?? {};
  const rows = report?.results ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-brand-600">
            <UserRound size={18} />
            <span>Reportes / Historial de empleado</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
            Historial de empleado
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Consulta la línea de tiempo de marcaciones de un empleado específico
            durante un período.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Empleado
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Selecciona un empleado...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} · {emp.document_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Desde
              </label>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Hasta
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={todayLocal()}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="submit"
              disabled={!employeeId || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search size={16} />
              {loading ? "Consultando..." : "Consultar historial"}
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!employeeId && !error && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
            Seleccioná un empleado para ver su historial de marcaciones.
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            <RefreshCw size={18} className="mx-auto mb-2 animate-spin" />
            Cargando historial...
          </div>
        )}

        {!loading && employeeId && report && selectedEmployee && (
          <>
            {/* Ficha del empleado */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <UserRound size={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedEmployee.full_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedEmployee.document_id}
                      {selectedEmployee.position && ` · ${selectedEmployee.position}`}
                      {selectedEmployee.department && ` · ${selectedEmployee.department}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    <Building2 size={13} />
                    {selectedEmployee.sede === "NORTE" ? "Sede Norte" : "Sede Centro"}
                  </span>
                  {selectedEmployee.phone && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      <Phone size={13} />
                      {selectedEmployee.phone}
                    </span>
                  )}
                  {selectedEmployee.blood_type && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                      <Droplet size={13} />
                      {selectedEmployee.blood_type}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Período y horario de referencia */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                {formatDateLong(report.start_date).split(",")[0]} — {formatDateLong(report.end_date).split(",")[0]}
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Horario de referencia:{" "}
                <strong>
                  {report.schedule
                    ? `${report.schedule.entry_time} a ${report.schedule.exit_time}`
                    : "—"}
                </strong>
              </span>
            </div>

            {/* Métricas del empleado */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
              <MetricCard icon={CalendarDays} title="Días con marcación" value={summary.days_with_records} />
              <MetricCard icon={LogIn} title="Entradas" value={summary.entries} />
              <MetricCard icon={LogOut} title="Salidas" value={summary.exits} />
              <MetricCard icon={ClipboardCheck} title="Jornadas completas" value={summary.complete_days} />
              <MetricCard icon={ClockAlert} title="Salidas pendientes" value={summary.pending_exits} />
              <MetricCard icon={AlertCircle} title="Salidas sin entrada" value={summary.exits_without_entry} />
            </div>

            {/* Línea de tiempo */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-5 font-semibold text-gray-900">Línea de tiempo</h3>

              {rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  No hay marcaciones para este período.
                </p>
              ) : (
                <ol className="relative space-y-6 border-l border-gray-200 pl-6">
                  {rows.map((row) => {
                    const config = statusConfig[row.status] ?? statusConfig.SIN_MARCADAS;

                    return (
                      <li key={row.date} className="relative">
                        <span
                          className={`absolute -left-[29px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${config.dot}`}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-800 capitalize">
                            {formatDateLong(row.date)}
                          </p>
                          <span className={`text-xs font-medium ${config.text}`}>
                            · {config.label}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                          {row.entrada_time ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                              <LogIn size={12} />
                              Entrada {formatTime(row.entrada_time)}
                              {row.entrada_tardia && (
                                <span className="font-semibold text-amber-700"> · Tarde</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">Sin entrada</span>
                          )}

                          {row.salida_time ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <LogOut size={12} />
                              Salida {formatTime(row.salida_time)}
                              {row.salida_anticipada && (
                                <span className="font-semibold"> · Anticipada</span>
                              )}
                            </span>
                          ) : row.entrada_time ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                              Sigue adentro
                            </span>
                          ) : null}
                        </div>

                        {row.notes && (
                          <p className="mt-2 text-sm text-gray-500">
                            <span className="font-medium text-gray-600">Observación: </span>
                            {row.notes}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}