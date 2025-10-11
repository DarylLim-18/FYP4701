'use client';
import { MapContainer, TileLayer, useMap, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState, useRef } from 'react';
import { FiPlay, FiBarChart2, FiAlertCircle } from 'react-icons/fi';

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


// const VARIABLE = "Avg PM2.5"
// const PATH = "geojsons/lisa-1.geojson"
const COLUMN_NAME = "county"

// Extract all types of prevalence (current & lifetime)
const typeOfPrevalence = ['current', 'lifetime'];

// Get all prevalence years
const prevalenceYears = ["2015-2016", "2017-2018", "2019-2020", "2021-2022"];

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
  const style = (feature) => {
    const v = feature?.properties?.[selectedVariable];
    return {
      fillColor: getColor(v, maxValue),
      weight: 1,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.2,
    };
  };

  const highlightFeature = (e) => {
    const layer = e.target;
    layer.setStyle({
      weight: 5,
      color: '#666',
      dashArray: '',
      fillOpacity: 0.7
    });
    setInfo(layer.feature.properties);
    
    setTimeout(() => layer.bringToFront(), 1); // Delays highlight so that it is brought to front after updating info control.
  };

  const resetHighlight = (e) => {
    // Use the style function to reset instead of relying on react-leaflet's reset
    geoJsonRef.current.resetStyle(e.target);
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
    if (geoJsonRef.current && data) {
      // Store the layer instance for use in event handlers
      geoJsonRef.current = geoJsonRef.current.leafletElement;

      // Notify parent that the layer has been loaded
      if (onLoad) onLoad();
    }
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

// Legend (bottom-right)
const Legend = ({ maxValue }) => {
  const values = 5;
  const step = maxValue / values;

  // Generate bin starts without rounding to avoid duplicate values
  const grades = Array.from({ length: values }, (_, i) => i * step);

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
        {grades.map((from, i) => {
          const to = i < grades.length - 1 ? grades[i + 1] : maxValue;
          return (
            <div key={`bin-${i}`}>
              <i
                style={{
                  background: getColor(from + step * 0.5, maxValue),
                  width: 18,
                  height: 18,
                  float: "left",
                  marginRight: 8,
                  opacity: 0.7,
                }}
              />
              {fmt(from)}–{i < grades.length - 1 ? fmt(to) : fmt(maxValue)} 
              {i === grades.length - 1 ? "+" : ""}
            </div>
          );
        })}
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

  return (
    <div className="h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
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
                  onChange={(e) => setSelectedPrevalence(e.target.value)}
                />
              </div>

              {/* Year Selection */}
              <div className="space-y-3">
                <LabelDot color="emerald-400" text="Time Period" />
                <StyledSelect
                  label="Year Range"
                  options={prevalenceYears}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                />
              </div>

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
