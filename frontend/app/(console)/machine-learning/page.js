'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BrainLogo, DatabaseIcon, SlidersIcon,
  AtomIcon, ChartLineIcon, ClassifierIcon, LoaderIcon
} from '../../components/icons'

const BASE_URL = 'http://localhost:8000'

const formatValue = (value) => {
  if (typeof value === 'number') return value.toFixed(4)
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

const ModelResultsCard = ({ results, algorithmName }) => {
  const featuresUsed = Array.isArray(results['Features Used']) ? results['Features Used'] : []
  const worstResiduals = results['Worst Residuals'] && typeof results['Worst Residuals'] === 'object'
    ? Object.entries(results['Worst Residuals']).map(([index, value]) => ({ index, value: formatValue(value) }))
    : null

  return (
    <div className="bg-slate-800/50 rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-700 backdrop-blur-sm">
      <h2 className="text-2xl font-bold text-white mb-6">
        Model Results: <span className="text-emerald-400">{algorithmName}</span>
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-slate-300 text-lg mb-3">Metrics</h3>
            <div className="bg-slate-900/70 rounded-lg p-4 space-y-3 text-sm">
              {results['Mean Squared Error'] !== undefined && (
                <div className="flex justify-between"><span className="text-slate-400">Mean Squared Error:</span><span className="font-mono text-amber-400">{formatValue(results['Mean Squared Error'])}</span></div>
              )}
              {results['R² score'] !== undefined && (
                <div className="flex justify-between"><span className="text-slate-400">R² Score:</span><span className="font-mono text-amber-400">{formatValue(results['R² score'])}</span></div>
              )}
              {results['Accuracy'] !== undefined && (
                <div className="flex justify-between"><span className="text-slate-400">Accuracy:</span><span className="font-mono text-amber-400">{formatValue(results['Accuracy'])}</span></div>
              )}
              {results['Threshold'] !== undefined && (
                <div className="flex justify-between"><span className="text-slate-400">Threshold:</span><span className="font-mono text-amber-400">{formatValue(results['Threshold'])}</span></div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-300 text-lg mb-3">Features Used</h3>
            <div className="flex flex-wrap gap-2">
              {featuresUsed.map((feature, i) => (
                <span key={i} className="px-3 py-1 bg-sky-500/10 text-sky-300 rounded-full text-xs font-medium border border-sky-500/20">
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {results['Coefficients'] && Array.isArray(results['Coefficients']) && (
            <div>
              <h3 className="font-semibold text-slate-300 text-lg mb-3">Coefficients</h3>
              <div className="bg-slate-900/70 rounded-lg p-4 space-y-2 text-sm">
                {results['Coefficients'].map((coef, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-400">{featuresUsed[i] || `Feature ${i}`}</span>
                    <span className="font-mono text-amber-400">{formatValue(coef)}</span>
                  </div>
                ))}
                {results['Intercept'] !== undefined && (
                  <div className="border-t border-slate-700 mt-3 pt-3 flex justify-between">
                    <span className="text-slate-400 font-semibold">Intercept:</span>
                    <span className="font-mono text-amber-400 font-semibold">{formatValue(results['Intercept'])}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {worstResiduals && (
            <div>
              <h3 className="font-semibold text-slate-300 text-lg mb-3">Top 5 Worst Residuals</h3>
              <div className="overflow-hidden rounded-lg bg-slate-900/70">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Index</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Residual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {worstResiduals.map(({ index, value }) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-slate-300">{index}</td>
                        <td className="px-4 py-2 text-sm font-mono text-amber-400">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {results['Classification Report'] && (
            <div>
              <h3 className="font-semibold text-slate-300 text-lg mb-3">Classification Report</h3>
              <pre className="bg-slate-900/70 p-4 rounded-lg text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                {results['Classification Report']}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const StepCard = ({ icon, number, title, children, isEnabled }) => (
  <div className={`bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700 transition-all duration-500 ${isEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
    <div className="p-6 border-b border-slate-700 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-sky-400">
        {icon}
      </div>
      <div>
        <span className="text-sm font-bold text-sky-400">STEP {number}</span>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
)

export default function MachineLearningPage() {
  const [datasets, setDatasets] = useState([])
  const [selectedDataset, setSelectedDataset] = useState(null)
  const [selectedFeatures, setSelectedFeatures] = useState([])
  const [targetVariable, setTargetVariable] = useState('')
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(null)
  const [isTraining, setIsTraining] = useState(false)
  const [modelResult, setModelResult] = useState(null)
  const [error, setError] = useState(null)
  const [loadingDatasets, setLoadingDatasets] = useState(false)

  const mlAlgorithms = [
    { id: 1, name: 'Linear Regression', type: 'Regression', api: 'linear-regression' },
    { id: 2, name: 'Random Forest', type: 'Classification', api: 'random-forest' },
    { id: 3, name: 'Logistic Regression', type: 'Classification', api: 'logistic-regression' },
    { id: 4, name: 'Naive Bayes', type: 'Classification', api: 'naive-bayes' },
    { id: 5, name: 'Gradient Boosting',     type: 'Regression', api: 'gradient-boosting' },
    { id: 6, name: 'Support Vector Regression', type: 'Regression', api: 'svr' }
  ]

  useEffect(() => {
    const fetchDatasets = async () => {
      setLoadingDatasets(true)
      try {
        const res = await fetch(`${BASE_URL}/list`)
        if (!res.ok) throw new Error('Failed to fetch dataset list.')
        const data = await res.json()
        setDatasets(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err.message)
        console.error('Error fetching dataset list:', err)
      } finally {
        setLoadingDatasets(false)
      }
    }
    fetchDatasets()
  }, [])

  const handleDatasetSelect = useCallback(async (datasetId) => {
    if (selectedDataset?.id === datasetId) return

    const dataset = datasets.find(ds => ds.id === datasetId)
    if (!dataset) return

    // Reset downstream state
    setSelectedDataset(null)
    setSelectedFeatures([])
    setTargetVariable('')
    setSelectedAlgorithm(null)
    setModelResult(null)
    setError(null)

    try {
      const res = await fetch(`${BASE_URL}/files/${datasetId}/headers`)
      if (!res.ok) throw new Error('Failed to fetch dataset headers.')
      const data = await res.json()
      setSelectedDataset({ ...dataset, columns: data.columns || [] })
    } catch (err) {
      setError(err.message)
      console.error('Error fetching headers:', err)
    }
  }, [datasets, selectedDataset?.id])

  const toggleFeatureSelection = (column) => {
    setSelectedFeatures(prev =>
      prev.includes(column) ? prev.filter(f => f !== column) : [...prev, column]
    )
  }

  const handleTrainModel = async () => {
    if (!selectedAlgorithm || !targetVariable || !selectedDataset || selectedFeatures.length === 0) return
    setIsTraining(true)
    setModelResult(null)
    setError(null)

    try {
      const queryParams = new URLSearchParams({
        target_variable: targetVariable,
      })
      queryParams.append('file_id', String(selectedDataset.id))
      selectedFeatures.forEach(feature => queryParams.append('feature_variables', feature))

      const response = await fetch(`${BASE_URL}/machine-learning/${selectedAlgorithm.api}?${queryParams.toString()}`)
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Model training failed: ${response.status} ${response.statusText}. Server says: ${errorText}`)
      }
      const result = await response.json()
      setModelResult(result)
    } catch (err) {
      setError(err.message)
      console.error('Training failed:', err)
    } finally {
      setIsTraining(false)
    }
  }

  const isStep2Enabled = selectedDataset !== null
  const isStep3Enabled = isStep2Enabled && selectedFeatures.length > 0 && targetVariable !== ''
  const isRunEnabled = isStep3Enabled && selectedAlgorithm !== null

  return (
    <div className="min-h-screen text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center my-12">
          <BrainLogo className="mx-auto h-16 w-16 text-sky-400 mb-4 [filter:drop-shadow(0_0_12px_rgba(56,189,248,.45))]" />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight">
            ML Model Playground
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-slate-400">
            Train models on your datasets. Follow the steps below.
          </p>
        </header>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-4 rounded-lg mb-8 text-center">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="space-y-8">
          <StepCard number={1} title="Select a Dataset" icon={<DatabaseIcon className="w-6 h-6" />} isEnabled={true}>
            {loadingDatasets ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 rounded-lg bg-slate-800/60 border border-slate-700 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {datasets.map(dataset => (
                  <button
                    key={dataset.id}
                    type="button"
                    onClick={() => handleDatasetSelect(dataset.id)}
                    className={`text-left p-4 border-2 rounded-lg transition-all duration-200 transform
                        ${selectedDataset?.id === dataset.id
                        ? 'bg-sky-500/10 border-sky-400/70 shadow-lg shadow-sky-500/20 ring-1 ring-sky-300/40 -translate-y-0.5'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50'
                      }`}
                  >
                    <h3 className="font-bold text-white">{dataset.file_name}</h3>
                    <p className="text-sm text-slate-400">ID: {dataset.id}</p>
                  </button>
                ))}
              </div>
            )}
          </StepCard>

          <StepCard number={2} title="Configure Features & Target" icon={<SlidersIcon className="w-6 h-6" />} isEnabled={isStep2Enabled}>
            <div className="space-y-6">
              <div>
                <label htmlFor="target-variable" className="block font-semibold text-slate-300 mb-2">
                  Target Variable
                </label>
                <select
                  id="target-variable"
                  value={targetVariable}
                  onChange={e => setTargetVariable(e.target.value)}
                  className="w-full md:w-1/2 p-2 border border-slate-600 rounded-md bg-slate-800 text-white
                             focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="">Select Target...</option>
                  {selectedDataset?.columns?.filter(c => !selectedFeatures.includes(c)).map(column => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="font-semibold text-slate-300 mb-3">Feature Variables</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedDataset?.columns?.filter(c => c !== targetVariable).map(column => (
                    <button
                      key={column}
                      onClick={() => toggleFeatureSelection(column)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 transform border
                        ${selectedFeatures.includes(column)
                          ? 'bg-fuchsia-500/10 text-fuchsia-200 border-fuchsia-400/70 ring-1 ring-fuchsia-300/40 shadow-[0_0_24px_rgba(217,70,239,0.35)] -translate-y-0.5'
                          : 'bg-slate-700/40 text-slate-300 border-slate-600 hover:bg-slate-700/60 hover:border-slate-500'
                        }`}
                    >
                      {column}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StepCard>

          <StepCard number={3} title="Select an Algorithm" icon={<AtomIcon className="w-6 h-6" />} isEnabled={isStep3Enabled}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mlAlgorithms.map(algo => (
                <button
                  key={algo.id}
                  type="button"
                  onClick={() => setSelectedAlgorithm(algo)}
                  className={`p-4 border-2 rounded-lg transition-all duration-200 transform flex flex-col items-center text-center
                    ${selectedAlgorithm?.id === algo.id
                      ? 'bg-emerald-500/10 border-emerald-400/70 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-300/40 -translate-y-0.5 '
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50'
                    }`}
                >
                  {algo.type === 'Regression'
                    ? <ChartLineIcon className="w-8 h-8 mb-2 text-emerald-400" />
                    : <ClassifierIcon className="w-8 h-8 mb-2 text-emerald-400" />}
                  <h3 className="font-bold text-white">{algo.name}</h3>
                  <p className="text-sm text-slate-400">{algo.type}</p>
                </button>
              ))}
            </div>
          </StepCard>
        </div>

        <div className="my-12 flex justify-center">
          <button
            onClick={handleTrainModel}
            disabled={!isRunEnabled || isTraining}
            className="px-8 py-4 rounded-lg text-white font-bold text-lg
                       bg-gradient-to-r from-sky-500 to-emerald-500
                       hover:from-sky-600 hover:to-emerald-600
                       disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400
                       disabled:cursor-not-allowed transition-all duration-300
                       transform hover:scale-105 flex items-center gap-3"
          >
            {isTraining && <LoaderIcon className="animate-spin h-5 w-5" />}
            <span>{isTraining ? 'Training Model...' : 'Run Model'}</span>
          </button>
        </div>

        {(isTraining || modelResult) && (
          <section className="mt-12">
            {isTraining && (
              <div className="flex flex-col items-center justify-center gap-4 p-12 bg-slate-800/50 rounded-2xl border border-slate-700">
                <LoaderIcon className="w-12 h-12 text-sky-400 animate-spin" />
                <p className="text-xl text-slate-300">Training in progress, please wait...</p>
              </div>
            )}
            {modelResult && selectedAlgorithm && (
              <ModelResultsCard results={modelResult} algorithmName={selectedAlgorithm.name} />
            )}
          </section>
        )}
      </div>
    </div>
  )
}
