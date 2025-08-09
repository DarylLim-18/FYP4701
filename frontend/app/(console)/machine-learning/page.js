'use client';
import { useState, useEffect } from 'react';

function ModelResultsCard({ results, algorithmName }) {
  if (!results || typeof results !== 'object') return null;

  function formatValue(value) {
    if (typeof value === 'number') {
      return value.toFixed(4);
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return value;
  }

  const featuresUsed = Array.isArray(results["Features Used"]) 
    ? results["Features Used"] 
    : [];

  const worstResiduals = results["Worst Residuals"] && typeof results["Worst Residuals"] === 'object'
    ? Object.entries(results["Worst Residuals"]).map(([index, value]) => ({
        index,
        value: formatValue(value)
      }))
    : null;

  return (
    <div className="py-4 bg-white p-4 dark:bg-gray-800 rounded-lg shadow-xl mb-6">
      <h2 className="text-lg font-semibold mb-3">Model Results: {algorithmName}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Features Used</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {featuresUsed.map((feature, index) => (
                <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                  {feature}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Metrics</h3>
            <div className="mt-2 space-y-2">
              {results["Mean Squared Error"] !== undefined && (
                <div className="flex justify-between">
                  <span>Mean Squared Error:</span>
                  <span className="font-mono">{formatValue(results["Mean Squared Error"])}</span>
                </div>
              )}
              {results["R² score"] !== undefined && (
                <div className="flex justify-between">
                  <span>R² Score:</span>
                  <span className="font-mono">{formatValue(results["R² score"])}</span>
                </div>
              )}
              {results["Accuracy"] !== undefined && (
                <div className="flex justify-between">
                  <span>Accuracy:</span>
                  <span className="font-mono">{formatValue(results["Accuracy"])}</span>
                </div>
              )}
              {results["Threshold"] !== undefined && (
                <div className="flex justify-between">
                  <span>Threshold:</span>
                  <span className="font-mono">{formatValue(results["Threshold"])}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          {results["Coefficients"] && Array.isArray(results["Coefficients"]) && (
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Coefficients</h3>
              <div className="mt-2 space-y-1">
                {results["Coefficients"].map((coef, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{featuresUsed[index] || `Feature ${index}`}:</span>
                    <span className="font-mono">{formatValue(coef)}</span>
                  </div>
                ))}
              </div>
              {results["Intercept"] !== undefined && (
                <div className="mt-2 flex justify-between">
                  <span>Intercept:</span>
                  <span className="font-mono">{formatValue(results["Intercept"])}</span>
                </div>
              )}
            </div>
          )}

          {worstResiduals && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Top 5 Worst Residuals</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Index</th>
                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Residual</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {worstResiduals.map(({ index, value }) => (
                      <tr key={index}>
                        <td className="px-2 py-1 whitespace-nowrap text-sm">{index}</td>
                        <td className="px-2 py-1 whitespace-nowrap text-sm font-mono">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* {results["Confusion Matrix"] && Array.isArray(results["Confusion Matrix"]) && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Confusion Matrix</h3>
              <table className="mt-2 table-auto border-collapse border border-gray-300 dark:border-gray-600">
                <tbody>
                  {results["Confusion Matrix"].map((row, i) => (
                    <tr key={i}>
                      {row.map((value, j) => (
                        <td key={j} className="border border-gray-300 dark:border-gray-600 px-3 py-1 text-center">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )} */}

          {results["Classification Report"] && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Classification Report</h3>
              <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm overflow-auto whitespace-pre-wrap">
                {results["Classification Report"]}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function MLPage() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [targetVariable, setTargetVariable] = useState('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [modelResult, setModelResult] = useState(null);

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

  const handleTrainModel = async () => {
    const api = selectedAlgorithm.api;
    setIsTraining(true);

    try {
      const queryParams = new URLSearchParams({
        target_variable: targetVariable.toString(),
        file_id: selectedDataset.id.toString()
      });

      selectedFeatures.forEach(feature => {
        queryParams.append("feature_variables", feature);
      });

      const response = await fetch(`http://localhost:8000/machine-learning/${api}?${queryParams.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      setModelResult(result); // This is crucial for displaying results

    } catch (error) {
      console.error('Training failed:', error);
      alert('Model training failed. Please check the server.');
    } finally {
      setIsTraining(false);
    }
  };



  const mlAlgorithms = [
    { id: 1, name: 'Linear Regression', type: 'Regression', api: 'linear-regression' },
    { id: 2, name: 'Random Forest', type: 'Classification', api: 'random-forest' },
    { id: 3, name: 'Logistic Regression', type: 'Classification', api: 'logistic-regression'},
    { id: 4, name: 'Naive Bayes', type: 'Classification', api: 'naive-bayes'}
  ];

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Machine Learning Configuration</h1>

      {/* Dataset Selection */}
      <div className="bg-white p-4 dark:bg-gray-800 rounded-lg shadow-xl mb-6">
        <h2 className="text-lg font-semibold mb-3">1. Select Dataset</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {datasets.map(dataset => (
            <div
              key={dataset.id}
              onClick={() => handleDatasetSelect(dataset.id)}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedDataset?.id === dataset.id
                ? 'border-black-500 bg-blue-50 dark:bg-blue-500'
                : 'border-gray-200 dark:border-black-700 hover:bg-gray-200 dark:hover:bg-blue-800'
                }`}
            >
              <h3 className="font-medium">{dataset.file_name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ID: {dataset.id}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Column Selection */}
      {selectedDataset && (
        <div className="bg-white p-4 dark:bg-gray-800 rounded-lg shadow-xl mb-6">
          <h2 className="text-lg font-semibold mb-3">2. Configure Columns</h2>

          <div className="mb-4">
            <h3 className="font-medium mb-2">Available Features</h3>
            <div className="flex flex-wrap gap-2">
              {selectedDataset.columns.map(column => (
                <button
                  key={column}
                  onClick={() => toggleFeatureSelection(column)}
                  className={`px-3 py-1 rounded-full text-sm ${selectedFeatures.includes(column)
                    ? 'bg-red-100 text-gray-800 border-blue-300 dark:bg-red-800 dark:text-blue-100 dark:border-red-500'
                    : 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
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
              {/* <option className="dark:bg-gray-800 dark:text-gray-200" value="">SELECT TARGET COLUMN</option> */}
              {selectedDataset.columns.map(column => (
                <option className="dark:bg-gray-600 dark:text-gray-200" key={column} value={column}>{column}</option>

              ))}
            </select>
          </div>
        </div>
      )}

      {/* Algorithm Selection */}
      {selectedDataset && (
        <div className="bg-white p-4 dark:bg-gray-800 rounded-lg shadow-xl mb-6">
          <h2 className="text-lg font-semibold mb-3">3. Select Algorithm</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {mlAlgorithms.map(algorithm => (
              <div
                key={algorithm.id}
                onClick={() => setSelectedAlgorithm(algorithm)}
                className={`p-4 border rounded-lg cursor-pointer ${selectedAlgorithm?.id === algorithm.id
                  ? 'border-black-500 bg-green-50 dark:bg-green-500'
                  : 'border-gray-200 dark:border-black-700 hover:bg-gray-200 dark:hover:bg-green-800'
                  }`}
              >
                <h3 className="font-medium">{algorithm.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{algorithm.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {selectedDataset && selectedFeatures.length > 0 && targetVariable && selectedAlgorithm && (
        <div className="flex justify-center mb-6">
          <button
            onClick={handleTrainModel}
            disabled={isTraining}
            className={`px-6 py-2 rounded-lg text-white font-medium ${isTraining ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            {isTraining ? 'Running Model...' : 'Run Model'}
          </button>
        </div>
      )}
      
      {/* Results Display */}
      {modelResult && selectedAlgorithm && (
        <ModelResultsCard
          results={modelResult}
          algorithmName={selectedAlgorithm.name}
        />
      )}
    </div>
  );
}
