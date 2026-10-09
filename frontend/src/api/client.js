const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function getTokens() {
  const raw = localStorage.getItem("tokens");
  return raw ? JSON.parse(raw) : null;
}

function setTokens(tokens) {
  localStorage.setItem("tokens", JSON.stringify(tokens));
}

function clearTokens() {
  localStorage.removeItem("tokens");
}

async function refreshAccessToken() {
  const tokens = getTokens();

  if (!tokens?.refresh) {
    throw new Error("No hay refresh token");
  }

  const res = await fetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh: tokens.refresh,
    }),
  });

  if (!res.ok) {
    throw new Error("No se pudo renovar la sesión");
  }

  const data = await res.json();

  setTokens({
    ...tokens,
    access: data.access,
  });

  return data.access;
}

/**
 * Wrapper de fetch que agrega el JWT, reintenta una vez si expiró
 * y lanza un error legible si la respuesta no fue exitosa.
 */
async function apiRequest(
  path,
  { method = "GET", body, isFormData = false, retry = true } = {}
) {
  const tokens = getTokens();
  const headers = {};

  if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  if (res.status === 401 && retry && tokens?.refresh) {
    await refreshAccessToken();

    return apiRequest(path, {
      method,
      body,
      isFormData,
      retry: false,
    });
  }

  if (!res.ok) {
    let detail = "Ocurrió un error al comunicarse con el servidor.";

    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      // Respuesta sin cuerpo JSON.
    }

    throw new Error(detail);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res.blob();
}

export const api = {
  // Autenticación
  login: (username, password) =>
    fetch(`${API_URL}/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error("Usuario o contraseña incorrectos.");
      }

      const data = await res.json();
      setTokens(data);

      return data;
    }),

  logout: () => clearTokens(),

  isAuthenticated: () => Boolean(getTokens()?.access),

  // Empleados
  getEmployees: (search = "") =>
    apiRequest(`/employees/?search=${encodeURIComponent(search)}`),

  createEmployee: (payload) =>
    apiRequest("/employees/", {
      method: "POST",
      body: payload,
    }),

  updateEmployee: (id, payload) =>
    apiRequest(`/employees/${id}/`, {
      method: "PATCH",
      body: payload,
    }),

  deleteEmployee: (id) =>
    apiRequest(`/employees/${id}/`, {
      method: "DELETE",
    }),

  enrollFace: (id, photoFile) => {
    const form = new FormData();
    form.append("photo", photoFile);

    return apiRequest(`/employees/${id}/enroll-face/`, {
      method: "POST",
      body: form,
      isFormData: true,
    });
  },

  // Bitácora mensual agrupada por empleado y día
  getMonthlyLogs: (
    year,
    month,
    {
      employeeId = "",
      day = "",
      sede = "",
      page = 1,
      pageSize = 20,
    } = {}
  ) => {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      page: String(page),
      page_size: String(pageSize),
    });

    if (employeeId) {
      params.append("employee", employeeId);
    }

    if (day) {
      params.append("day", day);
    }

    if (sede) {
      params.append("sede", sede);
    }

    return apiRequest(`/attendance/monthly/?${params.toString()}`);
  },

  // Resumen estadístico de asistencia
  getAttendanceSummary: ({
    startDate = "",
    endDate = "",
    sede = "",
  } = {}) => {
    const params = new URLSearchParams();

    if (startDate) {
      params.append("start_date", startDate);
    }

    if (endDate) {
      params.append("end_date", endDate);
    }

    if (sede) {
      params.append("sede", sede);
    }

    return apiRequest(`/attendance/summary/?${params.toString()}`);
  },

  // Marcaciones individuales.
  // El backend actual solo tiene filtros generales por empleado,
  // tipo y método; no se envían filtros de fecha o sede no configurados.
  getAttendanceReport: ({
    employee = "",
    logType = "",
    method = "",
    ordering = "-timestamp",
  } = {}) => {
    const params = new URLSearchParams();

    if (employee) {
      params.append("employee", employee);
    }

    if (logType) {
      params.append("log_type", logType);
    }

    if (method) {
      params.append("method", method);
    }

    if (ordering) {
      params.append("ordering", ordering);
    }

    return apiRequest(`/attendance/?${params.toString()}`);
  },

  // Actualizar observaciones de una marcación
  updateLogNotes: (logId, notes) =>
    apiRequest(`/attendance/${logId}/notes/`, {
      method: "PATCH",
      body: {
        notes,
      },
    }),

  // Exportar bitácora mensual a Excel o PDF
  exportMonthlyLogs: async (
    year,
    month,
    format,
    {
      employeeId = "",
      day = "",
      sede = "",
    } = {}
  ) => {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      file_format: format,
    });

    if (employeeId) {
      params.append("employee", employeeId);
    }

    if (day) {
      params.append("day", day);
    }

    if (sede) {
      params.append("sede", sede);
    }

    const blob = await apiRequest(
      `/attendance/export-monthly/?${params.toString()}`
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `bitacora_${year}_${String(month).padStart(2, "0")}.${
      format === "pdf" ? "pdf" : "xlsx"
    }`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  },
  async getGeneralAttendanceReport({
  start_date,
  end_date,
  sede,
  employee,
} = {}) {
  const params = new URLSearchParams();

  if (start_date) params.set("start_date", start_date);
  if (end_date) params.set("end_date", end_date);
  if (sede) params.set("sede", sede);
  if (employee) params.set("employee", employee);

  return apiRequest(
    `/attendance/general-report/?${params.toString()}`
  );
},
};