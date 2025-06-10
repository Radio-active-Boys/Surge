import React, { useState, useMemo } from 'react';
import AnalysisMonitor from './AnalysisMonitor';
import './ResultsVisualizer.css';

const ResultsVisualizer = ({ results }) => {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [selectedRecorder, setSelectedRecorder] = useState(null);

  if (!results) return null;

  // Parse recorder data for better display
  const parsedRecorders = useMemo(() => {
    if (!results.recorders) return [];
    
    return Object.entries(results.recorders).map(([filename, recorder]) => {
      try {
        // Try to parse numerical data
        const parsedData = recorder.data.map(line => {
          const values = line.trim().split(/\s+/);
          return values.map(val => {
            const num = parseFloat(val);
            return isNaN(num) ? val : num;
          });
        });
        
        return {
          filename,
          type: recorder.type,
          data: parsedData,
          raw: recorder.data,
          isNumeric: parsedData.every(row => 
            row.every(val => typeof val === 'number'))
        };
      } catch {
        return {
          filename,
          type: recorder.type,
          data: recorder.data,
          raw: recorder.data,
          isNumeric: false
        };
      }
    });
  }, [results.recorders]);

  const renderRecorderTable = (recorder) => {
    if (!recorder.data || recorder.data.length === 0) {
      return <div className="no-recorder-data">No data available</div>;
    }
    
    if (recorder.isNumeric && recorder.data[0].length > 1) {
      return (
        <div className="recorder-table-container">
          <table className="recorder-table">
            <thead>
              <tr>
                {recorder.data[0].map((_, colIndex) => (
                  <th key={colIndex}>
                    Col {colIndex + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recorder.data.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'even-row' : 'odd-row'}>
                  {row.map((value, colIndex) => (
                    <td key={colIndex}>
                      {typeof value === 'number' ? value.toFixed(6) : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    return (
      <div className="raw-recorder-data">
        <pre>
          {recorder.raw.join('\n')}
        </pre>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'monitoring':
        return <AnalysisMonitor data={results.monitoring} />;
      
      case 'recorders':
        return (
          <div className="recorders-container">
            <h2 className="section-title">Recorder Outputs</h2>
            
            {parsedRecorders.length === 0 ? (
              <div className="no-recorders">No recorder data available</div>
            ) : (
              <div className="recorders-grid">
                {/* Recorder list */}
                <div className="recorders-list">
                  <div className="recorders-list-container">
                    <h3 className="list-title">Available Recorders</h3>
                    <ul>
                      {parsedRecorders.map((recorder, index) => (
                        <li key={index}>
                          <button
                            onClick={() => setSelectedRecorder(recorder)}
                            className={`recorder-item ${selectedRecorder?.filename === recorder.filename ? 'selected' : ''}`}
                          >
                            <div className="recorder-filename">{recorder.filename}</div>
                            <div className="recorder-type">{recorder.type}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {/* Recorder details */}
                <div className="recorder-details">
                  {selectedRecorder ? (
                    <div className="recorder-detail-container">
                      <div className="recorder-header">
                        <h3 className="recorder-title">
                          {selectedRecorder.filename}
                          <span className="recorder-type-label">
                            {selectedRecorder.type}
                          </span>
                        </h3>
                        <button 
                          onClick={() => setSelectedRecorder(null)}
                          className="close-button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      
                      {renderRecorderTable(selectedRecorder)}
                    </div>
                  ) : (
                    <div className="recorder-placeholder">
                      <div className="placeholder-content">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3>No recorder selected</h3>
                        <p>
                          Select a recorder from the list to view its data
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      
      case 'model':
        return (
          <div className="model-container">
            <h2 className="section-title">Final Model State</h2>
            
            {results.model ? (
              <div className="model-state-viewer">
                <pre>
                  {JSON.stringify(results.model, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="no-model-data">No model state data available</div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="results-container">
      <div className="tabs">
        {['monitoring', 'recorders', 'model'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ResultsVisualizer;