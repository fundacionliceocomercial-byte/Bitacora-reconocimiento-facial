import React from "react";

export default function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
          <Icon size={19} />
        </div>

        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-semibold text-gray-800 mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}