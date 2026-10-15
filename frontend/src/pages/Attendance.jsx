import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client";
import SedeBadge from "../components/SedeBadge.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import NotesCell from "../components/NotesCell.jsx";
import { formatTime, formatDateOnly, formatConfidence } from "../utils/formatters.js";
import {
  RefreshCw,
  ClipboardList,
  LogIn,
  LogOut,
  Users,
} from "lucide-react";

const now = new Date();
const PAGE_SIZE = 20;

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function Attendance() {
  const [day, setDay] = useState(() => getLocalDateString(now));
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sede, setSede] = useState("");

  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setStatus("");

    try {
      const data = await api.getMonthlyLogs(year, month, {
        day,
        sede,
        page: 1,
        pageSize: PAGE_SIZE,
      });

      setLogs(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      setStatus(err.message || "No fue posible cargar las marcaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day, sede]);

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
      setStatus(err.message || "No fue posible guardar la observación.");
      throw err;
    }
  };

  const entries = logs.filter((row) => row.entrada_time).length;
  const exits = logs.filter((row) => row.salida_time).length;
  const stillInside = logs.filter(
    (row) => row.status === "JORNADA_EN_CURSO"
  ).length;

  const handleDayChange = (selectedDay) => {
    setDay(selectedDay);

    if (selectedDay) {
      const [selectedYear, selectedMonth] = selectedDay
        .split("-")
        .map(Number);

      setYear(selectedYear);
      setMonth(selectedMonth);
    }
  };

  const clearFilters = () => {
    const today = getLocalDateString();

    setDay(today);
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSede("");
  };

  return (
    <Layout>
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Bitácora de Personal
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Consulta las marcaciones diarias y el estado de las jornadas del
            personal.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Actualizar
        </button>
      </div>

      {/* Filtros operativos */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Fecha de consulta
            </label>

            <input
              type="date"
              value={day}
              onChange={(e) => handleDayChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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

          {(day !== getLocalDateString() || sede) && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Volver a hoy
            </button>
          )}
        </div>
      </div>

      {/* Mensaje */}
      {status && (
        <div className="mb-5 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
          {status}
        </div>
      )}

      {/* Resumen operativo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <SummaryCard
          icon={ClipboardList}
          label="Registros del día"
          value={count}
        />

        <SummaryCard
          icon={LogIn}
          label="Entradas registradas"
          value={entries}
        />

        <SummaryCard
          icon={LogOut}
          label="Salidas registradas"
          value={exits}
        />

        <SummaryCard
          icon={Users}
          label="Dentro según marcaciones"
          value={stillInside}
        />
      </div>

      {/* Tabla de marcaciones */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Marcaciones del personal
          </h3>

          <p className="text-xs text-gray-400 mt-0.5">
            {day ? formatDateOnly(day) : "Selecciona una fecha"}
            {sede
              ? ` · ${sede === "NORTE" ? "Norte" : "Centro"}`
              : " · Todas las sedes"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3 min-w-[220px]">Observación</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Cargando marcaciones...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && logs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No hay marcaciones para la fecha y sede seleccionadas.
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

                      {row.employee_document && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {row.employee_document}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <SedeBadge sede={row.sede} />
                    </td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateOnly(row.date)}
                    </td>

                    <td className="px-4 py-3">
                      {row.entrada_time ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-brand-700 bg-brand-50">
                            {formatTime(row.entrada_time)}
                          </span>

                          {row.entrada_confidence != null && (
                            <span className="ml-2 text-xs text-gray-400">
                              {formatConfidence(row.entrada_confidence)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {row.salida_time ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-amber-700 bg-amber-50">
                            {formatTime(row.salida_time)}
                          </span>

                          {row.salida_confidence != null && (
                            <span className="ml-2 text-xs text-gray-400">
                              {formatConfidence(row.salida_confidence)}
                            </span>
                          )}
                        </div>
                      ) : row.entrada_time && row.status === "PENDIENTE_SALIDA" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-red-700 bg-red-50">
                          Sin marcar salida
                        </span>
                      ) : row.entrada_time ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-gray-500 bg-gray-100">
                          Sigue adentro
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <NotesCell row={row} onSaved={handleSaveNotes} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && count > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>
              {count} registro{count === 1 ? "" : "s"} en total
            </span>

            <span>
              Consulta otro día con el filtro de fecha o revisa el informe
              mensual para períodos completos.
            </span>
          </div>
        )}
      </div>
    </Layout>
  );
}