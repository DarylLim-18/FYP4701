'use client';
import { MapContainer, TileLayer, useMap, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState, useRef } from 'react';
import { FiPlay, FiBarChart2, FiAlertCircle } from 'react-icons/fi';
import { FaStarOfDavid } from "react-icons/fa6";
import { BsStars } from "react-icons/bs";

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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
// const VARIABLE = "Avg PM2.5"
// const PATH = "geojsons/lisa-1.geojson"
const COLUMN_NAME = "county"

// Extract all types of prevalence (current & lifetime)
const typeOfPrevalence = ['current', 'lifetime'];

// Get all prevalence years
const prevalenceYears = [
  "2015-2016",
  "2017-2018",
  "2019-2020",
  "2021-2022",
  "Others (Predictive)"
];

// Get max value of selected variable
const getMaxValue = (data, variableName) => {
  if (!data || !data.features) return 0;
  
  const values = data.features
    .map(f => {
      const value = f.properties?.[variableName];
      return typeof value === 'number' ? value : 
             typeof value === 'string' ? parseFloat(value) : 0;
    })
    .filter(v => !isNaN(v));
  
  return values.length > 0 ? Math.max(...values) : 0;
};


  // Color scale
const getColor = (d, maxValue) => {
  if (!maxValue || maxValue === 0) return '#FFEDA0';
  const step = maxValue / 5;
//   console.log('Step value:', 4 * step);
  
  return d > 4 * step ? '#800026' :
         d > 3 * step ? '#E31A1C' :
         d > 2 * step ? '#FD8D3C' :
         d > 1 * step ? '#FEB24C' :
         d > 0        ? '#FED976' :
                        '#FFEDA0';
};

const defaultCenter = [37.1841, -119.4696]
const defaultZoom = 6
// --- Choropleth layer ---
function ChoroplethLayer({ data, setInfo, onLoad, selectedVariable, maxValue}) {
  const map = useMap();
  const geoJsonRef = useRef();

  // Style function for polygons
//   const style = (feature) => {
//     const v = feature?.properties?.[selectedVariable];
//     return {
//       fillColor: getColor(v, maxValue),
//       weight: 1,
//       opacity: 1,
//       color: 'white',
//       dashArray: '3',
//       fillOpacity: 0.7,
//     };
//   };
  const style = (feature) => {
    const v = Number(feature?.properties?.[selectedVariable]);
    return {
      fillColor: colorFor(v, 0, maxValue), // Start with just positive values
      weight: 1,
      opacity: 1,
      color: "#888", // Changed to gray
      dashArray: "2", // Changed to match friend's
      fillOpacity: 0.25 // More transparent
    };
  };

//   const highlightFeature = (e) => {
//     const layer = e.target;
//     layer.setStyle({
//       weight: 5,
//       color: '#666',
//       dashArray: '',
//       fillOpacity: 0.7
//     });
//     setInfo(layer.feature.properties);
    
//     setTimeout(() => layer.bringToFront(), 1); // Delays highlight so that it is brought to front after updating info control.
//   };
  const highlightFeature = (e) => {
    const layer = e.target;
    layer.setStyle({
      weight: 3, // Thinner than yours
      color: "#222", // Darker border
      dashArray: "", // Solid border
      fillOpacity: 0.6 // Less opaque than yours
    });
    setInfo(layer.feature.properties);
  
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront(), 1;
    }
  };

  const resetHighlight = (e) => {
    if (geoJsonRef.current) {
      geoJsonRef.current.resetStyle(e.target);
    }
    setInfo(null);
  };

  const zoomToFeature = (e) => {
    map.fitBounds(e.target.getBounds());
  };

  // Proper hover highlight + reset
  const onEachFeature = (feature, layer) => {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: zoomToFeature
    });
  };

  // Create a ref to access the GeoJSON layer instance
  useEffect(() => {
    // if (geoJsonRef.current && data) {
    //   // Store the layer instance for use in event handlers
    //   geoJsonRef.current = geoJsonRef.current.leafletElement;

    //   // Notify parent that the layer has been loaded
    //   if (onLoad) onLoad();
    // }
  }, [data, setInfo, onLoad, selectedVariable, maxValue]);

  return data ? (
    <GeoJSON 
      ref={geoJsonRef}
      data={data} 
      style={style} 
      onEachFeature={onEachFeature} 
    />
  ) : null;
}

// Info Control (top right hover box)
const InfoControl = ({ info, selectedVariable }) => {
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
            <div style={{ color: "#000000"}}>
              <b>{info?.county || info?.NAME || info?.name || 'Unknown Region'}</b>
              <br />
              {Math.round(info[selectedVariable] * 100) / 100}%
            </div>
          ) : (
            <div style={{ color: "#000000"}}>Hover over a region</div>
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

  // Generate bin starts without rounding to avoid duplicate values
  const segments = [];

  if (minValue < 0) {
    const negStart = minValue;
    const negEnd = Math.min(maxValue, 0);
    if (negEnd > negStart) {
      const negStep = (negEnd - negStart) / NEGATIVE_COLORS.length;
      for (let i = 0; i < NEGATIVE_COLORS.length; i += 1) {
        const from = negStart + i * negStep;
        const to = i === NEGATIVE_COLORS.length - 1 ? negEnd : negStart + (i + 1) * negStep;
        segments.push({ color: NEGATIVE_COLORS[i], from, to });
      }
    }
  }

  if (maxValue > 0) {
    const posStart = minValue >= 0 ? minValue : 0;
    const posEnd = Math.max(maxValue, posStart);
    if (posEnd > posStart) {
      const posStep = (posEnd - posStart) / POSITIVE_COLORS.length;
      for (let i = 0; i < POSITIVE_COLORS.length; i += 1) {
        const from = posStart + i * posStep;
        const to = i === POSITIVE_COLORS.length - 1 ? posEnd : posStart + (i + 1) * posStep;
        segments.push({ color: POSITIVE_COLORS[i], from, to });
      }
    }
  }

  const fmt = (n) =>
    Number.isFinite(n) ? new Intl.NumberFormat().format(Math.round(n)) : n;

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
      {segments.length > 0 && (
        <div className="leaflet-bottom leaflet-right" style={{ zIndex: 400 }}>
          <div
            className="info legend"
            style={{
              background: "rgba(255,255,255,0.85)",
              padding: "8px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              lineHeight: "18px",
            //   // dynamically adjust width based on content
            //   maxWidth: "200px",
            //   minWidth: "100px",
              whiteSpace: "nowrap",
              color: "#333",
              margin: "15px",
              fontSize: "12px",
            }}
          >
            {segments.map(({ color, from, to }, idx) => (
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
    </div>
  );
};

// LabelDot component from your friend's code
function LabelDot({ color, text }) {
  const cls = {
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
      <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">{text}</label>
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
  const [maxValue, setMaxValue] = useState(0); // Add state for maxValue

//   const [isLoading, setIsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
    const [confirmedSelections, setConfirmedSelections] = useState(false);

  const [isLayerLoaded, setIsLayerLoaded] = useState(false);
  const [selectedPrevalence, setSelectedPrevalence] = useState(typeOfPrevalence[0]);
  const [selectedYear, setSelectedYear] = useState(prevalenceYears[0]);
  const [selectedVariable, setSelectedVariable] = useState(""); // Fixed variable name based on selection

  // Construct the file path based on selections
  const getGeoJsonPath = () => {
    return `/geojsons/${selectedPrevalence}-${selectedYear}.geojson`;
  };

//   useEffect(() => {
//     // The file must live in Next.js /public as: /public/moran_local_output.geojson
//     fetch(getGeoJsonPath())
//       .then((res) => res.json())
//       .then((data) => {
//         setGeoData(data);
//         // We'll wait for the layer to signal it's loaded before hiding the spinner
//     //     // Compute max value from features
//     //   const values = data.features.map(
//     //     f => Number(f.properties?.['Avg PM2.5']) || 0
//     //   );
//     //   const computedMax = Math.max(...values);
//     //   setMaxValue(computedMax);
//     //   console.log('Values:', values);
//     //   console.log('Computed max value:', Math.max(...values));
//     //   console.log('Max lifetime prevalence:', maxValue);
//     // Use it directly
//         const computedMax = getMaxValue(data);
//         setMaxValue(computedMax);
//         console.log('Max lifetime prevalence:', computedMax);

//       })
//       .catch((err) => {
//         console.error('Failed to load GeoJSON:', err);
//         // setIsLoading(false);
//       });
//   }, []);

// Handle confirmation
const handleConfirm = () => {
  setIsLoading(true);
  setConfirmedSelections(true);
  setInfo(null); // Reset info on new load
  
  console.log('Fetching GeoJSON from:', getGeoJsonPath());
  fetch(getGeoJsonPath())
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      console.log('GeoJSON loaded successfully:', data);
      
      const selectedVariable = selectedPrevalence === 'lifetime' 
        ? 'LIFETIME PREVALENCE' 
        : 'CURRENT PREVALENCE';
      
      setSelectedVariable(selectedVariable);
      setGeoData(data);
      const computedMax = getMaxValue(data, selectedVariable);
      setMaxValue(computedMax);
      setIsLoading(false);
    })
    .catch((err) => {
      console.error('Failed to load GeoJSON:', err);
      setIsLoading(false);
    });
};
  
const handleConfirmWithDelay = async () => {
  setIsLoading(true);
  
  // Fixed delay of 1.5 seconds
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Call handleConfirm without await since it manages its own loading state
  handleConfirm();
};

const [selectedOthers, setSelectedOthers] = useState("");

  return (
    <div className="h-full overflow-hidden bg-gray-900/60 rounded-2xl shadow-xl text-white">
      <main className="h-full grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-hidden">
        {/* Controls */}
        <div className="min-h-0 p-6 space-y-6 border border-white/10 rounded-2xl shadow-xl bg-white/5">
            {/* <MapControls /> */}
            {/* Prevalence Type Selection */}
              <div className="space-y-3">
                <LabelDot color="indigo-400" text="Prevalence Type" />
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
                <LabelDot color="emerald-400" text="Time Period" />
                <StyledSelect
                  label="Year Range"
                  options={prevalenceYears}
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setInfo(null); // Reset info when changing selection
                  }}
                />
              </div>

            {/* Show additional options if "Others (Predictive)" is selected */}
              {selectedYear === prevalenceYears[prevalenceYears.length - 1] && (
                <div className="space-y-3">
                  <LabelDot color="rose-400" text={
                                                    <span className="inline-flex items-center whitespace-nowrap">
                                                    Other Years  <BsStars className="ml-1 text-xl" />
                                                    </span>
                                                } />
                  {/* Text box to input desired year (e.g. 2026) */}
                    <input
                      type="text"
                      value={selectedOthers}
                      onChange={(e) => setSelectedOthers(e.target.value)}
                      placeholder="Enter year (e.g. 2026)"
                      className="w-full p-2 border border-white/10 rounded-lg bg-transparent focus:outline-none"
                    />
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
                    : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
                ].join(" ")}
              >
                <div className="relative z-10 flex items-center gap-3">
                <FiPlay className={`w-5 h-5 transition-transform ${isLoading ? "animate-pulse" : "group-hover:scale-110"}`} />
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
            <p>Select parameters and click "Confirm Selection" to load the map</p>
            </div>
        </div>
        ) : (
        // Your map component here
        <MapContainer
        key={`${selectedPrevalence}-${selectedYear}`} // 🚨 ADD THIS - forces remount
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom
        style={{ height: '500px', width: '100%' }}
        >
        <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        />
        <ChoroplethLayer data={geoData} setInfo={setInfo} selectedVariable={selectedVariable} maxValue={maxValue}/>
        <InfoControl info={info} selectedVariable={selectedVariable} />
        <Legend maxValue={maxValue} />
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
