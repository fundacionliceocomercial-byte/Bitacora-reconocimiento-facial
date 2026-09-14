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
  if (!tokens?.refresh) throw new Error("No hay refresh token");

  const res = await fetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh }),
  });
  if (!res.ok) throw new Error("No se pudo renovar la sesión");

  const data = await res.json();
  setTokens({ ...tokens, access: data.access });
  return data.access;
}

/**
 * Wrapper de fetch que agrega el JWT, reintenta una vez si expiró,
 * y lanza un error legible si la respuesta no fue exitosa.
 */
async function apiRequest(path, { method = "GET", body, isFormData = false, retry = true } = {}) {
  const tokens = getTokens();
  const headers = {};
  if (tokens?.access) headers["Authorization"] = `Bearer ${tokens.access}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401 && retry && tokens?.refresh) {
    await refreshAccessToken();
    return apiRequest(path, { method, body, isFormData, retry: false });
  }

  if (!res.ok) {
    let detail = "Ocurrió un error al comunicarse con el servidor.";
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(detail);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.blob();
}

export const api = {
  login: (username, password) =>
    fetch(`${API_URL}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Usuario o contraseña incorrectos.");
      const data = await res.json();
      setTokens(data);
      return data;
    }),

  logout: () => clearTokens(),
  isAuthenticated: () => Boolean(getTokens()?.access),

  // Empleados
  getEmployees: (search = "") => apiRequest(`/employees/?search=${encodeURIComponent(search)}`),
  createEmployee: (payload) => apiRequest("/employees/", { method: "POST", body: payload }),
  updateEmployee: (id, payload) => apiRequest(`/employees/${id}/`, { method: "PATCH", body: payload }),
  deleteEmployee: (id) => apiRequest(`/employees/${id}/`, { method: "DELETE" }),
  enrollFace: (id, photoFile) => {
    const form = new FormData();
    form.append("photo", photoFile);
    return apiRequest(`/employees/${id}/enroll-face/`, { method: "POST", body: form, isFormData: true });
  },

  // Bitácora
  getMonthlyLogs: (year, month, employeeId = "") =>
    apiRequest(`/attendance/monthly/?year=${year}&month=${month}${employeeId ? `&employee=${employeeId}` : ""}`),

  exportMonthlyLogs: async (year, month, format, employeeId = "") => {
    const blob = await apiRequest(
      `/attendance/export-monthly/?year=${year}&month=${month}&format=${format}${employeeId ? `&employee=${employeeId}` : ""}`
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bitacora_${year}_${String(month).padStart(2, "0")}.${format === "pdf" ? "pdf" : "xlsx"}`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
