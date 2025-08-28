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

  // Color scale
  const getColor = (d) => {
    const v = Number(d) || 0;
    return v > 41 ? '#800026' :
           v > 35 ? '#E31A1C' :
           v > 27 ? '#FD8D3C' :
           v > 21 ? '#FEB24C' :
           v >  0 ? '#FED976' :
                    '#FFEDA0';
  };

const defaultCenter = [37.1841, -119.4696]
const defaultZoom = 6
// --- Choropleth layer ---
function ChoroplethLayer({ data, setInfo }) {
  const map = useMap();
  const geoJsonRef = useRef();



  // Style function for polygons
  const style = (feature) => {
    const v = feature?.properties?.['LIFETIME PREVALENCE'];
    return {
      fillColor: getColor(v),
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
    if (geoJsonRef.current) {
      // Store the layer instance for use in event handlers
      geoJsonRef.current = geoJsonRef.current.leafletElement;
    }
  }, [data]);

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
        <h4 style={{ margin: "0 0 5px", color: "#777" }}>Lifetime Prevalence</h4>
        {info ? (
          <div>
            <b>{info['NAME']}</b>
            <br />
            {info['LIFETIME PREVALENCE']}%
          </div>
        ) : (
          "Hover over a region"
        )}
      </div>
    </div>
  );
};

// Legend (bottom-right)
const Legend = () => {
  const grades = [0, 21, 27, 35, 41];

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
          const to = grades[i + 1];
          return (
            <div key={from}>
              <i
                style={{
                  background: getColor(from + 1),
                  width: 18,
                  height: 18,
                  float: "left",
                  marginRight: 8,
                  opacity: 0.7,
                }}
              ></i>
              {from}
              {to ? `–${to}` : "+"}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function Map() {
  const [geoData, setGeoData] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    // The file must live in Next.js /public as: /public/moran_local_output.geojson
    fetch('geojsons/lifetime-2015-2016.geojson')
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error('Failed to load local GeoJSON:', err));
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
      <ChoroplethLayer data={geoData} setInfo={setInfo} />
      <InfoControl info={info} />
      <Legend />
      <Marker position={[37.1841, -119.4696]}>
        <Popup>California</Popup>
      </Marker>
    </MapContainer>
  );
}
