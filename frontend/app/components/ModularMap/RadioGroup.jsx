"use client";

export default function RadioGroup({ label, value, onChange, options }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-300">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "px-3 py-2 rounded-lg border transition-all text-sm",
                active
                  ? "border-indigo-400 bg-indigo-400/10 text-indigo-100 -translate-y-0.5 shadow-lg"
                  : "border-white/10 bg-white/5 text-gray-300 hover:-translate-y-0.5 hover:border-white/20"
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
