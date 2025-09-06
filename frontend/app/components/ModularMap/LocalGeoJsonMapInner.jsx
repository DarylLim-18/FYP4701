'use client';

import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';

// Fix default icon paths for Leaflet markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function colorFor(value, max) {
  if (!Number.isFinite(max) || max <= 0) return '#FFEDA0';
  const step = max / 5;
  return value > 4 * step ? '#800026'
       : value > 3 * step ? '#E31A1C'
       : value > 2 * step ? '#FD8D3C'
       : value > 1 * step ? '#FEB24C'
       : value > 0        ? '#FED976'
                          : '#FFEDA0';
}

function Choropleth({ data, variable, setHoverProps }) {
  const map = useMap();
  const layerRef = useRef();

  const maxVal = useMemo(() => {
    if (!data?.features?.length) return 0;
    let m = 0;
    for (const f of data.features) {
      const v = Number(f?.properties?.[variable]);
      if (Number.isFinite(v) && v > m) m = v;
    }
    return m;
  }, [data, variable]);

  const style = (feature) => {
    const v = Number(feature?.properties?.[variable]);
    return {
      fillColor: colorFor(v, maxVal),
      weight: 1,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.25,
    };
  };

  const onEach = (feature, layer) => {
    layer.on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ weight: 3, color: '#666', dashArray: '', fillOpacity: 0.6 });
        setHoverProps(feature.properties);
        // bringToFront sometimes needs a tick
        setTimeout(() => l.bringToFront(), 0);
      },
      mouseout: (e) => {
        layerRef.current?.resetStyle(e.target);
        setHoverProps(null);
      },
      click: (e) => map.fitBounds(e.target.getBounds()),
    });
  };

  return data ? (
    <GeoJSON
      ref={(r) => (layerRef.current = r)}
      data={data}
      style={style}
      onEachFeature={onEach}
    />
  ) : null;
}

function InfoBox({ props, variable, columnName }) {
  return (
    <div className="leaflet-top leaflet-right">
      <div
        className="info"
        style={{
          padding: "6px 8px",
          font: "14px/16px Arial, Helvetica, sans-serif",
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 0 15px rgba(0,0,0,0.2)",
          borderRadius: "5px",
          margin: "15px",
          color: "#000",
        }}
      >
        <h4 style={{ margin: "0 0 5px", color: "#444" }}>{variable}</h4>
        {props ? (
          <>
            <b>{props?.[columnName] ?? "—"}</b><br />
            {Number.isFinite(Number(props?.[variable])) ? Number(props[variable]).toFixed(2) : "—"}
          </>
        ) : (
          <span>Hover over a region</span>
        )}
      </div>
    </div>
  );
}

function Legend({ max }) {
  if (!Number.isFinite(max) || max <= 0) return null;
  const steps = 5;
  const step = max / steps;
  const bins = Array.from({ length: steps }, (_, i) => i * step);

  return (
    <div className="leaflet-bottom leaflet-right">
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
        }}
      >
        {bins.map((from, i) => {
          const mid = from + step * 0.5;
          const to = i < bins.length - 1 ? bins[i + 1] : max;
          return (
            <div key={i}>
              <i
                style={{
                  background: colorFor(mid, max),
                  width: 18,
                  height: 18,
                  float: "left",
                  marginRight: 8,
                  opacity: 0.7,
                }}
              />
              {Math.round(from)}–{i < bins.length - 1 ? Math.round(to) : Math.round(max)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LocalGeoJsonMapInner({
  path,
  variable,
  columnName,
  center = [37.1841, -119.4696],
  zoom = 6,
  onLoaded,
}) {
  const [data, setData] = useState(null);
  const [hoverProps, setHoverProps] = useState(null);
  const [max, setMax] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(path);
        const gj = await res.json();
        if (cancelled) return;
        setData(gj);
        // compute max
        let m = 0;
        for (const f of gj?.features ?? []) {
          const v = Number(f?.properties?.[variable]);
          if (Number.isFinite(v) && v > m) m = v;
        }
        setMax(m);
        onLoaded?.();
      } catch (e) {
        console.error("Failed to load GeoJSON:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [path, variable, onLoaded]);

  return (
    <div className="relative w-full" style={{ height: 520 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        />
        <Choropleth data={data} variable={variable} setHoverProps={setHoverProps} />
      </MapContainer>
      <InfoBox props={hoverProps} variable={variable} columnName={columnName} />
      <Legend max={max} />
    </div>
  );
}
