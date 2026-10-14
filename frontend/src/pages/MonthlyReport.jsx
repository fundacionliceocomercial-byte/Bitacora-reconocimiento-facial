import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client";
import SedeBadge from "../components/SedeBadge.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import NotesCell from "../components/NotesCell.jsx";
import { formatTime, formatDateOnly, formatConfidence } from "../utils/formatters.js";
import {
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogIn,
  LogOut,
  Users,
} from "lucide-react";

const now = new Date();
const PAGE_SIZE = 20;

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function TimeBadge({ time, confidence, type }) {
  if (!time) {
    return <span className="text-xs text-gray-300">—</span>;
  }

  const isEntry = type === "entrada";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          isEntry
            ? "text-brand-700 bg-brand-50"
            : "text-amber-700 bg-amber-50"
        }`}
      >
        {formatTime(time)}
      </span>

      {confidence != null && (
        <span className="text-xs text-gray-400">
          {formatConfidence(confidence)}
        </span>
      )}
    </div>
  );
}

export default function MonthlyReport() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState("");
  const [sede, setSede] = useState("");

  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setStatus("");

    try {
      const data = await api.getMonthlyLogs(year, month, {
        day,
        sede,
        page,
        pageSize: PAGE_SIZE,
      });

      setLogs(data.results || []);
      setCount(data.count || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, sede, page]);

  useEffect(() => {
    setPage(1);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, sede]);

  const handleExport = async (format) => {
    setStatus(`Generando ${format.toUpperCase()}...`);

    try {
      await api.exportMonthlyLogs(year, month, format, {
        day,
        sede,
      });

      setStatus("");
    } catch (err) {
      setStatus(err.message);
    }
  };

  const handleSaveNotes = async (logId, notes) => {
    try {
      await api.updateLogNotes(logId, notes);

      setLogs((prev) =>
        prev.map((row) =>
          (row.notes_log_id ||
            row.entrada_log_id ||
            row.salida_log_id) === logId
            ? {
                ...row,
                notes,
                notes_log_id: logId,
              }
            : row
        )
      );
    } catch (err) {
      setStatus(err.message);
    }
  };

  const entries = logs.filter((row) => row.entrada_time).length;
  const exits = logs.filter((row) => row.salida_time).length;
  const stillInside = logs.filter(
    (row) => row.entrada_time && !row.salida_time
  ).length;

  const hasFilters = Boolean(day || sede);

  return (
    <Layout>
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Bitácora mensual
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Reporte detallado de entradas y salidas del personal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("xlsx")}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <FileSpreadsheet size={16} />
            Exportar Excel
          </button>

          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <FileText size={16} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Período */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Mes
            </label>

            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {MONTHS.map((monthName, index) => (
                <option key={monthName} value={index + 1}>
                  {monthName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Año
            </label>

            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Sede
            </label>

            <select
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todas las sedes</option>
              <option value="CENTRO">Centro</option>
              <option value="NORTE">Norte</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Día específico
            </label>

            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setDay("");
                setSede("");
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw size={15} />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Estado */}
      {status && (
        <div className="mb-5 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
          {status}
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <SummaryCard
          icon={ClipboardList}
          label="Registros"
          value={count}
        />

        <SummaryCard
          icon={LogIn}
          label="Con entrada"
          value={entries}
        />

        <SummaryCard
          icon={LogOut}
          label="Con salida"
          value={exits}
        />

        <SummaryCard
          icon={Users}
          label="Continúan dentro"
          value={stillInside}
        />
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">
              Detalle de asistencia
            </h3>

            <p className="text-xs text-gray-400 mt-0.5">
              {MONTHS[month - 1]} {year}
              {sede
                ? ` · ${sede === "NORTE" ? "Norte" : "Centro"}`
                : ""}
              {day ? ` · ${formatDateOnly(day)}` : ""}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">
                  Empleado
                </th>

                <th className="px-4 py-3 whitespace-nowrap">
                  Documento
                </th>

                <th className="px-4 py-3 whitespace-nowrap">
                  Sede
                </th>

                <th className="px-4 py-3 whitespace-nowrap">
                  Fecha
                </th>

                <th className="px-4 py-3 whitespace-nowrap">
                  Entrada
                </th>

                <th className="px-4 py-3 whitespace-nowrap">
                  Salida
                </th>

                <th className="px-4 py-3 min-w-[220px]">
                  Observación
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />
                      Cargando reporte...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && logs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              )}

              {!loading &&
                logs.map((row) => (
                  <tr
                    key={`${row.employee}-${row.date}`}
                    className="border-t border-gray-100 hover:bg-gray-50/60 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-700">
                        {row.employee_name}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-500">
                      {row.employee_document || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <SedeBadge sede={row.sede} />
                    </td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateOnly(row.date)}
                    </td>

                    <td className="px-4 py-3">
                      <TimeBadge
                        time={row.entrada_time}
                        confidence={row.entrada_confidence}
                        type="entrada"
                      />
                    </td>

                    <td className="px-4 py-3">
                      {row.salida_time ? (
                        <TimeBadge
                          time={row.salida_time}
                          confidence={row.salida_confidence}
                          type="salida"
                        />
                      ) : row.entrada_time ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-gray-500 bg-gray-100">
                          Sigue adentro
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <NotesCell
                        row={row}
                        onSaved={handleSaveNotes}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && count > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>
              {count} registro{count === 1 ? "" : "s"} en total
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.max(current - 1, 1))
                }
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                <ChevronLeft size={15} />
                Anterior
              </button>

              <span>
                Página {page} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.min(current + 1, totalPages)
                  )
                }
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                Siguiente
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}