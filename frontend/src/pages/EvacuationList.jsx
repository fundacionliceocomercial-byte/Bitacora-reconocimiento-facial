import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client.js";
import {
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Users,
  Phone,
  Droplet,
} from "lucide-react";

function SedeBadge({ sede }) {
  const isNorte = sede === "NORTE";
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isNorte ? "text-blue-700 bg-blue-50" : "text-green-700 bg-green-50"
      }`}
    >
      {isNorte ? "Norte" : "Centro"}
    </span>
  );
}

export default function EvacuationList() {
  const [sede, setSede] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadList = async () => {
    setLoading(true);
    setStatus("");
    try {
      const data = await api.getEmployeesInside(sede);
      setEmployees(data.results || []);
      setLastUpdated(new Date());
    } catch (err) {
      setStatus(err.message || "No fue posible cargar la lista.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const handleExport = async (format) => {
    setStatus(`Generando ${format.toUpperCase()}...`);
    try {
      await api.exportEmployeesInside(format, sede);
      setStatus("");
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle size={18} />
            <span>Reportes / Lista de evacuación</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-gray-800">
            Personal actualmente dentro de la sede
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Úsalo para llamado a lista en caso de emergencia o desastre natural.
            Se calcula según la última marcación de cada empleado.
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

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-col sm:flex-row sm:items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Sede
          </label>
          <select
            value={sede}
            onChange={(e) => setSede(e.target.value)}
            className="w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todas las sedes</option>
            <option value="CENTRO">Centro</option>
            <option value="NORTE">Norte</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadList}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualizar ahora
        </button>

        {lastUpdated && !loading && (
          <span className="text-xs text-gray-400">
            Actualizado a las {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {status && (
        <div className="mb-5 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
          {status}
        </div>
      )}

      <div className="bg-white border-2 border-red-100 rounded-xl p-5 mb-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
          <Users size={24} />
        </div>
        <div>
          <p className="text-xs text-gray-500">Total de personas dentro {sede ? `(sede ${sede === "NORTE" ? "Norte" : "Centro"})` : "(todas las sedes)"}</p>
          <p className="text-3xl font-bold text-gray-900">{loading ? "—" : employees.length}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Cargo / Área</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3">RH</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Contacto de emergencia</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              )}
              {!loading && employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No hay nadie registrado como "adentro" en este momento.
                  </td>
                </tr>
              )}
              {!loading && employees.map((emp) => (
                <tr key={emp.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-700">{emp.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.document_id}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {emp.position || "-"}
                    {emp.department && <span className="text-gray-400"> · {emp.department}</span>}
                  </td>
                  <td className="px-4 py-3"><SedeBadge sede={emp.sede} /></td>
                  <td className="px-4 py-3">
                    {emp.blood_type ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                        <Droplet size={11} />
                        {emp.blood_type}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} className="text-gray-400" />
                        {emp.phone}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.emergency_contact_phone ? (
                      <div>
                        <div>{emp.emergency_contact_phone}</div>
                        {emp.emergency_contact_relationship && (
                          <div className="text-xs text-gray-400">{emp.emergency_contact_relationship}</div>
                        )}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}