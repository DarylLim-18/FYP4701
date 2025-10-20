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
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { FiPlay, FiBarChart2, FiAlertCircle } from "react-icons/fi";
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

const FORECAST_YEAR_MIN = 2025;

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

function normalizeFeatureCollection(input) {
  if (!input) return null;

  if (Array.isArray(input)) {
    const collections = input
      .map((entry) => normalizeFeatureCollection(entry))
      .filter(
        (collection) =>
          collection &&
          typeof collection === "object" &&
          Array.isArray(collection.features)
      );

    if (collections.length === 0) {
      return null;
    }

    if (collections.length === 1) {
      return collections[0];
    }

    const [first] = collections;
    const mergedFeatures = collections.reduce(
      (acc, collection) => {
        if (Array.isArray(collection.features)) {
          acc.push(...collection.features);
        }
        return acc;
      },
      []
    );
    return {
      ...first,
      features: mergedFeatures,
    };
  }

  if (
    typeof input === "object" &&
    input !== null &&
    input.type === "FeatureCollection"
  ) {
    return {
      ...input,
      features: Array.isArray(input.features) ? input.features : [],
    };
  }

  return null;
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

  if (year < FORECAST_YEAR_MIN) {
    return `Forecasts start at ${FORECAST_YEAR_MIN}. Choose ${FORECAST_YEAR_MIN} or later.`;
  }

  return null;
}
// const VARIABLE = "Avg PM2.5"
// const PATH = "geojsons/lisa-1.geojson"
const COLUMN_NAME = "county";

const ASTHMA_DATASET_LABEL = "Asthma Prevalence";
const ASTHMA_PROPERTY_CANDIDATES = [
  "Predicted Asthma Prevalence %",
  "Asthma Prevalence%",
  "Asthma Prevalence %",
  "Asthma Prevalence (%)",
  "CURRENT PREVALENCE",
  "Current Prevalence",
  "LIFETIME PREVALENCE",
  "Lifetime Prevalence",
];

const PREDICTIVE_OPTION_LABEL = "Others (Predictive)";

function coerceToNumber(input) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : NaN;
  }

  if (typeof input === "string") {
    const sanitized = input.replace(/[^0-9.+\-eE]/g, "");
    if (sanitized.length === 0) {
      return NaN;
    }
    const parsed = Number.parseFloat(sanitized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  if (Array.isArray(input)) {
    for (const candidate of input) {
      const coerced = coerceToNumber(candidate);
      if (Number.isFinite(coerced)) {
        return coerced;
      }
    }
    return NaN;
  }

  if (input && typeof input === "object") {
    const candidate =
      "value" in input
        ? input.value
        : "Value" in input
        ? input.Value
        : null;
    return candidate != null ? coerceToNumber(candidate) : NaN;
  }

  return NaN;
}

// Get min/max for a selected variable
const getDataExtents = (data, variableName) => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const feature of data?.features ?? []) {
    const raw = feature?.properties?.[variableName];
    const value = coerceToNumber(raw);
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

function resolveVariableName(featureCollection, datasetSelection) {
  const features = featureCollection?.features ?? [];
  const propertiesFor = (candidate) =>
    candidate &&
    features.some((feature) =>
      Object.prototype.hasOwnProperty.call(
        feature?.properties ?? {},
        candidate
      )
    );

  if (
    datasetSelection != null &&
    datasetSelection !== ASTHMA_DATASET_LABEL
  ) {
    const trimmed =
      typeof datasetSelection === "string"
        ? datasetSelection.trim()
        : String(datasetSelection);

    if (trimmed && propertiesFor(trimmed)) {
      return trimmed;
    }

    return trimmed || ASTHMA_PROPERTY_CANDIDATES[0];
  }

  for (const candidate of ASTHMA_PROPERTY_CANDIDATES) {
    if (propertiesFor(candidate)) {
      return candidate;
    }
  }

  return ASTHMA_PROPERTY_CANDIDATES[0];
}

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
      const v = coerceToNumber(feature?.properties?.[selectedVariable]);
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
  const value = coerceToNumber(info?.[selectedVariable]);
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

const StyledSelect = ({
  label,
  options,
  value,
  onChange,
  error,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-300">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={[
            "w-full rounded-lg px-3 py-2.5 text-sm transition-all appearance-none",
            disabled
              ? "bg-slate-800/40 border border-white/10 text-slate-500 cursor-not-allowed"
              : "bg-slate-800/60 border border-white/20 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30",
          ].join(" ")}
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

  const [isLoading, setIsLoading] = useState(false);
  const [confirmedSelections, setConfirmedSelections] = useState(false);

  const [datasetOptions, setDatasetOptions] = useState([
    ASTHMA_DATASET_LABEL,
  ]);
  const [selectedPrevalence, setSelectedPrevalence] = useState(
    ASTHMA_DATASET_LABEL
  );
  const [prevalenceYearOptions, setPrevalenceYearOptions] = useState([]);
  const yearOptions = useMemo(
    () => [...prevalenceYearOptions, PREDICTIVE_OPTION_LABEL],
    [prevalenceYearOptions]
  );
  const [selectedYear, setSelectedYear] = useState("");
  const manualYearSelectionRef = useRef(false);
  const [selectedVariable, setSelectedVariable] = useState(""); // Fixed variable name based on selection
  const [predictiveError, setPredictiveError] = useState(null);
  const [selectedOthers, setSelectedOthers] = useState("");
  const predictiveOption = PREDICTIVE_OPTION_LABEL;
  const isPredictiveSelection = selectedYear === predictiveOption;
  const labelPreference = useMemo(
    () => (selectedYear === predictiveOption ? "state" : COLUMN_NAME),
    [selectedYear, predictiveOption]
  );
  const { min: minValue, max: maxValue } = useMemo(() => {
    if (!geoData || !selectedVariable) {
      return { min: 0, max: 0 };
    }
    return getDataExtents(geoData, selectedVariable);
  }, [geoData, selectedVariable]);

  useEffect(() => {
    let cancelled = false;

    const loadYears = async () => {
      try {
        const [asthmaResponse, gasResponse] = await Promise.all([
          fetch(`${API_BASE}/list_asthma_dashboard`),
          fetch(`${API_BASE}/list_gas_dashboard`),
        ]);

        if (!asthmaResponse.ok) {
          throw new Error(
            `Failed to load asthma dashboard metadata: ${asthmaResponse.status}`
          );
        }

        if (!gasResponse.ok) {
          throw new Error(
            `Failed to load gas dashboard metadata: ${gasResponse.status}`
          );
        }

        const [asthmaPayload, gasPayload] = await Promise.all([
          asthmaResponse.json(),
          gasResponse.json(),
        ]);

        if (cancelled) return;

        const parseYear = (candidate) => {
          if (candidate == null) return null;

          if (typeof candidate === "number") {
            const truncated = Math.trunc(candidate);
            return Number.isFinite(truncated) ? truncated : null;
          }

          if (typeof candidate !== "string") {
            const serialized = String(candidate);
            if (serialized === "[object Object]") return null;
            candidate = serialized;
          }

          const trimmed = candidate.trim();
          if (trimmed.length === 0) return null;

          const regexMatch = trimmed.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
          if (regexMatch) {
            const parsed = Number.parseInt(regexMatch[0], 10);
            return Number.isFinite(parsed) ? parsed : null;
          }

          const parsed = Number.parseInt(trimmed, 10);
          return Number.isFinite(parsed) ? parsed : null;
        };

        const collectYear = (entry) => {
          if (entry == null) return null;

          const candidates = [
            entry?.Year,
            entry?.year,
            entry?.asthmageo_year,
            entry?.asthmageoYear,
            entry?.gasgeo_year,
            entry?.gasgeoYear,
            entry?.id,
            entry?.asthmageo_id,
            entry?.asthmageoId,
            entry?.gasgeo_id,
            entry?.gasgeoId,
            entry?.name,
            entry?.["Geodata Name"],
            entry?.["Var"],
            entry,
          ];

          for (const candidate of candidates) {
            const parsed = parseYear(candidate);
            if (Number.isFinite(parsed)) {
              return parsed;
            }
          }

          return null;
        };

        const gasVariablesSet = new Set();
        for (const entry of Array.isArray(gasPayload) ? gasPayload : []) {
          const rawVar =
            entry?.Var ??
            entry?.var ??
            entry?.variable ??
            entry?.Variable ??
            null;
          if (typeof rawVar === "string") {
            const trimmed = rawVar.trim();
            if (trimmed.length > 0) {
              gasVariablesSet.add(trimmed);
            }
          }
        }

        const nextDatasetOptions = [
          ...gasVariablesSet,
          ASTHMA_DATASET_LABEL,
        ];

        setDatasetOptions((prev) => {
          const sameLength = prev.length === nextDatasetOptions.length;
          const sameValues =
            sameLength &&
            prev.every(
              (value, index) => value === nextDatasetOptions[index]
            );
          return sameValues ? prev : nextDatasetOptions;
        });

        const combinedYears = Array.from(
          new Set(
            [
              ...(Array.isArray(asthmaPayload) ? asthmaPayload : []),
              ...(Array.isArray(gasPayload) ? gasPayload : []),
            ].map(collectYear)
          )
        )
          .filter(
            (year) =>
              year != null &&
              Number.isFinite(year) &&
              year < FORECAST_YEAR_MIN
          )
          .sort((a, b) => a - b)
          .map(String);

        setPrevalenceYearOptions((prev) => {
          const sameLength = prev.length === combinedYears.length;
          const sameValues =
            sameLength &&
            prev.every((value, index) => value === combinedYears[index]);
          return sameValues ? prev : combinedYears;
        });
      } catch (error) {
        console.error("Failed to load available dashboard years:", error);
      }
    };

    loadYears();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (prevalenceYearOptions.length === 0) {
      return;
    }

    setSelectedYear((current) => {
      if (prevalenceYearOptions.includes(current)) {
        return current;
      }

      if (current === PREDICTIVE_OPTION_LABEL) {
        if (manualYearSelectionRef.current) {
          return current;
        }
        manualYearSelectionRef.current = false;
        return prevalenceYearOptions[0];
      }

      manualYearSelectionRef.current = false;
      return prevalenceYearOptions[0];
    });
  }, [prevalenceYearOptions]);

  useEffect(() => {
    if (datasetOptions.length === 0) {
      return;
    }

    setSelectedPrevalence((current) => {
      if (datasetOptions.includes(current)) {
        return current;
      }

      return datasetOptions[0] ?? ASTHMA_DATASET_LABEL;
    });
  }, [datasetOptions]);

  useEffect(() => {
    if (isPredictiveSelection) {
      setSelectedPrevalence(ASTHMA_DATASET_LABEL);
    }
  }, [isPredictiveSelection]);
  const hasPreloadedInitialData = useRef(false);

  useEffect(() => {
    if (hasPreloadedInitialData.current) {
      return;
    }

    if (prevalenceYearOptions.length === 0) {
      return;
    }

    const preferredYear =
      prevalenceYearOptions.find(
        (year) => Number.parseInt(year, 10) === 2011
      ) ?? prevalenceYearOptions[0];

    const targetYear = Number.parseInt(String(preferredYear), 10);
    if (!Number.isFinite(targetYear)) {
      return;
    }

    const controller = new AbortController();

    const preload = async () => {
      try {
        hasPreloadedInitialData.current = true;
        setIsLoading(true);
        setSelectedYear(String(preferredYear));
        setSelectedPrevalence(ASTHMA_DATASET_LABEL);
        setSelectedOthers("");
        setPredictiveError(null);

        const response = await fetch(
          `${API_BASE}/get_asthma_dashboard/${targetYear}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to preload asthma data for ${targetYear}. Status: ${response.status}`
          );
        }

        const rawGeoJson = await response.json();
        const normalizedGeoJson = normalizeFeatureCollection(rawGeoJson);
        if (!normalizedGeoJson) {
          throw new Error("Received invalid asthma geo data.");
        }

        const variableName = resolveVariableName(
          normalizedGeoJson,
          ASTHMA_DATASET_LABEL
        );

        setSelectedVariable(variableName);
        setGeoData(normalizedGeoJson);
        setInfo(null);
        setConfirmedSelections(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to preload asthma dashboard:", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    preload();

    return () => {
      controller.abort();
    };
  }, [prevalenceYearOptions]);
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
          `${API_BASE}/get_asthma_dashboard/${targetYear}`
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
            `${API_BASE}/get_asthma_dashboard/${targetYear}`
          );
        } else {
          geoResponse = hasData;
        }

        const rawGeoJson = await geoResponse.json();
        const normalizedGeoJson = normalizeFeatureCollection(rawGeoJson);
        if (!normalizedGeoJson) {
          throw new Error("Received invalid forecast geo data.");
        }
        const variableName = resolveVariableName(
          normalizedGeoJson,
          selectedPrevalence
        );
        setSelectedVariable(variableName);
        setGeoData(normalizedGeoJson);

      } else {
        setPredictiveError(null);
        const targetYear = Number.parseInt(String(selectedYear), 10);
        if (!Number.isFinite(targetYear)) {
          throw new Error("Select a valid year before confirming.");
        }

        const datasetSelection =
          selectedPrevalence ?? ASTHMA_DATASET_LABEL;
        let geoResponse;

        if (datasetSelection === ASTHMA_DATASET_LABEL) {
          geoResponse = await fetch(
            `${API_BASE}/get_asthma_dashboard/${targetYear}`
          );
        } else {
          const encodedVar = encodeURIComponent(datasetSelection);
          geoResponse = await fetch(
            `${API_BASE}/get_gas_dashboard/${targetYear}/${encodedVar}`
          );
        }

        if (!geoResponse.ok) {
          throw new Error(
            `Unable to load data for ${targetYear}. Status: ${geoResponse.status}`
          );
        }

        const rawGeoJson = await geoResponse.json();
        const normalizedGeoJson = normalizeFeatureCollection(rawGeoJson);
        if (!normalizedGeoJson) {
          throw new Error("Received invalid geo data.");
        }
        const variableName = resolveVariableName(
          normalizedGeoJson,
          datasetSelection
        );

        setSelectedVariable(variableName);
        setGeoData(normalizedGeoJson);
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
              options={yearOptions}
              value={selectedYear}
              onChange={(e) => {
                const value = e.target.value;
                manualYearSelectionRef.current = true;
                setSelectedYear(value);
                setInfo(null); // Reset info when changing selection
                if (value !== predictiveOption) {
                  setPredictiveError(null);
                  setSelectedOthers("");
                }
              }}
            />
          </div>

          {/* Gas/Asthma Selection */}
          <div className="space-y-3">
            <LabelDot
              color="indigo-400"
              text={
                <span className="inline-flex items-center whitespace-nowrap">
                  Gas / Asthma Selection 
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
              label="Dataset"
              options={
                isPredictiveSelection
                  ? [ASTHMA_DATASET_LABEL]
                  : datasetOptions
              }
              value={selectedPrevalence}
              disabled={isPredictiveSelection}
              onChange={(e) => {
                setSelectedPrevalence(e.target.value);
                setInfo(null); // Reset info when changing selection
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
