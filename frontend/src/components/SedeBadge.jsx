import React from "react";

export default function SedeBadge({ sede }) {
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