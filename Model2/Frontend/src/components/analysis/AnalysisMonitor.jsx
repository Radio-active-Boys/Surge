import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import './AnalysisMonitor.css';

const AnalysisMonitor = ({ data }) => {
  const [selectedSeries, setSelectedSeries] = useState([]);
  
  // Transform monitoring data for charting
  const chartData = useMemo(() => {
    if (!data || !data.time_history) return [];
    
    return data.time_history.map(point => {
      const chartPoint = { time: point.time.toFixed(4) };
      
      // Process all data points
      Object.entries(point).forEach(([key, value]) => {
        if (key === 'time') return;
        
        if (key.startsWith('node_') && value.disp) {
          chartPoint[`${key}_dispX`] = value.disp[0] || 0;
          chartPoint[`${key}_dispY`] = value.disp[1] || 0;
          chartPoint[`${key}_dispZ`] = value.disp[2] || 0;
        }
        
        if (key.startsWith('ele_')) {
          if (value.forces) {
            value.forces.forEach((force, i) => {
              chartPoint[`${key}_force${i}`] = force || 0;
            });
          }
          if (value.deformation) {
            value.deformation.forEach((def, i) => {
              chartPoint[`${key}_def${i}`] = def || 0;
            });
          }
        }
      });
      
      return chartPoint;
    });
  }, [data]);

  // Extract all series keys
  const allSeries = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter(key => key !== 'time');
  }, [chartData]);

  // Initialize selected series with first 3 series
  useMemo(() => {
    if (allSeries.length > 0 && selectedSeries.length === 0) {
      setSelectedSeries(allSeries.slice(0, Math.min(3, allSeries.length)));
    }
  }, [allSeries, selectedSeries]);

  if (!data || !data.time_history || data.time_history.length === 0) {
    return (
      <div className="no-data-message">
        <div className="no-data-content">
          <svg xmlns="http://www.w3.org/2000/svg" className="no-data-icon" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No monitoring data available
        </div>
      </div>
    );
  }

  // Color palette for chart lines
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
  ];

  return (
    <div className="monitor-container">
      <h2 className="monitor-title">Analysis Progress Monitoring</h2>
      
      {/* Series selector */}
      <div className="series-selector">
        <label className="selector-label">
          Select Data Series:
        </label>
        <div className="series-buttons">
          {allSeries.map((series, index) => (
            <button
              key={series}
              onClick={() => {
                if (selectedSeries.includes(series)) {
                  setSelectedSeries(selectedSeries.filter(s => s !== series));
                } else {
                  setSelectedSeries([...selectedSeries, series]);
                }
              }}
              className={`series-button ${selectedSeries.includes(series) ? 'selected' : ''}`}
            >
              {series}
            </button>
          ))}
        </div>
      </div>
      
      {/* Chart */}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis 
              dataKey="time" 
              label={{ 
                value: 'Time', 
                position: 'insideBottomRight', 
                offset: -5 
              }} 
            />
            <YAxis 
              label={{ 
                value: 'Value', 
                angle: -90, 
                position: 'insideLeft' 
              }} 
            />
            <Tooltip 
              formatter={(value) => [value.toFixed(6), 'Value']}
              labelFormatter={(value) => `Time: ${value}`}
              contentStyle={{ 
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
            />
            <Legend />
            {selectedSeries.map((series, index) => (
              <Line 
                key={series}
                name={series}
                type="monotone"
                dataKey={series}
                stroke={colors[index % colors.length]}
                activeDot={{ r: 6 }}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalysisMonitor;