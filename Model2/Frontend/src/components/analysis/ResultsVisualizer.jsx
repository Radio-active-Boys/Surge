import React, { useState, useMemo } from 'react';
import AnalysisMonitor from './AnalysisMonitor';
import { usePlotParser } from '../../utils/plotParser';
import './ResultsVisualizer.css';

const ResultsVisualizer = ({ results }) => {
  const [activeTab, setActiveTab] = useState('recorders');
  const [selectedRecorder, setSelectedRecorder] = useState(null);
  const [selectedModelTab, setSelectedModelTab] = useState('elements');
  const { ndf } = usePlotParser();

  if (!results) return null;

  const parsedRecorders = useMemo(() => {
    if (!results.recorders) return [];
    return Object.entries(results.recorders).map(([filename, recorder]) => {
      try {
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
          columns: recorder.columns || [],
          data: parsedData,
          raw: recorder.data,
          isNumeric: parsedData.every(row => row.every(val => typeof val === 'number'))
        };
      } catch {
        return {
          filename,
          type: recorder.type,
          columns: recorder.columns || [],
          data: recorder.data,
          raw: recorder.data,
          isNumeric: false
        };
      }
    });
  }, [results.recorders]);

  const renderElementsTable = (elements, ndf) => {
    if (!elements || Object.keys(elements).length === 0) return <div>No element data</div>;

    return (
      <div className="table-scroll-container">
        <table className="recorder-table">
          <thead>
            <tr>
              <th>Element</th>
              {[...Array(ndf)].map((_, i) => <th key={`i-${i}`}>i-End {['N', 'V', 'M'][i] || `F${i}`}</th>)}
              {[...Array(ndf)].map((_, i) => <th key={`j-${i}`}>j-End {['N', 'V', 'M'][i] || `F${i}`}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.entries(elements).map(([eleId, eleData], idx) => (
              <tr key={eleId} className={idx % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{eleId}</td>
                {eleData.forces.slice(0, ndf).map((val, i) => (
                  <td key={`i-${i}`}>{val.toFixed(4)}</td>
                ))}
                {eleData.forces.slice(ndf, 2 * ndf).map((val, i) => (
                  <td key={`j-${i}`}>{val.toFixed(4)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderNodesTable = (nodes, ndf) => {
    if (!nodes || Object.keys(nodes).length === 0) return <div>No node data</div>;

    return (
      <div className="table-scroll-container">
        <table className="recorder-table">
          <thead>
            <tr>
              <th>Node</th>
              {[...Array(ndf)].map((_, i) => <th key={`disp-${i}`}>Disp {i + 1}</th>)}
              {[...Array(ndf)].map((_, i) => <th key={`vel-${i}`}>Vel {i + 1}</th>)}
              {[...Array(ndf)].map((_, i) => <th key={`accel-${i}`}>Accel {i + 1}</th>)}
              {[...Array(ndf)].map((_, i) => <th key={`reaction-${i}`}>Reaction {i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.entries(nodes).map(([nodeId, nodeData], idx) => (
              <tr key={nodeId} className={idx % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{nodeId}</td>
                {nodeData.final_disp.map((val, i) => <td key={`d-${i}`}>{val.toFixed(6)}</td>)}
                {nodeData.final_vel.map((val, i) => <td key={`v-${i}`}>{val.toFixed(6)}</td>)}
                {nodeData.final_accel.map((val, i) => <td key={`a-${i}`}>{val.toFixed(6)}</td>)}
                {nodeData.final_reaction.map((val, i) => <td key={`r-${i}`}>{val.toFixed(6)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRecorderTable = (recorder) => {
    if (!recorder.data || recorder.data.length === 0) {
      return <div className="no-recorder-data">No data available</div>;
    }

    if (recorder.isNumeric) {
      return (
        <div className="recorder-table-container">
          <table className="recorder-table">
            <thead>
              <tr>
                {recorder.columns.map((col, idx) => (
                  <th key={idx}>{col}</th>
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
        <pre>{recorder.raw.join('\n')}</pre>
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
                <div className="recorders-list">
                  <div className="recorders-list-container">
                    <ul>
                      {parsedRecorders.map((recorder, index) => (
                        <li key={index}>
                          <button
                            onClick={() => setSelectedRecorder(recorder)}
                            className={`recorder-item ${selectedRecorder?.filename === recorder.filename ? 'selected' : ''}`}>
                            <div className="recorder-filename">{recorder.filename}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="recorder-details">
                  {selectedRecorder ? (
                    <div className="recorder-detail-container">
                      <div className="recorder-header">
                        <h3 className="recorder-title">
                          <span className="recorder-type-label">
                             {selectedRecorder.filename}
                          </span>
                          <span className="recorder-type-label">
                            {selectedRecorder.type}
                          </span>
                        </h3>
                        <button onClick={() => setSelectedRecorder(null)} className="close-button">
                          ✕
                        </button>
                      </div>
                      {renderRecorderTable(selectedRecorder)}
                    </div>
                  ) : (
                    <div className="recorder-placeholder">
                      <div className="placeholder-content">
                        <h3>No recorder selected</h3>
                        <p>Select a recorder from the list to view its data</p>
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
            <h2 className="section-title">Model State Data</h2>
            {results.model ? (
              <div className="model-tab-layout">
                <div className="model-tab-sidebar">
                  <button
                    className={`model-tab-btn ${selectedModelTab === 'elements' ? 'active' : ''}`}
                    onClick={() => setSelectedModelTab('elements')}
                  >
                    Elements
                  </button>
                  <button
                    className={`model-tab-btn ${selectedModelTab === 'nodes' ? 'active' : ''}`}
                    onClick={() => setSelectedModelTab('nodes')}
                  >
                    Nodes
                  </button>
                </div>
                <div className="model-tab-content">
                  {selectedModelTab === 'elements'
                    ? renderElementsTable(results.model.elements, ndf)
                    : renderNodesTable(results.model.nodes, ndf)}
                </div>
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
        {[ 'recorders', 'model'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
};

export default ResultsVisualizer;