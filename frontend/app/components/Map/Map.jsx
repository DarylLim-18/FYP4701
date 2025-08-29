'use client';
import { MapContainer, TileLayer, useMap, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState, useRef } from 'react';

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


const VARIABLE = "Avg PM2.5"
const PATH = "geojsons/lisa-15-queen.geojson"
const COLUMN_NAME = "county"

// Get max value of Avg PM2.5
const getMaxValue = (data) => {
  const values = data.features.map(
    f => Number(f.properties?.['Avg PM2.5']) || 0
  );
  return Math.max(...values);
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
function ChoroplethLayer({ data, setInfo, onLoad, maxValue}) {
  const map = useMap();
  const geoJsonRef = useRef();

  // Style function for polygons
  const style = (feature) => {
    const v = feature?.properties?.[VARIABLE];
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
  }, [data, onLoad]);

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
const InfoControl = ({ info }) => {
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
        <h4 style={{ margin: "0 0 5px", color: "#777" }}>{VARIABLE}</h4>
        {info ? (
          <div style={{ color: "#000000"}}>
            <b>{info[COLUMN_NAME]}</b>
            <br />
            {info[VARIABLE]}%
          </div>
        ) : (
          <div style={{ color: "#000000"}}>
          Hover over a region
          </div>
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


const LoadingSpinner = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
      <div className="flex flex-col items-center">
        {/* Using a GIF from the public folder */}
        <img 
          src="/doraemon.gif"  // Path to your GIF in the public folder
          alt="Loading..." 
          className="h-100 w-100 mb-3" // Adjust size as needed
        />
        <p className="text-gray-700 font-medium">Loading map data...</p>
      </div>
    </div>
  );
};

export default function Map() {
  const [geoData, setGeoData] = useState(null);
  const [info, setInfo] = useState(null);
  const [maxValue, setMaxValue] = useState(0); // Add state for maxValue

  const [isLoading, setIsLoading] = useState(true);
  const [isLayerLoaded, setIsLayerLoaded] = useState(false);

  useEffect(() => {
    // The file must live in Next.js /public as: /public/moran_local_output.geojson
    fetch(PATH)
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data);
        // We'll wait for the layer to signal it's loaded before hiding the spinner
    //     // Compute max value from features
    //   const values = data.features.map(
    //     f => Number(f.properties?.['Avg PM2.5']) || 0
    //   );
    //   const computedMax = Math.max(...values);
    //   setMaxValue(computedMax);
    //   console.log('Values:', values);
    //   console.log('Computed max value:', Math.max(...values));
    //   console.log('Max lifetime prevalence:', maxValue);
    // Use it directly
        const computedMax = getMaxValue(data);
        setMaxValue(computedMax);
        console.log('Max lifetime prevalence:', computedMax);

      })
      .catch((err) => {
        console.error('Failed to load GeoJSON:', err);
        // setIsLoading(false);
      });
  }, []);

  return (
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
      <ChoroplethLayer data={geoData} setInfo={setInfo} maxValue={maxValue}/>
      <InfoControl info={info} />
      <Legend maxValue={maxValue} />
      <Marker position={[37.1841, -119.4696]}>
        <Popup>California</Popup>
      </Marker>
      {/* <LoadingSpinner  /> */}
    </MapContainer>
  );
}
