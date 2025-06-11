'use client';
import { useState, useCallback } from 'react';

export default function UploadModal({ onUploadSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setError(null);
    setSelectedFile(e.target.files[0]);
  };

  const onDrop = useCallback((acceptedFiles) => {
    setError(null);
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {  // Changed to relative path
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      onUploadSuccess?.();
      setIsOpen(false);
      setSelectedFile(null);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Upload File
      </button>

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => !isUploading && setIsOpen(false)}
        >
          <div 
            className="bg-white rounded-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Upload Document</h2>
              <button
                onClick={() => !isUploading && setIsOpen(false)}
                disabled={isUploading}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                &times;
              </button>
            </div>

            {/* Drag & Drop Area */}
            <label
              htmlFor="file-upload"
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer ${
                selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500'
              } transition-colors mb-4`}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(e.dataTransfer.files);
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              {selectedFile ? (
                <p className="text-center">
                  <span className="font-medium">{selectedFile.name}</span>
                  <br />
                  <span className="text-sm text-gray-500">Click to change</span>
                </p>
              ) : (
                <>
                  <p>Drag & drop files here</p>
                  <p className="text-sm text-gray-500 my-2">or</p>
                  <span className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                    Select File
                  </span>
                </>
              )}
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".csv,.xlsx"
              />
            </label>

            {/* Error Message */}
            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isUploading}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedFile || isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}