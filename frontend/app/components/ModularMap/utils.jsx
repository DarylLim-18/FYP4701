// Utility helpers used across Modular Map

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/** Normalize common aliases to ISO3 (UI-level normalization) */
export function normalizeISO3(v) {
  if (!v) return "";
  const x = String(v).trim().toUpperCase();
  const map = {
    US: "USA", USA: "USA",
    UK: "GBR", GB: "GBR", GBR: "GBR",
    MY: "MYS", IN: "IND", SG: "SGP",
    AU: "AUS", CA: "CAN",
  };
  return map[x] || x;
}

/** Suggested polygon simplify tolerance per level */
export function defaultSimplifyForLevel(level) {
  if (level === "adm2") return 0.01; 
  if (level === "adm1") return 0.015;
  return 0.08;
}

/** Compact LISA summary from a GeoJSON FeatureCollection */
export function computeLisaStats(geojson) {
  if (!geojson?.features?.length) return null;
  const counts = { HH: 0, LL: 0, HL: 0, LH: 0, ns: 0 };
  for (const f of geojson.features) {
    const c = f?.properties?.cluster_label;
    if (c === "HH") counts.HH++;
    else if (c === "LL") counts.LL++;
    else if (c === "HL") counts.HL++;
    else if (c === "LH") counts.LH++;
    else counts.ns++;
  }
  return { total: geojson.features.length, ...counts };
}
