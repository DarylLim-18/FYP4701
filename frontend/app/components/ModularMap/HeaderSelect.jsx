"use client";

export default function HeaderSelect({
  label,
  headers,
  value,
  onChange,
  placeholder = "Choose a column…",
  allowNone = false,
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg bg-slate-800/60 border border-white/20 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30 transition-all"
      >
        {allowNone
          ? <option value="">None</option>
          : <option value="" disabled>{placeholder}</option>}
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}
