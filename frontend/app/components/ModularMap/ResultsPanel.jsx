"use client";

import { FiExternalLink, FiMap } from "react-icons/fi";
import { computeLisaStats } from "./utils";
import LocalGeoJsonMap from "./LocalGeoJsonMap";

export default function ResultsPanel({ geojson, savedUrl, loading, variable, columnName }) {
  // Loading: shimmer only
  if (loading) return <div className="relative h-full rounded-xl shimmer" />;

  // Initial idle: static text + icon (NO shimmer)
  if (!savedUrl) {
    return (
      <div className="relative h-full rounded-xl flex items-center justify-center">
        <div className="text-center space-y-4">
          <FiMap className="w-16 h-16 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold text-gray-300">Ready for Analysis</h3>
            <p className="text-sm text-gray-400">Configure parameters and run to see the map here</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = computeLisaStats(geojson);

  return (
    <div className="h-full rounded-xl border border-white/10 bg-white/5 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Spatial Analysis Results</h3>
          <p className="text-sm text-gray-400">Your Spatial autocorrelation analysis is complete, here is the map with the geoJson data</p>
        </div>
        {savedUrl && (
          <a
            href={savedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-gray-200 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all"
            title="Open/Download GeoJSON"
          >
            <FiExternalLink className="w-4 h-4" />
            Download GeoJSON
          </a>
        )}
      </div>

      {/*This is kinda fire tho, but it's a bit extra so we comment out*/}
      {/* {stats && (
        <div className="grid grid-cols-6 gap-3 mb-6">
          <StatCard label="TOTAL FEATURES" value={stats.total?.toLocaleString()} tone="slate"
            hint="How many areas were analyzed." />
          <StatCard label="HIGH–HIGH" value={stats.HH} tone="red"
            hint="High value with high-value neighbors (hot spot)." />
          <StatCard label="LOW–LOW" value={stats.LL} tone="blue"
            hint="Low value with low-value neighbors (cold spot)." />
          <StatCard label="HIGH–LOW" value={stats.HL} tone="orange"
            hint="High value surrounded by low values (outlier)." />
          <StatCard label="LOW–HIGH" value={stats.LH} tone="purple"
            hint="Low value surrounded by high values (outlier)." />
          <StatCard label="NOT SIGNIFICANT" value={stats.ns} tone="gray"
            hint="No significant local autocorrelation." />
        </div>
      )} */}

      {/* Local file map */}
      <div className="rounded-xl overflow-hidden border border-white/10">
        <LocalGeoJsonMap path={savedUrl} variable={variable} columnName={columnName} />
      </div>
    </div>
  );
}

// function StatCard({ label, value, tone = "slate", hint }) {
//   const tones = {
//     slate: "from-slate-800/50 to-slate-700/30 border-white/10",
//     red: "from-red-500/20 to-red-600/10 border-red-500/20",
//     blue: "from-blue-500/20 to-blue-600/10 border-blue-500/20",
//     orange: "from-orange-500/20 to-orange-600/10 border-orange-500/20",
//     purple: "from-purple-500/20 to-purple-600/10 border-purple-500/20",
//     gray: "from-gray-500/20 to-gray-600/10 border-gray-500/20",
//   };

//   return (
//     <div className={`group relative rounded-xl bg-gradient-to-br ${tones[tone]} p-4`}>
//       <div className={`text-xs ${tone === "gray" ? "text-gray-300" : `text-${tone}-300`} uppercase tracking-wide`}>{label}</div>
//       <div className={`text-2xl font-bold ${tone === "gray" ? "text-gray-100" : `text-${tone}-100`}`}>{value}</div>

//       {/* Lightweight bubble tooltip */}
//       {hint && (
//         <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
//           <div className="px-2 py-1 rounded-md text-[11px] bg-black/80 text-white shadow">
//             {hint}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
