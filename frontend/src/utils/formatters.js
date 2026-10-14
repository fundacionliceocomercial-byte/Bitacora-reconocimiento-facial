export function formatTime(iso) {
  if (!iso) return null;

  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateOnly(dateStr) {
  if (!dateStr) return "";

  // dateStr llega como "2026-10-01" (solo fecha, sin hora). Si se le
  // pasa ese string directo a `new Date(...)`, JS lo interpreta como
  // medianoche UTC y al mostrarlo en hora local (Colombia, UTC-5)
  // retrocede al día anterior. Construir la fecha desde los
  // componentes evita ese desfase.
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);

  return localDate.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatConfidence(value) {
  return value != null ? `${Math.round(value * 100)}%` : null;
}