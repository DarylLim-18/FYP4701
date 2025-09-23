'use client';

import { useEffect, useState } from 'react';
import FileListItem from './FileListItem';
import PreviewModal from '../Data/PreviewModal';
import { FiX } from 'react-icons/fi';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export default function DatasetPickerModal({
  open,
  onClose,
  onSelect, // (file) => void
}) {
  const [datasets, setDatasets] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [error, setError] = useState(null);

  // local preview state (kept inside the modal)
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchDatasets = async () => {
      setLoadingDatasets(true);
      try {
        const res = await fetch(`${BASE_URL}/list`);
        if (!res.ok) throw new Error('Failed to fetch dataset list.');
        const data = await res.json();
        if (!cancelled) setDatasets(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          console.error('Error fetching dataset list:', err);
        }
      } finally {
        if (!cancelled) setLoadingDatasets(false);
      }
    };

    fetchDatasets();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-1000">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-gray-900/70 shadow-2xl backdrop-blur-md overflow-hidden animate-[scaleIn_200ms_ease]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Select a Dataset</h3>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm text-gray-300 transition-all transition:300ms hover:text-white hover:scale-105 hover:bg-white/10 rounded-2xl"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
            {loadingDatasets && <div className="h-32 rounded-xl shimmer" />}
            {error && <div className="text-red-300 text-sm">{error}</div>}
            {!loadingDatasets && !error && datasets.length === 0 && (
              <div className="text-gray-400 text-sm">No files found.</div>
            )}

            {!loadingDatasets && !error && datasets.length > 0 && (
              <ul className="space-y-3">
                {datasets.map((file) => (
                  <li key={file.id}>
                    <FileListItem
                      file={file} // { id, file_name, file_type? }
                      onPreview={(f) => setPreviewFile(f)}
                      onSelect={(f) => { onSelect?.(f); onClose?.(); }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <PreviewModal
        open={!!previewFile}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
