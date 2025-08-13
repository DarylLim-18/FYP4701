'use client';
import { MapContainer, TileLayer, useMap, Marker, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';

// 🛠 Fix default icon paths for Webpack
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Choropleth layer
function ChoroplethLayer({ data}) {
    const map = useMap();

    // Color scale function
    const getColor = (d) =>
    d > 20 ? '#020080ff' : //'#800026' :
    d > 15 ? '#BD0026' :
    d > 10 ? '#E31A1C' :
    d > 5  ? '#FC4E2A' :
    d > 0  ? '#FD8D3C' :
             '#FFEDA0' ;
    
    // Style function for GeoJSON polygons
    const style = (feature) => ({
        fillColor: getColor(feature.properties['LIFETIME PREVALENCE']),
        weight: 2,
        opacity: 1,
        color: 'black',
        fillOpacity: 0.8,
    });

    // Fit bounds when data is loaded
    // useEffect(() => {
    //     if (data) {
    //     const layer = L.geoJSON(data);
    //     map.fitBounds(layer.getBounds());
    //     }
    // }, [data, map]);

    const onEachFeature = (feature, layer) => {
    layer.on({
        mouseover: (e) => {
            const layer = e.target;
            layer.setStyle({
                weight: 3,
                color: '#666',
                fillOpacity: 1
            });
            layer.bringToFront();
        },
        mouseout: (e) => {
            GeoJSON.resetStyle(e.target);
        }
        });
    };

    return data ? <GeoJSON data={data} style={style} onEachFeature={onEachFeature} /> : null;


    // return data ? <GeoJSON data={data} style={style} /> : null;
}

export default function Map() {
    const [geoData, setGeoData] = useState(null);

    useEffect(() => {
        fetch('/moran_local_output.geojson') // Ensure file is in "public" folder
        .then((res) => res.json())
        .then((data) => setGeoData(data));
    }, []);

    return(
        <MapContainer center={[37.1841, -119.4696]} zoom={6} scrollWheelZoom={true} style={{ height: "500px", width: "100%" }}>
        {/* <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        /> */}
        <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        
        <ChoroplethLayer data={geoData} />

        <Marker position={[37.1841, -119.4696]}>
            <Popup>California</Popup>
        </Marker>
        </MapContainer>
    );
}
