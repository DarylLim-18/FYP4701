'use client'; // Mark as Client Component for interactivity

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function DataUploadPage() {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle file drop/upload
  const onDrop = useCallback(async (acceptedFiles) => {
    setError(null);
    const file = acceptedFiles[0];

    // Validate file type/size
    if (!file.name.match(/\.(csv|xlsx)$/i)) {
      setError('Only CSV or Excel files are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size exceeds 10MB.');
      return;
    }

    setFile(file);
    setIsLoading(true);

    try {
      const data = await parseFile(file);
      setPreviewData(data.slice(0, 5));
    } catch (err) {
      setError('Failed to parse file. Check the format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Parse CSV/Excel
  const parseFile = async (file) => {
    if (file.name.endsWith('.csv')) {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: (results) => resolve(results.data),
          error: (err) => reject(err),
        });
      });
    } else {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    }
  };

  // Submit to API route
  const handleSubmit = async () => {
    if (!Object.values(columnMapping).includes('asthma_cases')) {
      setError('Please map "Asthma Cases" to proceed.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('columnMapping', JSON.stringify(columnMapping));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed.');
      // Redirect or show success message
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Your Dataset</h1>
      
      {/* Drag-and-drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        } ${isLoading ? 'opacity-50' : ''}`}
      >
        <input {...getInputProps()} disabled={isLoading} />
        {isLoading ? (
          <p>Processing file...</p>
        ) : (
          <p>{isDragActive ? 'Drop the file here' : 'Drag & drop CSV/Excel here, or click to browse'}</p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Preview & column mapping */}
      {previewData.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Preview Data</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  {Object.keys(previewData[0]).map((col) => (
                    <th key={col} className="py-2 px-4 border">
                      <select
                        onChange={(e) => handleColumnMapping(col, e.target.value)}
                        className="border rounded p-1"
                        defaultValue=""
                      >
                        <option value="" disabled>Select field</option>
                        <option value="asthma_cases">Asthma Cases</option>
                        <option value="no2">NO2 Level</option>
                        <option value="so2">SO2 Level</option>
                        <option value="location">Location</option>
                      </select>
                      <div className="text-sm text-gray-500 mt-1">{col}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="py-2 px-4 border truncate max-w-xs">
                        {val || <span className="text-gray-400">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="mt-4 bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Analyze Data'}
          </button>
        </div>
      )}
    </div>
  );
}

// export default function DataPage() {
//     return (
//       <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
//         <h1 className="text-2xl font-bold">Data Management</h1>
//         <p>All your data analytics and management tools</p>
//       </div>
//     );
//   }