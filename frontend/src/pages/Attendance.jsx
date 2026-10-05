import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client";

const now = new Date();
const PAGE_SIZE = 20;

function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function formatConfidence(value) {
  return value != null ? `${Math.round(value * 100)}%` : null;
}

// row.date llega como "2026-10-01" (solo fecha, sin hora). Si se le pasa
// ese string directo a `new Date(...)`, JS lo interpreta como medianoche
// UTC y al mostrarlo en hora local (Colombia, UTC-5) retrocede al día
// anterior. Construir la fecha desde los componentes evita ese desfase.
function formatDateOnly(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Attendance() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(""); // filtro opcional por día exacto, ej. "2026-09-30"
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getMonthlyLogs(year, month, { day, page, pageSize: PAGE_SIZE });
      setLogs(data.results || []);
      setTotalPages(data.total_pages || 1);
      setCount(data.count || 0);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, page]);

  // Si cambia el mes, año o el filtro de día, siempre volvemos a la página 1
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  const handleExport = async (format) => {
    setStatus(`Generando ${format.toUpperCase()}...`);
    try {
      await api.exportMonthlyLogs(year, month, format);
      setStatus("");
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Bitácora mensual</h2>
        <div className="flex gap-2">
          <button onClick={() => handleExport("xlsx")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Exportar Excel
          </button>
          <button onClick={() => handleExport("pdf")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1, 1).toLocaleString("es", { month: "long" })}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />

        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
          <label className="text-sm text-gray-500">Día:</label>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {day && (
            <button
              onClick={() => setDay("")}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Quitar filtro
            </button>
          )}
        </div>
      </div>

      {status && (
        <div className="mb-4 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
          {status}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Salida</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin registros para este filtro.</td></tr>
            )}
            {logs.map((row) => (
              <tr key={`${row.employee}-${row.date}`} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-700">{row.employee_name}</td>
                <td className="px-4 py-3 text-gray-500">{formatDateOnly(row.date)}</td>
                <td className="px-4 py-3">
                  {row.entrada_time ? (
                    <div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full text-brand-700 bg-brand-50">
                        {formatTime(row.entrada_time)}
                      </span>
                      {row.entrada_confidence != null && (
                        <span className="ml-2 text-xs text-gray-400">{formatConfidence(row.entrada_confidence)}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.salida_time ? (
                    <div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full text-amber-700 bg-amber-50">
                        {formatTime(row.salida_time)}
                      </span>
                      {row.salida_confidence != null && (
                        <span className="ml-2 text-xs text-gray-400">{formatConfidence(row.salida_confidence)}</span>
                      )}
                    </div>
                  ) : row.entrada_time ? (
                    <span className="text-xs font-medium px-2 py-1 rounded-full text-gray-500 bg-gray-100">Sigue adentro</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && count > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{count} registro{count === 1 ? "" : "s"} en total</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}