'use client';
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2'; // npm install react-chartjs-2 chart.js
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip);

export default function AnalysisPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/machine-learning/asthma-arthimetic-mean')
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error('Failed to fetch:', err));
  }, []);

  if (!data) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-6 bg-slate-800/50 rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-700 backdrop-blur-sm">
      <h1 className="text-4xl md:text-4xl font-extrabold mb-6 text-white tracking-tight">Asthma Arithmetic Mean Analysis (2015–2022)</h1>

      {Object.entries(data.county_year_means).map(([gas, records]) => (
        <div key={gas} className="mb-12 border-t pt-6">
          <h2 className="text-2xl font-semibold mb-4">{gas.toUpperCase()}</h2>

          {/* Chart */}
          <GasChart records={records} />

          {/* CLI-style Summary */}
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Text Summary</h3>
            <pre className="bg-slate-800/50 rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-700 backdrop-blur-sm font-bold text-lg">
              {formatSummaryText(data.yearly_stats[gas], gas)}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}

// Bar chart grouped by year
function GasChart({ records }) {
  const counties = [...new Set(records.map((r) => r['County Name']))];
  const years = [...new Set(records.map((r) => r['Year']))].sort();

  const datasets = years.map((year) => ({
    label: `${year}`,
    data: counties.map((county) => {
      const record = records.find(
        (r) => r['County Name'] === county && r['Year'] === year
      );
      return record ? record.Mean : null;
    }),
    backgroundColor: getColor(year),
  }));

  const chartData = {
    labels: counties,
    datasets,
  };

  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
          title: {
            display: true,
            text: 'Average Arithmetic Mean by County',
          },
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 90,
              minRotation: 45,
              autoSkip: false,
            },
          },
        },
      }}
    />
  );
}

// Helper: static color list per year
function getColor(year) {
  const colors = [
    '#1f77b4', '#ff7f0e', '#2ca02c',
    '#d62728', '#9467bd', '#8c564b',
    '#e377c2', '#7f7f7f'
  ];
  return colors[year % colors.length];
}

// Helper: format JSON table into CLI-style text
function formatSummaryText(statsArray, gas) {
  if (!statsArray || statsArray.length === 0) return '';

  const columns = Object.keys(statsArray[0]);

  const header = columns.map((col) => col.padEnd(18)).join('');
  const rows = statsArray
    .map((row) =>
      columns.map((col) => {const val = row[col];
        if (typeof val === 'number'){
          if (col.toLowerCase() === 'year') {
            return String(val).padEnd(18);
          }
          return val.toFixed(2).padEnd(18);
        }
        return String(val).padEnd(18);
      }).join('')
    ).join('\n')

  return `Yearly summary stats for ${gas.toUpperCase()}:\n\n${header}\n${rows}`;
}