// export default function DataPage() {
//     return (
//       <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
//         <h1 className="text-2xl font-bold">Machine Learning</h1>
//         <p>Soon to implement Machine Learning!</p>
//       </div>
//     );
//   }

// 'use client';
// import { useState } from 'react';

// export default function MLPage() {
//   // Mock datasets - replace with real data later
//   const mockDatasets = [
//     { id: 1, name: 'asthma_data.csv', columns: ['age', 'gender', 'no2_level', 'so2_level', 'asthma_severity', 'location'] },
//     { id: 2, name: 'air_quality.xlsx', columns: ['pm25', 'pm10', 'temperature', 'humidity', 'health_index'] }
//   ];

//   // Mock ML algorithms
//   const mlAlgorithms = [
//     { id: 1, name: 'Linear Regression', type: 'regression' },
//     { id: 2, name: 'Random Forest', type: 'classification/regression' },
//     { id: 3, name: 'XGBoost', type: 'classification/regression' },
//     { id: 4, name: 'K-Means Clustering', type: 'clustering' }
//   ];

//   // State management
//   const [selectedDataset, setSelectedDataset] = useState(null);
//   const [selectedFeatures, setSelectedFeatures] = useState([]);
//   const [targetVariable, setTargetVariable] = useState('');
//   const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);
//   const [isTraining, setIsTraining] = useState(false);

//   // Handlers
//   const handleDatasetSelect = (datasetId) => {
//     const dataset = mockDatasets.find(ds => ds.id === datasetId);
//     setSelectedDataset(dataset);
//     setSelectedFeatures([]);
//     setTargetVariable('');
//   };

//   const toggleFeatureSelection = (column) => {
//     setSelectedFeatures(prev => 
//       prev.includes(column) 
//         ? prev.filter(f => f !== column) 
//         : [...prev, column]
//     );
//   };

//   const handleTrainModel = () => {
//     setIsTraining(true);
//     // Mock training process
//     setTimeout(() => {
//       alert(`Model training complete!\nFeatures: ${selectedFeatures.join(', ')}\nTarget: ${targetVariable}\nAlgorithm: ${selectedAlgorithm.name}`);
//       setIsTraining(false);
//     }, 2000);
//   };

//   return (
//     <div className="p-6 max-w-6xl mx-auto">
//       <h1 className="text-2xl font-bold mb-6">Machine Learning Configuration</h1>
      
//       {/* Dataset Selection */}
//       <div className="bg-white p-4 rounded-lg shadow mb-6">
//         <h2 className="text-lg font-semibold mb-3">1. Select Dataset</h2>
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
//           {mockDatasets.map(dataset => (
//             <div 
//               key={dataset.id}
//               onClick={() => handleDatasetSelect(dataset.id)}
//               className={`p-4 border rounded-lg cursor-pointer transition-colors ${
//                 selectedDataset?.id === dataset.id 
//                   ? 'border-blue-500 bg-blue-50' 
//                   : 'border-gray-200 hover:bg-gray-50'
//               }`}
//             >
//               <h3 className="font-medium">{dataset.name}</h3>
//               <p className="text-sm text-gray-500 mt-1">
//                 {dataset.columns.length} columns
//               </p>
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* Column Selection */}
//       {selectedDataset && (
//         <div className="bg-white p-4 rounded-lg shadow mb-6">
//           <h2 className="text-lg font-semibold mb-3">2. Configure Columns</h2>
          
//           <div className="mb-4">
//             <h3 className="font-medium mb-2">Available Features</h3>
//             <div className="flex flex-wrap gap-2">
//               {selectedDataset.columns.map(column => (
//                 <button
//                   key={column}
//                   onClick={() => toggleFeatureSelection(column)}
//                   className={`px-3 py-1 rounded-full text-sm ${
//                     selectedFeatures.includes(column)
//                       ? 'bg-blue-100 text-blue-800 border border-blue-300'
//                       : 'bg-gray-100 text-gray-800 border border-gray-200'
//                   }`}
//                 >
//                   {column}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div className="mt-4">
//             <label className="block font-medium mb-2">Target Variable</label>
//             <select
//               value={targetVariable}
//               onChange={(e) => setTargetVariable(e.target.value)}
//               className="w-full p-2 border border-gray-300 rounded"
//             >
//               <option value="">Select target column</option>
//               {selectedDataset.columns.map(column => (
//                 <option key={column} value={column}>{column}</option>
//               ))}
//             </select>
//           </div>
//         </div>
//       )}

//       {/* Algorithm Selection */}
//       {selectedDataset && (
//         <div className="bg-white p-4 rounded-lg shadow mb-6">
//           <h2 className="text-lg font-semibold mb-3">3. Select Algorithm</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
//             {mlAlgorithms.map(algorithm => (
//               <div
//                 key={algorithm.id}
//                 onClick={() => setSelectedAlgorithm(algorithm)}
//                 className={`p-4 border rounded-lg cursor-pointer ${
//                   selectedAlgorithm?.id === algorithm.id
//                     ? 'border-green-500 bg-green-50'
//                     : 'border-gray-200 hover:bg-gray-50'
//                 }`}
//               >
//                 <h3 className="font-medium">{algorithm.name}</h3>
//                 <p className="text-sm text-gray-500 mt-1">{algorithm.type}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Action Button */}
//       {selectedDataset && selectedFeatures.length > 0 && targetVariable && selectedAlgorithm && (
//         <div className="flex justify-center">
//           <button
//             onClick={handleTrainModel}
//             disabled={isTraining}
//             className={`px-6 py-2 rounded-lg text-white font-medium ${
//               isTraining ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
//             }`}
//           >
//             {isTraining ? 'Training Model...' : 'Train Model'}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

'use client';
import { useState, useEffect } from 'react';

export default function MLPage() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [targetVariable, setTargetVariable] = useState('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);
  const [isTraining, setIsTraining] = useState(false);

  // Update this to match your FastAPI backend
  const BASE_URL = 'http://localhost:8000';

  // Fetch datasets on component mount
  useEffect(() => {
    fetch(`${BASE_URL}/list`)
      .then(res => res.json())
      .then(data => setDatasets(data))
      .catch(err => console.error('Error fetching dataset list:', err));
  }, []);

  // Fetch column headers for selected dataset
  const handleDatasetSelect = async (datasetId) => {
    const dataset = datasets.find(ds => ds.id === datasetId);
    try {
      const res = await fetch(`${BASE_URL}/files/${datasetId}/headers`);
      const data = await res.json();
      setSelectedDataset({ ...dataset, columns: data.columns });
      setSelectedFeatures([]);
      setTargetVariable('');
    } catch (error) {
      console.error('Error fetching headers:', error);
    }
  };

  const toggleFeatureSelection = (column) => {
    setSelectedFeatures(prev =>
      prev.includes(column)
        ? prev.filter(f => f !== column)
        : [...prev, column]
    );
  };

  const handleTrainModel = () => {
    setIsTraining(true);
    setTimeout(() => {
      alert(`Model training complete!\nFeatures: ${selectedFeatures.join(', ')}\nTarget: ${targetVariable}\nAlgorithm: ${selectedAlgorithm.name}`);
      setIsTraining(false);
    }, 2000);
  };

  const mlAlgorithms = [
    { id: 1, name: 'Linear Regression', type: 'regression' },
    { id: 2, name: 'Random Forest', type: 'classification/regression' },
    { id: 3, name: 'XGBoost', type: 'classification/regression' },
    { id: 4, name: 'K-Means Clustering', type: 'clustering' }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Machine Learning Configuration</h1>

      {/* Dataset Selection */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">1. Select Dataset</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {datasets.map(dataset => (
            <div
              key={dataset.id}
              onClick={() => handleDatasetSelect(dataset.id)}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedDataset?.id === dataset.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <h3 className="font-medium">{dataset.file_name}</h3>
              <p className="text-sm text-gray-500 mt-1">ID: {dataset.id}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Column Selection */}
      {selectedDataset && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-3">2. Configure Columns</h2>

          <div className="mb-4">
            <h3 className="font-medium mb-2">Available Features</h3>
            <div className="flex flex-wrap gap-2">
              {selectedDataset.columns.map(column => (
                <button
                  key={column}
                  onClick={() => toggleFeatureSelection(column)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedFeatures.includes(column)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                  }`}
                >
                  {column}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block font-medium mb-2">Target Variable</label>
            <select
              value={targetVariable}
              onChange={(e) => setTargetVariable(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="">Select target column</option>
              {selectedDataset.columns.map(column => (
                <option key={column} value={column}>{column}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Algorithm Selection */}
      {selectedDataset && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-3">3. Select Algorithm</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {mlAlgorithms.map(algorithm => (
              <div
                key={algorithm.id}
                onClick={() => setSelectedAlgorithm(algorithm)}
                className={`p-4 border rounded-lg cursor-pointer ${
                  selectedAlgorithm?.id === algorithm.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <h3 className="font-medium">{algorithm.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{algorithm.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {selectedDataset && selectedFeatures.length > 0 && targetVariable && selectedAlgorithm && (
        <div className="flex justify-center">
          <button
            onClick={handleTrainModel}
            disabled={isTraining}
            className={`px-6 py-2 rounded-lg text-white font-medium ${
              isTraining ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isTraining ? 'Running Model...' : 'Run Model'}
          </button>
        </div>
      )}
    </div>
  );
}
