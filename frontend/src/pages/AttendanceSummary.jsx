import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client.js";
import {
  Users,
  UserCheck,
  UserX,
  LogIn,
  LogOut,
  ScanFace,
  Hand,
  RefreshCw,
  CalendarDays,
  Building2,
  AlertCircle,
  BarChart3,
} from "lucide-react";

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFirstDayOfMonth() {
  return `${getLocalDate().slice(0, 7)}-01`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(`${value}T12:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function MetricCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            {Number(value ?? 0).toLocaleString("es-CO")}
          </p>
          <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function BarRow({ label, value, max, color }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold tabular-nums text-gray-800">
          {Number(value ?? 0).toLocaleString("es-CO")}
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function AttendanceSummary() {
  const [startDate, setStartDate] = useState(getFirstDayOfMonth);
  const [endDate, setEndDate] = useState(getLocalDate);
  const [sede, setSede] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSummary(filters = {}) {
    setLoading(true);
    setError("");

    try {
      const result = await api.getAttendanceSummary({
        startDate: filters.startDate ?? startDate,
        endDate: filters.endDate ?? endDate,
        sede: filters.sede ?? sede,
      });

      setData(result);
    } catch (err) {
      setError(
        err.message || "No fue posible cargar el resumen de asistencia."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    // La carga inicial usa los filtros predeterminados.
    // Los cambios posteriores se aplican con el botón Consultar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    if (!startDate || !endDate) {
      setError("Selecciona la fecha inicial y la fecha final.");
      return;
    }

    if (startDate > endDate) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    loadSummary();
  }

  function handleReset() {
    const firstDay = getFirstDayOfMonth();
    const today = getLocalDate();

    setStartDate(firstDay);
    setEndDate(today);
    setSede("");

    loadSummary({
      startDate: firstDay,
      endDate: today,
      sede: "",
    });
  }

  const daily = data?.daily ?? [];
  const maxDaily = Math.max(
    1,
    ...daily.map((item) => Math.max(item.entries, item.exits))
  );

  const methods = data?.methods ?? {};
  const totalMethods = (methods.facial ?? 0) + (methods.manual ?? 0);

  const employees = data?.employees ?? {};
  const attendance = data?.attendance ?? {};

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm text-brand-600">
              <BarChart3 size={18} />
              <span>Reportes / Resumen de asistencia</span>
            </div>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
              Resumen de asistencia
            </h2>

            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Indicadores generales de personal y marcaciones registradas,
              filtrados por período y sede.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSummary()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">Período de consulta</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label
                htmlFor="summary-start-date"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Desde
              </label>
              <input
                id="summary-start-date"
                type="date"
                value={startDate}
                max={endDate || getLocalDate()}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                required
              />
            </div>

            <div>
              <label
                htmlFor="summary-end-date"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Hasta
              </label>
              <input
                id="summary-end-date"
                type="date"
                value={endDate}
                min={startDate}
                max={getLocalDate()}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                required
              />
            </div>

            <div>
              <label
                htmlFor="summary-sede"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Sede
              </label>
              <select
                id="summary-sede"
                value={sede}
                onChange={(event) => setSede(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Todas las sedes</option>
                <option value="CENTRO">Centro</option>
                <option value="NORTE">Norte</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Consultando..." : "Consultar"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                title="Restablecer filtros"
                aria-label="Restablecer filtros"
                className="rounded-lg border border-gray-200 px-3 py-2.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw size={17} />
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No se pudo cargar el resumen</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            Cargando indicadores de asistencia...
          </div>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>
                Período: {formatDate(data.start_date)} — {formatDate(data.end_date)}
              </span>

              <span className="text-gray-300">|</span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                <Building2 size={14} />
                {data.sede === "CENTRO"
                  ? "Sede Centro"
                  : data.sede === "NORTE"
                    ? "Sede Norte"
                    : "Todas las sedes"}
              </span>
            </div>

            <section>
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900">Personal</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Estado actual de los empleados según el registro del sistema.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  title="Total de empleados"
                  value={employees.total}
                  subtitle="Personal de las sedes seleccionadas"
                  icon={Users}
                  color="blue"
                />
                <MetricCard
                  title="Empleados activos"
                  value={employees.active}
                  subtitle="Con estado activo en el sistema"
                  icon={UserCheck}
                  color="green"
                />
                <MetricCard
                  title="Empleados inactivos"
                  value={employees.inactive}
                  subtitle="Con estado inactivo en el sistema"
                  icon={UserX}
                  color="slate"
                />
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900">Marcaciones del período</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Cada registro de entrada o salida cuenta como una marcación.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  title="Total de marcaciones"
                  value={attendance.total}
                  subtitle="Entradas más salidas"
                  icon={CalendarDays}
                  color="blue"
                />
                <MetricCard
                  title="Entradas registradas"
                  value={attendance.entries}
                  subtitle="Marcaciones de tipo entrada"
                  icon={LogIn}
                  color="green"
                />
                <MetricCard
                  title="Salidas registradas"
                  value={attendance.exits}
                  subtitle="Marcaciones de tipo salida"
                  icon={LogOut}
                  color="amber"
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900">
                    Entradas y salidas por día
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Comparación diaria de las marcaciones registradas.
                  </p>
                </div>

                <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-green-500" />
                    Entradas
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                    Salidas
                  </span>
                </div>

                {daily.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">
                    No hay marcaciones para este período.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-4 overflow-y-auto pr-2">
                    {daily.map((item) => (
                      <div key={item.date} className="space-y-2">
                        <p className="text-xs font-medium text-gray-500">
                          {formatDate(item.date)}
                        </p>
                        <BarRow
                          label="Entradas"
                          value={item.entries}
                          max={maxDaily}
                          color="bg-green-500"
                        />
                        <BarRow
                          label="Salidas"
                          value={item.exits}
                          max={maxDaily}
                          color="bg-amber-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900">
                    Métodos de marcación
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Distribución según el método guardado en cada registro.
                  </p>
                </div>

                {totalMethods === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">
                    No hay marcaciones para este período.
                  </p>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <ScanFace size={21} />
                      </div>
                      <div className="flex-1">
                        <BarRow
                          label="Reconocimiento facial"
                          value={methods.facial}
                          max={totalMethods}
                          color="bg-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                        <Hand size={21} />
                      </div>
                      <div className="flex-1">
                        <BarRow
                          label="Registro manual"
                          value={methods.manual}
                          max={totalMethods}
                          color="bg-purple-500"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">
                        Total de registros clasificados por método
                      </p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {totalMethods.toLocaleString("es-CO")}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Marcaciones por sede
              </h3>
              <p className="mb-5 mt-1 text-sm text-gray-500">
                Volumen de registros por sede dentro del período consultado.
              </p>

              {data.by_sede.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  No hay marcaciones para mostrar.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {data.by_sede.map((item) => (
                    <div key={item.sede || "sin-sede"}>
                      <BarRow
                        label={
                          item.sede === "CENTRO"
                            ? "Centro"
                            : item.sede === "NORTE"
                              ? "Norte"
                              : "Sin sede asignada"
                        }
                        value={item.total}
                        max={Math.max(
                          1,
                          ...data.by_sede.map((row) => row.total)
                        )}
                        color={
                          item.sede === "NORTE"
                            ? "bg-blue-500"
                            : "bg-green-500"
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : !error ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            No hay información disponible para mostrar.
          </div>
        ) : null}
      </div>
    </Layout>
  );
}