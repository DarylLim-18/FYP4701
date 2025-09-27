"use client";

import dynamic from "next/dynamic";
import { FiMap, FiExternalLink } from "react-icons/fi";
import { computeLisaStats } from "./utils";

const LocalGeoJsonMap = dynamic(() => import("./LocalGeoJsonMap"), { ssr: false });

export default function ResultsPanel({ geojson, savedUrl, loading, variable, columnName }) {
  if (loading) {
    return <div className="relative h-full rounded-xl shimmer" />;
  }

  if (!savedUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <FiMap className="w-14 h-14 text-gray-400 mx-auto" />
          <div className="text-sm text-gray-400">Run analysis to render the map</div>
        </div>
      </div>
    );
  }

  const stats = geojson ? computeLisaStats(geojson) : null;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-300 border-b border-white/10 shrink-0">
        <h3 className="text-lg font-semibold">Spatial Analysis Results</h3>
        <a href={savedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-gray-200 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all">
          Open GeoJSON <FiExternalLink />
        </a>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <LocalGeoJsonMap path={savedUrl} variable={variable} columnName={columnName} />
      </div>
    </div>
  );
}
