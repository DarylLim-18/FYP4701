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

// --- Choropleth layer ---
function ChoroplethLayer({ data }) {
  const map = useMap();

  // Color scale
  const getColor = (d) => {
    const v = Number(d) || 0;
    return v > 41 ? '#E31A1C' :
           v > 35 ? '#FD8D3C' :
           v > 27 ? '#FEB24C' :
           v > 21 ? '#FFEDA0' :
           v >  0 ? '#FD8D3C' :
                    '#FFEDA0';
  };

  // Style function for polygons
  const style = (feature) => {
    const v = feature?.properties?.['LIFETIME PREVALENCE'];
    return {
      fillColor: getColor(v),
      weight: 1,
      opacity: 1,
      color: 'black',
      dashArray: '3',
      fillOpacity: 0.7,
    };
  };

  // Proper hover highlight + reset
  const onEachFeature = (feature, layer) => {
    layer.on({
      mouseover: (e) => {
        const t = e.target;
        t.setStyle({ weight: 3, color: '#666', fillOpacity: 1 });
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

export default function Map() {
  const [geoData, setGeoData] = useState(null);

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
      <Marker position={[37.1841, -119.4696]}>
        <Popup>California</Popup>
      </Marker>
    </MapContainer>
  );
}
