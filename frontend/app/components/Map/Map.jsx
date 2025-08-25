'use client';
import { MapContainer, TileLayer, useMap, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';

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

// --- Choropleth layer ---
function ChoroplethLayer({ data }) {
  const map = useMap();



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





  // Proper hover highlight + reset
  const onEachFeature = (feature, layer) => {
    layer.on({
      mouseover: (e) => {
        const t = e.target;
        t.setStyle({ weight: 3, color: '#666', fillOpacity: 0.5 });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) t.bringToFront();
      },
      mouseout: (e) => {
        const t = e.target;
        // Reset using our style() so we don’t depend on Leaflet’s resetStyle
        t.setStyle(style(t.feature));
      },
    });
  };

  // Fit bounds once data is available
  useEffect(() => {
    if (!data) return;
    const tmp = L.geoJSON(data);
    const b = tmp.getBounds();
    // if (b.isValid()) map.fitBounds(b, { padding: [10, 10] });
  }, [data, map]);

  return data ? <GeoJSON data={data} style={style} onEachFeature={onEachFeature} /> : null;
}

//   // Info Control (top right hover box)
// const InfoControl = ({ info }) => {
//   return (
//     <div className="leaflet-top leaflet-right">
//       <div
//         className="info"
//         style={{
//           padding: "6px 8px",
//           font: "14px/16px Arial, Helvetica, sans-serif",
//           background: "rgba(255,255,255,0.8)",
//           boxShadow: "0 0 15px rgba(0,0,0,0.2)",
//           borderRadius: "5px",
//         }}
//       >
//         <h4 style={{ margin: "0 0 5px", color: "#777" }}>US Population Density</h4>
//         {info ? (
//           <div>
//             <b>{info.name}</b>
//             <br />
//             {info.density} people / mi<sup>2</sup>
//           </div>
//         ) : (
//           "Hover over a state"
//         )}
//       </div>
//     </div>
//   );
// };

// --- LEGEND CONTROL (bottom-right) ---
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
      center={[37.1841, -119.4696]}
      zoom={6}
      scrollWheelZoom
      style={{ height: '500px', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      />
      <ChoroplethLayer data={geoData} />
      {/* <InfoControl info={info} /> */}
      <Legend />
      <Marker position={[37.1841, -119.4696]}>
        <Popup>California</Popup>
      </Marker>
    </MapContainer>
  );
}
