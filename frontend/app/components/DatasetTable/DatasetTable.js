'use client';
import { useState, useEffect } from 'react';
// import { getDatasetInfo } from '@/utils/datasetUtils';

export default function DatasetTable({ folderPath = '../data' }) {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // refreshDatasets();
  }, [folderPath]);

//   const refreshDatasets = () => {
//     setLoading(true);
//     try {
//       const data = getDatasetInfo(folderPath);
//       setDatasets(data);
//       setError(null);
//     } catch (err) {
//       setError('Failed to load datasets');
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

  const handleDelete = (filePath) => {
    if (confirm('Are you sure you want to delete this dataset?')) {
      try {
        fs.unlinkSync(filePath);
        refreshDatasets();
      } catch (err) {
        setError('Failed to delete file');
        console.error(err);
      }
    }
  };

//   if (loading) return <div className="p-4 text-center">Loading datasets...</div>;
//   if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Columns</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {datasets.length > 0 ? (
            datasets.map((dataset, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-blue-600">{dataset.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{dataset.type}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(dataset.lastModified).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{dataset.size}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{dataset.columns}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleDelete(dataset.path)}
                    className="text-red-600 hover:text-red-900 mr-4"
                  >
                    Delete
                  </button>
                  <button className="text-blue-600 hover:text-blue-900">
                    Preview
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                No datasets found in the directory
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}