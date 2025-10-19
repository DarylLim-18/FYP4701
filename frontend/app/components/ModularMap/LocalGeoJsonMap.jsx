"use client";

import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState, useCallback } from "react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const POSITIVE_COLORS = [
"#f2fdaa",
"#efed8c",
"#eedc6f",
"#efca53",
"#f1b639",
"#f4a11f",
"#f78a00",
"#fb6f00",
"#fd4d00",
"#ff0808ff"
];
const NEGATIVE_COLORS = [
"#1b9ae4",
"#00bddd",
"#41d9c3",
"#9feeac"
];
const DEFAULT_COLOR = "#FFEDA0";
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function colorFromScale(value, start, end, colors) {
  const range = end - start;
  if (!Number.isFinite(range) || range <= 0) {
    return colors[colors.length - 1] ?? DEFAULT_COLOR;
  }

  const ratio = (value - start) / range;
  const clampedRatio = Math.max(0, Math.min(0.999999, ratio));
  const idx = Math.floor(clampedRatio * colors.length);
  return colors[idx] ?? colors[colors.length - 1] ?? DEFAULT_COLOR;
}

function colorFor(value, min, max) {
  if (!Number.isFinite(value)) return DEFAULT_COLOR;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return DEFAULT_COLOR;
  if (min === max) {
    const positiveTerminal = POSITIVE_COLORS[POSITIVE_COLORS.length - 1] ?? DEFAULT_COLOR;
    const negativeTerminal = NEGATIVE_COLORS[0] ?? DEFAULT_COLOR;
    return value >= 0 ? positiveTerminal : negativeTerminal;
  }

  if (value < 0 && min < 0) {
    const negStart = min;
    const negEnd = Math.min(max, 0);
    if (negEnd > negStart) {
      return colorFromScale(value, negStart, negEnd, NEGATIVE_COLORS);
    }
  }

  const posStart = min >= 0 ? min : 0;
  const posEnd = Math.max(max, posStart);
  return colorFromScale(Math.max(value, posStart), posStart, posEnd, POSITIVE_COLORS);
}

function buildLegendSegments(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const positiveTerminal = POSITIVE_COLORS[POSITIVE_COLORS.length - 1] ?? DEFAULT_COLOR;
    const negativeTerminal = NEGATIVE_COLORS[0] ?? DEFAULT_COLOR;
    return [{
      color: min >= 0 ? positiveTerminal : negativeTerminal,
      from: min,
      to: max,
    }];
  }

  const segments = [];

  if (min < 0) {
    const negStart = min;
    const negEnd = Math.min(max, 0);
    if (negEnd > negStart) {
      const negStep = (negEnd - negStart) / NEGATIVE_COLORS.length;
      for (let i = 0; i < NEGATIVE_COLORS.length; i += 1) {
        const from = negStart + i * negStep;
        const to = i === NEGATIVE_COLORS.length - 1 ? negEnd : negStart + (i + 1) * negStep;
        segments.push({ color: NEGATIVE_COLORS[i], from, to });
      }
    }
  }

  if (max > 0) {
    const posStart = min >= 0 ? min : 0;
    const posEnd = Math.max(max, posStart);
    if (posEnd > posStart) {
      const posStep = (posEnd - posStart) / POSITIVE_COLORS.length;
      for (let i = 0; i < POSITIVE_COLORS.length; i += 1) {
        const from = posStart + i * posStep;
        const to = i === POSITIVE_COLORS.length - 1 ? posEnd : posStart + (i + 1) * posStep;
        segments.push({ color: POSITIVE_COLORS[i], from, to });
      }
    }
  }

  return segments;
}

function formatRange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "—";
  return `${numberFormatter.format(from)}–${numberFormatter.format(to)}`;
}

function labelFromProps(props, prefKey) {
  if (!props) return "—";
  const candidates = [
    prefKey, "county", "County", "name", "NAME", "Name", "shapeName", "ShapeName", "shape_name",
    "admin2Name", "admin1Name", "admin0Name", "code", "GEOID", "geoid", "id", "ID"
  ].filter(Boolean);
  for (const k of candidates) {
    if (k in props && props[k] != null && String(props[k]).trim() !== "") return String(props[k]);
  }
  return "—";
}

function GeoJsonLayer({ data, variable, min, max, setHoverProps }) {
  const map = useMap();

  const styleFn = useCallback((feature) => {
    const v = Number(feature?.properties?.[variable]);
    return {
      fillColor: colorFor(v, min, max),
      weight: 1,
      opacity: 1,
      color: "#888",
      dashArray: "2",
      fillOpacity: 0.25
    };
  }, [variable, min, max]);

  const onEach = useCallback((feature, layer) => {
    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({
          weight: 3,
          color: "#222",
          dashArray: "",
          fillOpacity: 0.6
        });
        setHoverProps(feature.properties);
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
      },
      mouseout: (e) => {
        e.target.setStyle(styleFn(feature));
        setHoverProps(null);
      },
      click: (e) => {
        map.fitBounds(e.target.getBounds());
      },
    });
  }, [styleFn, setHoverProps, map]);

  return data ? <GeoJSON data={data} style={styleFn} onEachFeature={onEach} /> : null;
}

function computeMinMax(gj, variable) {

  let maxVal = Number.NEGATIVE_INFINITY;
  let minVal = Number.POSITIVE_INFINITY;
  for (const f of gj?.features ?? []) {
    const v = Number(f?.properties?.[variable]);
    if (Number.isFinite(v)) {
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }
  }
  return {
    min: Number.isFinite(minVal) ? minVal : 0,
    max: Number.isFinite(maxVal) ? maxVal : 0,
  };

}
export default function LocalGeoJsonMap({ data: dataProp, variable, columnName, center = [37.1841, -119.4696], zoom = 6, onLoaded }) {
  const [data, setData] = useState(null);
  const [hoverProps, setHoverProps] = useState(null);
  const [max, setMax] = useState(0);
  const [min, setMin] = useState(0);

  useEffect(() => {
    if(!dataProp)
      return;
    setData(dataProp);
    onLoaded?.(dataProp);
    const {min, max} = computeMinMax(dataProp, variable);
    setMin(min);
    setMax(max);
  }, [dataProp, variable, onLoaded]);

  const label = useMemo(() => labelFromProps(hoverProps, columnName), [hoverProps, columnName]);
  const val = useMemo(() => {
    const v = Number(hoverProps?.[variable]);
    return Number.isFinite(v) ? v.toFixed(2) : "—";
  }, [hoverProps, variable]);

  const legendSegments = useMemo(() => buildLegendSegments(min, max), [min, max]);

  return (
    <div className="relative w-full h-full">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <GeoJsonLayer data={data} variable={variable} min={min} max={max} setHoverProps={setHoverProps} />
      </MapContainer>

      {/* Info box (top-right) */}
      <div className="leaflet-top leaflet-right" style={{ zIndex: 400 }}>
        <div className="m-4 px-3 py-2 rounded bg-white/85 text-black text-xs shadow">
          <div className="font-semibold text-gray-700">{variable}</div>
          {hoverProps ? (
            <div className="whitespace-pre-wrap"><b>{label}</b><br />{val}</div>
          ) : (
            <span>Hover over a region</span>
          )}
        </div>
      </div>

      {/* Legend */}
      {legendSegments.length > 0 && (
        <div className="leaflet-bottom leaflet-right" style={{ zIndex: 400 }}>
          <div
            className="info legend"
            style={{
              background: "rgba(255,255,255,0.85)",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              lineHeight: "18px",
              color: "#333",
              margin: "15px",
              fontSize: "12px",
            }}
          >
            {legendSegments.map(({ color, from, to }, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                <i
                  style={{
                    background: color,
                    width: 18,
                    height: 18,
                    marginRight: 8,
                    opacity: 0.7,
                    display: "inline-block",
                  }}
                />
                {formatRange(from, to)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
