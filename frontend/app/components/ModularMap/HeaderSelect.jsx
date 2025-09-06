"use client";

export default function HeaderSelect({
    label,
    headers,
    value,
    onChange,
    placeholder = "Choose a column…",
}) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">{label}</label>
            <select
                value={value ?? ""}
                onChange={(e) => onChange?.(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
                <option value="" disabled>{placeholder}</option>
                {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                ))}
            </select>
        </div>
    );
}
