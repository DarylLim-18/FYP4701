'use client';

import { useEffect, useState } from 'react';
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';
export default function VariableSelect({ fileId, value, onChange }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [headers, setHeaders] = useState([]);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;

    async function load() {
      setLoading(true); setErr(null); setHeaders([]);
      try {
        const res = await fetch(`${BASE_URL}/files/${fileId}/headers`);
        if (!res.ok) throw new Error(`Failed to fetch headers: ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        let cols = [];
        if (Array.isArray(data)) cols = data;
        else if (data && Array.isArray(data.headers)) cols = data.headers;
        else if (data && Array.isArray(data.columns)) cols = data.columns;

        setHeaders(cols);
      } catch (e) {
        if (!cancelled) setErr('Could not load headers');
        console.error('headers fetch error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fileId]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-300">Select Variable</label>

      {loading && <div className="h-10 rounded-lg shimmer" />}

      {!loading && err && (
        <div className="text-xs text-red-300">{err}</div>
      )}

      {!loading && !err && headers.length === 0 && (
        <div className="text-xs text-gray-400">No columns returned.</div>
      )}

      {!loading && !err && headers.length > 0 && (
        <select
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        >
          <option value="" disabled>Choose a column…</option>
          {headers.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      )}

      {/* Optional helper note
      <p className="text-[11px] text-gray-400">
        Tip: Select a column
      </p> */}
    </div>
  );
}
