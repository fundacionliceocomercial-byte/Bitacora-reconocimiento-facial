import React, { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import { api } from "../api/client";

import {
  Plus,
  X,
  Search,
  Pencil,
  Camera,
  RefreshCw,
  Trash2,
  UserPlus,
  Save,
  User,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const emptyForm = {
  document_id: "",
  first_name: "",
  last_name: "",
  email: "",
  position: "",
  department: "",
  sede: "CENTRO",
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [enrollingId, setEnrollingId] = useState(null);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal de eliminación
  const [deleteEmployee, setDeleteEmployee] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // =========================================================
  // CARGAR EMPLEADOS
  // =========================================================

  const loadEmployees = async (query = "") => {
    setLoading(true);

    try {
      const data = await api.getEmployees(query);
      setEmployees(data.results || data);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // =========================================================
  // BUSCAR
  // =========================================================

  const handleSearch = (e) => {
    e.preventDefault();
    loadEmployees(search);
  };

  // =========================================================
  // GUARDAR / EDITAR EMPLEADO
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...form,
        email:
          form.email.trim() === ""
            ? null
            : form.email.trim(),
      };

      if (editingEmployee) {
        await api.updateEmployee(
          editingEmployee.id,
          payload
        );

        setStatus(
          "Empleado actualizado correctamente."
        );
      } else {
        await api.createEmployee(payload);

        setStatus(
          "Empleado creado. Ahora registra su rostro."
        );
      }

      setForm(emptyForm);
      setEditingEmployee(null);
      setShowForm(false);

      await loadEmployees(search);
    } catch (err) {
      setStatus(err.message);
    }
  };

  // =========================================================
  // EDITAR
  // =========================================================

  const handleEdit = (employee) => {
    setEditingEmployee(employee);

    setForm({
      document_id: employee.document_id || "",
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      email: employee.email || "",
      position: employee.position || "",
      department: employee.department || "",
      sede: employee.sede || "CENTRO",
    });

    setShowForm(true);
    setStatus("");
  };

  // =========================================================
  // CANCELAR FORMULARIO
  // =========================================================

  const handleCancelForm = () => {
    setForm(emptyForm);
    setEditingEmployee(null);
    setShowForm(false);
    setStatus("");
  };

  // =========================================================
  // ELIMINAR - ABRIR MODAL
  // =========================================================

  const handleDelete = (employee) => {
    setDeleteEmployee(employee);
  };

  // =========================================================
  // CONFIRMAR ELIMINACIÓN
  // =========================================================

  const confirmDelete = async () => {
    if (!deleteEmployee) return;

    setDeleting(true);

    try {
      await api.deleteEmployee(deleteEmployee.id);

      setStatus(
        "Empleado eliminado correctamente."
      );

      setDeleteEmployee(null);

      await loadEmployees(search);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // =========================================================
  // REGISTRAR / ACTUALIZAR ROSTRO
  // =========================================================

  const handleEnroll = async (id, file) => {
    if (!file) return;

    setEnrollingId(id);
    setStatus("Registrando rostro...");

    try {
      await api.enrollFace(id, file);

      setStatus(
        "Rostro registrado correctamente."
      );

      await loadEmployees(search);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setEnrollingId(null);
    }
  };

  // =========================================================
  // ABRIR FORMULARIO NUEVO
  // =========================================================

  const handleNewEmployee = () => {
    if (showForm) {
      handleCancelForm();
      return;
    }

    setForm(emptyForm);
    setEditingEmployee(null);
    setShowForm(true);
    setStatus("");
  };

  return (
    <Layout>
      {/* =====================================================
          ENCABEZADO
      ====================================================== */}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Empleados
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Administra los empleados y sus registros
            faciales.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewEmployee}
          className="
            inline-flex items-center gap-2
            bg-brand-500 hover:bg-brand-600
            text-white text-sm font-medium
            px-4 py-2.5
            rounded-lg
            shadow-sm
            transition-all
            duration-200
            hover:shadow
          "
        >
          {showForm ? (
            <>
              <X size={17} />
              Cancelar
            </>
          ) : (
            <>
              <Plus size={17} />
              Nuevo empleado
            </>
          )}
        </button>
      </div>

      {/* =====================================================
          MENSAJE DE ESTADO
      ====================================================== */}

      {status && (
        <div
          className="
            mb-5
            flex items-center gap-2
            text-sm
            text-brand-700
            bg-brand-50
            border border-brand-100
            rounded-lg
            px-4 py-3
          "
        >
          <CheckCircle
            size={17}
            className="flex-shrink-0"
          />

          <span>{status}</span>
        </div>
      )}

      {/* =====================================================
          FORMULARIO
      ====================================================== */}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="
            bg-white
            border border-gray-200
            rounded-xl
            p-5
            mb-6
            shadow-sm
          "
        >
          {/* Encabezado formulario */}

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="
                  w-10 h-10
                  flex items-center justify-center
                  rounded-lg
                  bg-brand-50
                  text-brand-600
                "
              >
                {editingEmployee ? (
                  <Pencil size={19} />
                ) : (
                  <UserPlus size={19} />
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingEmployee
                    ? "Editar empleado"
                    : "Nuevo empleado"}
                </h3>

                <p className="text-xs text-gray-500 mt-0.5">
                  {editingEmployee
                    ? "Actualiza la información del empleado."
                    : "Ingresa los datos del nuevo empleado."}
                </p>
              </div>
            </div>

            {editingEmployee && (
              <span
                className="
                  text-xs
                  text-gray-500
                  bg-gray-50
                  border border-gray-200
                  px-3 py-1.5
                  rounded-lg
                "
              >
                ID: {editingEmployee.id}
              </span>
            )}
          </div>

          {/* Campos */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ["document_id", "Documento"],
              ["first_name", "Nombres"],
              ["last_name", "Apellidos"],
              ["email", "Correo (opcional)"],
              ["position", "Cargo"],
              ["department", "Área"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  {label}
                </label>

                <input
                  type={
                    key === "email"
                      ? "email"
                      : "text"
                  }
                  className="
                    w-full
                    px-3 py-2.5
                    border border-gray-300
                    rounded-lg
                    text-sm
                    text-gray-700
                    bg-white
                    focus:outline-none
                    focus:ring-2
                    focus:ring-brand-500
                    focus:border-brand-500
                    transition
                  "
                  value={form[key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]: e.target.value,
                    })
                  }
                  required={[
                    "document_id",
                    "first_name",
                    "last_name",
                  ].includes(key)}
                />
              </div>
            ))}

            {/* Sede */}

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Sede
              </label>

              <select
                className="
                  w-full
                  px-3 py-2.5
                  border border-gray-300
                  rounded-lg
                  text-sm
                  text-gray-700
                  bg-white
                  focus:outline-none
                  focus:ring-2
                  focus:ring-brand-500
                  focus:border-brand-500
                "
                value={form.sede}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sede: e.target.value,
                  })
                }
                required
              >
                <option value="CENTRO">
                  Centro
                </option>

                <option value="NORTE">
                  Norte
                </option>
              </select>
            </div>
          </div>

          {/* Botones */}

          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
            <button
              type="submit"
              className="
                inline-flex items-center gap-2
                bg-brand-500
                hover:bg-brand-600
                text-white
                text-sm font-medium
                px-4 py-2.5
                rounded-lg
                transition
              "
            >
              <Save size={16} />

              {editingEmployee
                ? "Guardar cambios"
                : "Guardar empleado"}
            </button>

            <button
              type="button"
              onClick={handleCancelForm}
              className="
                inline-flex items-center gap-2
                px-4 py-2.5
                border border-gray-300
                rounded-lg
                text-sm
                text-gray-600
                hover:bg-gray-50
                transition
              "
            >
              <X size={16} />
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* =====================================================
          BUSCADOR
      ====================================================== */}

      <form
        onSubmit={handleSearch}
        className="mb-5 flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            size={18}
            className="
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-gray-400
            "
          />

          <input
            className="
              w-full
              pl-10 pr-3 py-2.5
              border border-gray-300
              rounded-lg
              text-sm
              focus:outline-none
              focus:ring-2
              focus:ring-brand-500
              focus:border-brand-500
              transition
            "
            placeholder="Buscar por nombre, documento o área..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        <button
          type="submit"
          className="
            inline-flex items-center gap-2
            px-4 py-2.5
            border border-gray-300
            rounded-lg
            text-sm font-medium
            text-gray-600
            bg-white
            hover:bg-gray-50
            transition
          "
        >
          <Search size={16} />
          Buscar
        </button>
      </form>

      {/* =====================================================
          TABLA
      ====================================================== */}

      <div
        className="
          bg-white
          border border-gray-200
          rounded-xl
          overflow-hidden
          shadow-sm
        "
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead
              className="
                bg-gray-50
                text-gray-500
                text-left
                border-b border-gray-200
              "
            >
              <tr>
                <th className="px-4 py-3 font-medium">
                  Nombre
                </th>

                <th className="px-4 py-3 font-medium">
                  Documento
                </th>

                <th className="px-4 py-3 font-medium">
                  Área
                </th>

                <th className="px-4 py-3 font-medium">
                  Sede
                </th>

                <th className="px-4 py-3 font-medium">
                  Estado
                </th>

                <th className="px-4 py-3 font-medium">
                  Rostro
                </th>

                <th className="px-4 py-3 font-medium text-right">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Cargando */}

              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="
                      px-4 py-10
                      text-center
                      text-gray-400
                    "
                  >
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw
                        size={22}
                        className="animate-spin"
                      />

                      <span>
                        Cargando empleados...
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Sin empleados */}

              {!loading &&
                employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="
                        px-4 py-10
                        text-center
                        text-gray-400
                      "
                    >
                      <div className="flex flex-col items-center gap-2">
                        <User
                          size={28}
                          className="text-gray-300"
                        />

                        <span>
                          No hay empleados registrados.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

              {/* Empleados */}

              {!loading &&
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="
                      border-t border-gray-100
                      hover:bg-gray-50
                      transition-colors
                    "
                  >
                    {/* Nombre */}

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="
                            w-9 h-9
                            rounded-full
                            bg-brand-50
                            text-brand-600
                            flex items-center justify-center
                            flex-shrink-0
                          "
                        >
                          <User size={17} />
                        </div>

                        <div>
                          <div className="font-medium text-gray-700">
                            {emp.full_name}
                          </div>

                          {emp.position && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {emp.position}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Documento */}

                    <td className="px-4 py-3 text-gray-500">
                      {emp.document_id}
                    </td>

                    {/* Área */}

                    <td className="px-4 py-3 text-gray-500">
                      {emp.department || "-"}
                    </td>

                    {/* Sede */}

                    <td className="px-4 py-3">
                      {emp.sede === "NORTE" ? (
                        <span
                          className="
                            inline-flex items-center
                            text-blue-700
                            text-xs font-medium
                            bg-blue-50
                            border border-blue-100
                            px-2.5 py-1
                            rounded-full
                          "
                        >
                          Norte
                        </span>
                      ) : (
                        <span
                          className="
                            inline-flex items-center
                            text-gray-600
                            text-xs font-medium
                            bg-green-50
                            border border-gray-200
                            px-2.5 py-1
                            rounded-full
                          "
                        >
                          Centro
                        </span>
                      )}
                    </td>

                    {/* Estado */}

                    <td className="px-4 py-3">
                      {emp.current_status ===
                      "ADENTRO" ? (
                        <span
                          className="
                            inline-flex items-center gap-1.5
                            text-brand-700
                            text-xs font-medium
                            bg-brand-50
                            border border-brand-100
                            px-2.5 py-1
                            rounded-full
                          "
                        >
                          <span
                            className="
                              w-1.5 h-1.5
                              rounded-full
                              bg-brand-500
                            "
                          />

                          Adentro
                        </span>
                      ) : (
                        <span
                          className="
                            inline-flex items-center gap-1.5
                            text-gray-500
                            text-xs font-medium
                            bg-gray-100
                            border border-gray-200
                            px-2.5 py-1
                            rounded-full
                          "
                        >
                          <span
                            className="
                              w-1.5 h-1.5
                              rounded-full
                              bg-gray-400
                            "
                          />

                          Afuera
                        </span>
                      )}
                    </td>

                    {/* Rostro */}

                    <td className="px-4 py-3">
                      {emp.has_face_registered ? (
                        <span
                          className="
                            inline-flex items-center gap-1.5
                            text-brand-600
                            text-xs font-medium
                            bg-brand-50
                            border border-brand-100
                            px-2.5 py-1
                            rounded-full
                          "
                        >
                          <CheckCircle size={13} />

                          Registrado
                        </span>
                      ) : (
                        <span
                          className="
                            inline-flex items-center gap-1.5
                            text-amber-700
                            text-xs font-medium
                            bg-amber-50
                            border border-amber-100
                            px-2.5 py-1
                            rounded-full
                          "
                        >
                          <AlertCircle size={13} />

                          Pendiente
                        </span>
                      )}
                    </td>

                    {/* =================================================
                        ACCIONES
                    ================================================== */}

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">

                        {/* EDITAR */}

                        <button
                          type="button"
                          onClick={() =>
                            handleEdit(emp)
                          }
                          title="Editar empleado"
                          aria-label="Editar empleado"
                          className="
                            w-9 h-9
                            flex items-center justify-center
                            rounded-lg
                            text-blue-600
                            bg-blue-50
                            border border-blue-100
                            hover:bg-blue-100
                            hover:text-blue-700
                            transition-all
                            duration-200
                          "
                        >
                          <Pencil size={16} />
                        </button>

                        {/* REGISTRAR / ACTUALIZAR ROSTRO */}

                        <label
                          title={
                            enrollingId === emp.id
                              ? "Procesando..."
                              : emp.has_face_registered
                              ? "Actualizar rostro"
                              : "Registrar rostro"
                          }
                          aria-label={
                            emp.has_face_registered
                              ? "Actualizar rostro"
                              : "Registrar rostro"
                          }
                          className={`
                            w-9 h-9
                            flex items-center justify-center
                            rounded-lg
                            text-brand-600
                            bg-brand-50
                            border border-brand-100
                            hover:bg-brand-100
                            hover:text-brand-700
                            transition-all
                            duration-200
                            cursor-pointer
                            ${
                              enrollingId === emp.id
                                ? "opacity-50 pointer-events-none"
                                : ""
                            }
                          `}
                        >
                          {enrollingId === emp.id ? (
                            <RefreshCw
                              size={16}
                              className="animate-spin"
                            />
                          ) : emp.has_face_registered ? (
                            <RefreshCw size={16} />
                          ) : (
                            <Camera size={16} />
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={
                              enrollingId === emp.id
                            }
                            onChange={(e) => {
                              handleEnroll(
                                emp.id,
                                e.target.files[0]
                              );

                              // Permite volver a seleccionar
                              // el mismo archivo
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {/* ELIMINAR */}

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(emp)
                          }
                          title="Eliminar empleado"
                          aria-label="Eliminar empleado"
                          className="
                            w-9 h-9
                            flex items-center justify-center
                            rounded-lg
                            text-red-600
                            bg-red-50
                            border border-red-100
                            hover:bg-red-100
                            hover:text-red-700
                            transition-all
                            duration-200
                          "
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
      ========================================================== */}

      {deleteEmployee && (
        <div
          className="
            fixed inset-0
            z-50
            flex items-center justify-center
            bg-black/40
            px-4
          "
          onClick={() => {
            if (!deleting) {
              setDeleteEmployee(null);
            }
          }}
        >
          <div
            className="
              w-full max-w-md
              bg-white
              rounded-2xl
              shadow-xl
              p-6
            "
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            {/* Icono */}

            <div className="flex justify-center mb-4">
              <div
                className="
                  w-12 h-12
                  rounded-full
                  bg-red-50
                  text-red-600
                  flex items-center justify-center
                "
              >
                <Trash2 size={22} />
              </div>
            </div>

            {/* Título */}

            <h3 className="text-lg font-semibold text-gray-800 text-center">
              ¿Eliminar empleado?
            </h3>

            {/* Información */}

            <p className="text-sm text-gray-500 text-center mt-2">
              Estás a punto de eliminar a:
            </p>

            <div
              className="
                mt-3
                bg-gray-50
                border border-gray-200
                rounded-lg
                px-4 py-3
                text-center
              "
            >
              <p className="font-medium text-gray-700">
                {deleteEmployee.full_name}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Documento:{" "}
                {deleteEmployee.document_id}
              </p>
            </div>

            <p className="text-xs text-gray-400 text-center mt-3">
              Esta acción no se puede deshacer.
            </p>

            {/* Botones */}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setDeleteEmployee(null)
                }
                className="
                  flex-1
                  px-4 py-2.5
                  border border-gray-300
                  rounded-lg
                  text-sm font-medium
                  text-gray-600
                  hover:bg-gray-50
                  transition
                  disabled:opacity-50
                "
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="
                  flex-1
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  px-4 py-2.5
                  bg-red-600
                  hover:bg-red-700
                  rounded-lg
                  text-sm font-medium
                  text-white
                  transition
                  disabled:opacity-50
                "
              >
                {deleting ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />

                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />

                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}