"use client";
import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  Popup,
  GeoJSON,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo, useState, useCallback } from "react";
import { FiPlay, FiBarChart2, FiAlertCircle } from "react-icons/fi";
import { FaStarOfDavid } from "react-icons/fa6";
import { BsStars, BsClockHistory, BsGraphUpArrow } from "react-icons/bs";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
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
  "#ff0808ff",
];
const NEGATIVE_COLORS = ["#1b9ae4", "#00bddd", "#41d9c3", "#9feeac"];
const DEFAULT_COLOR = "#FFEDA0";
const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

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
    const positiveTerminal =
      POSITIVE_COLORS[POSITIVE_COLORS.length - 1] ?? DEFAULT_COLOR;
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
  return colorFromScale(
    Math.max(value, posStart),
    posStart,
    posEnd,
    POSITIVE_COLORS
  );
}

function buildLegendSegments(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];

  if (min === max) {
    const positiveTerminal =
      POSITIVE_COLORS[POSITIVE_COLORS.length - 1] ?? DEFAULT_COLOR;
    const negativeTerminal = NEGATIVE_COLORS[0] ?? DEFAULT_COLOR;
    return [
      {
        color: min >= 0 ? positiveTerminal : negativeTerminal,
        from: min,
        to: max,
      },
    ];
  }

  const segments = [];

  if (min < 0) {
    const negStart = min;
    const negEnd = Math.min(max, 0);
    if (negEnd > negStart) {
      const negStep = (negEnd - negStart) / NEGATIVE_COLORS.length;
      for (let i = 0; i < NEGATIVE_COLORS.length; i += 1) {
        const from = negStart + i * negStep;
        const to =
          i === NEGATIVE_COLORS.length - 1
            ? negEnd
            : negStart + (i + 1) * negStep;
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
        const to =
          i === POSITIVE_COLORS.length - 1
            ? posEnd
            : posStart + (i + 1) * posStep;
        segments.push({ color: POSITIVE_COLORS[i], from, to });
      }
    }
  }

  return segments;
}

function labelFromProps(props, preferredKey) {
  if (!props) return "—";
  const candidates = [
    preferredKey,
    "county",
    "County",
    "state",
    "State",
    "name",
    "NAME",
    "Name",
    "shapeName",
    "ShapeName",
    "shape_name",
    "admin2Name",
    "admin1Name",
    "admin0Name",
    "code",
    "GEOID",
    "geoid",
    "id",
    "ID",
  ].filter(Boolean);

  for (const key of candidates) {
    const value = props[key];
    if (value != null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "—";
}

function validateForecastYear(rawValue) {
  const trimmed = (rawValue ?? "").trim();
  if (trimmed.length === 0) {
    return "Enter a forecast year.";
  }

  const year = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(year)) {
    return "Enter a numeric year (e.g. 2026).";
  }

  if (trimmed.length !== String(year).length) {
    return "Enter a numeric year without extra characters.";
  }

  if (year < 2025) {
    return "Forecasts start at 2025. Choose 2025 or later.";
  }

  return null;
}
// const VARIABLE = "Avg PM2.5"
// const PATH = "geojsons/lisa-1.geojson"
const COLUMN_NAME = "county";

// Extract all types of prevalence (current & lifetime)
const typeOfPrevalence = ["current", "lifetime"];

// Get all prevalence years
const prevalenceYears = [
  "2015-2016",
  "2017-2018",
  "2019-2020",
  "2021-2022",
  "Others (Predictive)",
];

// Get min/max for a selected variable
const getDataExtents = (data, variableName) => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const feature of data?.features ?? []) {
    const raw = feature?.properties?.[variableName];
    const value =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
    if (Number.isFinite(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
  };
};

const defaultCenter = [37.1841, -119.4696];
const defaultZoom = 6;

function ChoroplethLayer({
  data,
  setInfo,
  selectedVariable,
  minValue,
  maxValue,
}) {
  const map = useMap();

  const styleFn = useCallback(
    (feature) => {
      const v = Number(feature?.properties?.[selectedVariable]);
      return {
        fillColor: colorFor(v, minValue, maxValue),
        weight: 1,
        opacity: 1,
        color: "#888",
        dashArray: "2",
        fillOpacity: 0.25,
      };
    },
    [selectedVariable, minValue, maxValue]
  );

  const onEachFeature = useCallback(
    (feature, layer) => {
      layer.on({
        mouseover: (e) => {
          const targetLayer = e.target;
          targetLayer.setStyle({
            weight: 3,
            color: "#222",
            dashArray: "",
            fillOpacity: 0.6,
          });
          setInfo(feature.properties);
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            targetLayer.bringToFront();
          }
        },
        mouseout: (e) => {
          const targetLayer = e.target;
          targetLayer.setStyle(styleFn(feature));
          setInfo(null);
        },
        click: (e) => {
          map.fitBounds(e.target.getBounds());
        },
      });
    },
    [map, setInfo, styleFn]
  );

  return data ? (
    <GeoJSON data={data} style={styleFn} onEachFeature={onEachFeature} />
  ) : null;
}

// Info Control (top right hover box)
const InfoControl = ({ info, selectedVariable, columnPreference }) => {
  const label = useMemo(
    () => labelFromProps(info, columnPreference),
    [info, columnPreference]
  );
  const value = Number(info?.[selectedVariable]);
  const formattedValue = Number.isFinite(value)
    ? `${Math.round(value * 100) / 100}%`
    : "—";

  return (
    <div className="leaflet-top leaflet-right">
      <div
        className="info"
        style={{
          padding: "6px 8px",
          font: "14px/16px Arial, Helvetica, sans-serif",
          background: "rgba(255,255,255,0.8)",
          boxShadow: "0 0 15px rgba(0,0,0,0.2)",
          borderRadius: "5px",
          margin: "15px",
        }}
      >
        <h4 style={{ margin: "0 0 5px", color: "#777" }}>{selectedVariable}</h4>
        {info ? (
          <div style={{ color: "#000000" }}>
            <b>{label}</b>
            <br />
            {formattedValue}
          </div>
        ) : (
          <div style={{ color: "#000000" }}>Hover over a region</div>
        )}
      </div>
    </div>
  );
};

function formatRange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "—";
  return `${numberFormatter.format(from)}–${numberFormatter.format(to)}`;
}

// Legend (bottom-right)
const Legend = ({ minValue, maxValue }) => {
  const segments = useMemo(
    () => buildLegendSegments(minValue, maxValue),
    [minValue, maxValue]
  );

  if (segments.length === 0) return null;

  return (
    <div className="leaflet-bottom leaflet-right">
      <div
        className="info legend"
        style={{
          background: "rgba(255,255,255,0.8)",
          padding: "8px",
          borderRadius: "5px",
          border: "1px solid #ccc",
          lineHeight: "18px",
          color: "#555",
          margin: "15px",
        }}
      >
        {segments.map(({ color, from, to }, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
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
  );
};

// LabelDot component from your friend's code
function LabelDot({ color, text }) {
  const cls =
    {
      "indigo-400": "bg-indigo-400",
      "emerald-400": "bg-emerald-400",
      "blue-400": "bg-blue-400",
      "purple-400": "bg-purple-400",
      "orange-400": "bg-orange-400",
      "rose-400": "bg-rose-400",
    }[color] || "bg-gray-400";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${cls}`} />
      <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">
        {text}
      </label>
    </div>
  );
}

function Warn({ text }) {
  return (
    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-1">
      <p className="text-xs text-amber-300 flex items-center gap-1">
        <FiAlertCircle className="w-3 h-3" />
        {text}
      </p>
    </div>
  );
}

const StyledSelect = ({ label, options, value, onChange, error }) => {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full rounded-lg bg-slate-800/60 border border-white/20 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all appearance-none"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
      {error && <Warn text={error} />}
    </div>
  );
};

export default function Map() {
  const [geoData, setGeoData] = useState(null);
  const [info, setInfo] = useState(null);
  const [maxValue, setMaxValue] = useState(0);
  const [minValue, setMinValue] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [confirmedSelections, setConfirmedSelections] = useState(false);

  const [selectedPrevalence, setSelectedPrevalence] = useState(
    typeOfPrevalence[0]
  );
  const [selectedYear, setSelectedYear] = useState(prevalenceYears[0]);
  const [selectedVariable, setSelectedVariable] = useState(""); // Fixed variable name based on selection
  const [predictiveError, setPredictiveError] = useState(null);
  const [selectedOthers, setSelectedOthers] = useState("");
  const predictiveOption = prevalenceYears[prevalenceYears.length - 1];
  const labelPreference = useMemo(
    () => (selectedYear === predictiveOption ? "state" : COLUMN_NAME),
    [selectedYear, predictiveOption]
  );

  // Construct the file path based on selections
  const getGeoJsonPath = () => {
    return `/geojsons/${selectedPrevalence}-${selectedYear}.geojson`;
  };

  // Handle confirmation
  const handleConfirm = async () => {
    setIsLoading(true);
    setInfo(null);
    setConfirmedSelections(false);

    try {
      if (selectedYear === predictiveOption) {
        const validationMessage = validateForecastYear(selectedOthers);
        if (validationMessage) {
          setPredictiveError(validationMessage);
          setIsLoading(false);
          return;
        }

        const targetYear = Number.parseInt(selectedOthers.trim(), 10);

        setPredictiveError(null);

        const body = new URLSearchParams();
        body.append("start", String(targetYear));
        body.append("end", String(targetYear));
        let geoResponse = null;

        const hasData = await fetch(
          `${API_BASE}/get_forecasted_asthma/${targetYear}`
        );
        if (!hasData.ok) {
          const forecastResponse = await fetch(`${API_BASE}/forecast`, {
            method: "POST",
            body,
          });

          if (!forecastResponse.ok) {
            throw new Error("Unable to generate forecast. Please try again.");
          }

          geoResponse = await fetch(
            `${API_BASE}/get_forecasted_asthma/${targetYear}`
          );
        } else {
          geoResponse = hasData;
        }

        const geoJson = await geoResponse.json();
        const variableName = "Predicted Asthma Prevalence %";
        setSelectedVariable(variableName);
        setGeoData(geoJson);
        const { min, max } = getDataExtents(geoJson, variableName);
        setMinValue(min);
        setMaxValue(max);
      } else {
        setPredictiveError(null);
        const response = await fetch(getGeoJsonPath());

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const variableName =
          selectedPrevalence === "lifetime"
            ? "LIFETIME PREVALENCE"
            : "CURRENT PREVALENCE";

        setSelectedVariable(variableName);
        setGeoData(data);
        const { min, max } = getDataExtents(data, variableName);
        setMinValue(min);
        setMaxValue(max);
      }

      setConfirmedSelections(true);
    } catch (err) {
      console.error("Failed to load GeoJSON:", err);
      if (selectedYear === predictiveOption) {
        setPredictiveError(
          err instanceof Error ? err.message : "Unable to load forecast data."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmWithDelay = async () => {
    setIsLoading(true);

    // Fixed delay of 1.5 seconds
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Call handleConfirm without await since it manages its own loading state
    await handleConfirm();
  };

  const clickRick = (link) => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="h-full overflow-hidden bg-gray-900/60 rounded-2xl shadow-xl text-white">
      <main className="h-full grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
        {/* Controls */}
        <div className="min-h-0 p-6 space-y-6 border border-white/10 rounded-2xl shadow-xl bg-white/5">
          {/* <MapControls /> */}
          {/* Prevalence Type Selection */}
          <div className="space-y-3">
            <LabelDot
              color="indigo-400"
              text={
                <span className="inline-flex items-center whitespace-nowrap">
                  Prevalence Type
                  {/* brings you to youtube upon clicking */}
                  <BsGraphUpArrow
                    onClick={() =>
                      clickRick(
                        "https://youtu.be/dQw4w9WgXcQ?si=n8-YzA4eBiVOZp-n"
                      )
                    }
                    className="ml-1 text-xl text-indigo-300 hover:text-indigo-700 transition-colors duration-300"
                  />
                </span>
              }
            />
            <StyledSelect
              label="Type of Prevalence"
              options={typeOfPrevalence}
              value={selectedPrevalence}
              onChange={(e) => {
                setSelectedPrevalence(e.target.value);
                setInfo(null); // Reset info when changing selection
              }}
            />
          </div>

          {/* Year Selection */}
          <div className="space-y-3">
            <LabelDot
              color="emerald-400"
              text={
                <span className="inline-flex items-center whitespace-nowrap">
                  Year
                  {/* brings you to youtube upon clicking */}
                  <BsClockHistory
                    onClick={() =>
                      clickRick(
                        "https://youtu.be/dQw4w9WgXcQ?si=n8-YzA4eBiVOZp-n"
                      )
                    }
                    className="ml-1 text-xl text-indigo-300 hover:text-indigo-700 transition-colors duration-300"
                  />
                </span>
              }
            />
            <StyledSelect
              label="Year Range"
              options={prevalenceYears}
              value={selectedYear}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedYear(value);
                setInfo(null); // Reset info when changing selection
                if (value !== predictiveOption) {
                  setPredictiveError(null);
                  setSelectedOthers("");
                }
              }}
            />
          </div>

          {/* Show additional options if "Others (Predictive)" is selected */}
          {selectedYear === predictiveOption && (
            <div className="space-y-3">
              <LabelDot
                color="rose-400"
                text={
                  <span className="inline-flex items-center whitespace-nowrap">
                    Other Years
                    {/* brings you to youtube upon clicking */}
                    <BsStars
                      onClick={() =>
                        clickRick(
                          "https://youtu.be/dQw4w9WgXcQ?si=n8-YzA4eBiVOZp-n"
                        )
                      }
                      className="ml-1 text-xl text-indigo-300 hover:text-indigo-700 transition-colors duration-300"
                    />
                  </span>
                }
              />
              {/* Text box to input desired year (e.g. 2026) */}
              <input
                type="text"
                value={selectedOthers}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedOthers(value);
                  const nextError = validateForecastYear(value);
                  setPredictiveError(
                    value.trim().length === 0 ? null : nextError
                  );
                }}
                placeholder="Enter year (e.g. 2026)"
                className="w-full p-2 border border-white/10 rounded-lg bg-transparent focus:outline-none"
              />
              {predictiveError && <Warn text={predictiveError} />}
              {/* <StyledSelect
                    label="Select Other Years"
                    options={["2023-2024", "2025-2026", "2027-2028", "2029-2030"]}
                    value={selectedOthers}
                    onChange={(e) => {
                      setSelectedOthers(e.target.value);
                      setInfo(null); // Reset info when changing selection
                    }}
                  /> */}
            </div>
          )}

          {/* Confirm Button */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={handleConfirmWithDelay}
              disabled={isLoading}
              className={[
                "w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-sm font-semibold transition-all duration-300 relative overflow-hidden group",
                isLoading
                  ? "bg-slate-700/50 text-slate-400 cursor-not-allowed border border-slate-600/50"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5",
              ].join(" ")}
            >
              <div className="relative z-10 flex items-center gap-3">
                <FiPlay
                  className={`w-5 h-5 transition-transform ${
                    isLoading ? "animate-pulse" : "group-hover:scale-110"
                  }`}
                />
                <span className="font-medium">
                  {isLoading ? "Loading Map..." : "Confirm Selection"}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Map panel */}
        <section className="lg:col-span-3 min-h-0 bg-white/5 border border-white/10 rounded-2xl shadow-xl overflow-hidden relative">
          {!confirmedSelections ? (
            <div className="h-96 flex items-center justify-center bg-slate-800/50 rounded-xl border border-white/10">
              <div className="text-center text-gray-400">
                <FiBarChart2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>
                  Select parameters and click "Confirm Selection" to load the
                  map
                </p>
              </div>
            </div>
          ) : (
            // Your map component here
            <MapContainer
              key={`${selectedPrevalence}-${selectedYear}-${
                selectedYear === predictiveOption ? selectedOthers : ""
              }`}
              center={defaultCenter}
              zoom={defaultZoom}
              scrollWheelZoom
              style={{ height: "500px", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <ChoroplethLayer
                data={geoData}
                setInfo={setInfo}
                selectedVariable={selectedVariable}
                minValue={minValue}
                maxValue={maxValue}
              />
              <InfoControl
                info={info}
                selectedVariable={selectedVariable}
                columnPreference={labelPreference}
              />
              <Legend minValue={minValue} maxValue={maxValue} />
              <Marker position={[37.1841, -119.4696]}>
                <Popup>California</Popup>
              </Marker>
              {/* <LoadingSpinner  /> */}
            </MapContainer>
          )}
        </section>
      </main>
    </div>
  );
}
