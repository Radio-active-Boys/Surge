import React, { useState } from 'react';
import './ResultsPage.css';
import { useResultStore } from '../stores/useResultStore';
import ResultsPlotter from '../components/results/ResultsPlotter';

const ResultsPage = () => {
  const [activeView, setActiveView] = useState('results');
  const status = useResultStore((state) => state.status);
  const errors = useResultStore((state) => state.errors);
  const warnings = useResultStore((state) => state.warnings);
  const fullResults = useResultStore((state) => state.fullResults);

  if (!status) {
    return <p>No results available. Please run an analysis first.</p>;
  }

  return (
    <div className="results-container">
      <div className="tabs">
        <button
          className={`tab ${activeView === 'results' ? 'active' : ''}`}
          onClick={() => setActiveView('results')}
        >
          Results
        </button>
        <button
          className={`tab ${activeView === 'model' ? 'active' : ''}`}
          onClick={() => setActiveView('model')}
        >
          Model
        </button>
        <button
          className={`tab ${activeView === 'deflected' ? 'active' : ''}`}
          onClick={() => setActiveView('deflected')}
        >
          Deflected Shape
        </button>
        <button
          className={`tab ${activeView === 'section' ? 'active' : ''}`}
          onClick={() => setActiveView('section')}
        >
          Section Forces
        </button>
        <button
          className={`tab ${activeView === 'reaction' ? 'active' : ''}`}
          onClick={() => setActiveView('reaction')}
        >
          Reaction Forces
        </button>
      </div>

      <div className="tab-content">
        {status !== 'success' && errors.length > 0 && (
          <div className="error-section">
            <h2 className="section-title">Errors</h2>
            <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        {warnings && warnings.length > 0 && (
          <div className="warning-section">
            <h2 className="section-title">Warnings</h2>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        {status === 'success' && fullResults && (
          <ResultsPlotter view={activeView} results={fullResults} />
        )}
      </div>
    </div>
  );
};

export default ResultsPage;
