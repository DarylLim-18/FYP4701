'use client';

import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';

// Fix default icon paths
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

function labelFromProps(props, prefKey) {
  if (!props) return "—";
  const candidates = [
    prefKey, 'county', 'County',
    'name', 'NAME', 'Name',
    'shapeName', 'ShapeName', 'shape_name',
    'admin2Name', 'admin1Name', 'admin0Name',
    'code', 'GEOID', 'geoid', 'id', 'ID'
  ].filter(Boolean);
  for (const k of candidates) {
    if (k in props && props[k] != null && String(props[k]).trim() !== "") return String(props[k]);
  }
  return "—";
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

  function Choropleth({ fc }) {
    const map = useMap();

    const styleFn = (feature) => {
      const v = Number(feature?.properties?.[variable]);
      return {
        fillColor: colorFor(v, max),
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        dashArray: '2',
        fillOpacity: 0.25,
      };
    };

    const onEach = (feature, layer) => {
      layer.on({
        mouseover: (e) => {
          const l = e.target;
          l.setStyle({ weight: 3, color: '#222', dashArray: '', fillOpacity: 0.6 });
          setHoverProps(feature.properties);
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) l.bringToFront();
        },
        mouseout: (e) => {
          e.target.setStyle(styleFn(feature));  // reset to base style
          setHoverProps(null);
        },
        click: (e) => map.fitBounds(e.target.getBounds()),
      });
    };

    return <GeoJSON data={fc} style={styleFn} onEachFeature={onEach} />;
  }

  const label = useMemo(() => labelFromProps(hoverProps, columnName), [hoverProps, columnName]);
  const val   = useMemo(() => {
    const v = Number(hoverProps?.[variable]);
    return Number.isFinite(v) ? v.toFixed(2) : "—";
  }, [hoverProps, variable]);

  return (
    <div className="relative w-full" style={{ height: 520 }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        />
        {data && <Choropleth fc={data} />}
      </MapContainer>

      {/* Info box (top-right) */}
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
          {hoverProps ? (
            <>
              <b>{label}</b><br />
              {val}
            </>
          ) : (
            <span>Hover over a region</span>
          )}
        </div>
      </div>

      {/* Legend (bottom-right) */}
      {Number.isFinite(max) && max > 0 && (
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
            {Array.from({ length: 5 }, (_, i) => i * (max / 5)).map((from, i, arr) => {
              const to = i < arr.length - 1 ? arr[i + 1] : max;
              const mid = from + (max / 5) * 0.5;
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
                  {Math.round(from)}–{i < arr.length - 1 ? Math.round(to) : Math.round(max)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
