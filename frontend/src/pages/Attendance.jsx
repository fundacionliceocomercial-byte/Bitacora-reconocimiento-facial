import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client";

const now = new Date();

export default function Attendance() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getMonthlyLogs(year, month);
      setLogs(data.results || []);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

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

      <div className="flex gap-3 mb-4">
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
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Fecha y hora</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Confianza</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin registros este mes.</td></tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-700">{log.employee_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      log.log_type === "ENTRADA" ? "text-brand-700 bg-brand-50" : "text-amber-700 bg-amber-50"
                    }`}
                  >
                    {log.log_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(log.timestamp).toLocaleString("es-CO")}</td>
                <td className="px-4 py-3 text-gray-500">{log.method}</td>
                <td className="px-4 py-3 text-gray-500">
                  {log.match_confidence != null ? `${Math.round(log.match_confidence * 100)}%` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
