import React, { useState } from "react";
import { Pencil, Check, X as XIcon } from "lucide-react";

export default function NotesCell({ row, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.notes || "");
  const [saving, setSaving] = useState(false);

  const targetLogId =
    row.notes_log_id || row.entrada_log_id || row.salida_log_id;

  const handleSave = async () => {
    if (!targetLogId || saving) return;

    setSaving(true);

    try {
      await onSaved(targetLogId, value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <span
          className={`text-sm ${row.notes ? "text-gray-600" : "text-gray-300"}`}
        >
          {row.notes || "Sin observación"}
        </span>

        <button
          type="button"
          onClick={() => {
            setValue(row.notes || "");
            setEditing(true);
          }}
          disabled={!targetLogId}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-600 disabled:hidden transition"
          title="Editar observación"
        >
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        type="text"
        value={value}
        maxLength={255}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();

          if (e.key === "Escape") {
            setEditing(false);
            setValue(row.notes || "");
          }
        }}
        className="flex-1 min-w-[160px] px-2 py-1 border border-brand-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        disabled={saving}
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="text-brand-600 hover:text-brand-700 disabled:opacity-40"
        title="Guardar"
      >
        <Check size={15} />
      </button>

      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(row.notes || "");
        }}
        disabled={saving}
        className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
        title="Cancelar"
      >
        <XIcon size={15} />
      </button>
    </div>
  );
}