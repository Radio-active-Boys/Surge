// src/pages/ResultsPage.jsx
import React from 'react';
import { useResultStore } from '../stores/useResultStore';
import ResultsVisualizer from '../components/analysis/ResultsVisualizer';
import ResultsPlotter from '../components/results/ResultsPlotter';
const ResultsPage = () => {
  const status = useResultStore((state) => state.status);
  const errors = useResultStore((state) => state.errors);
  const warnings = useResultStore((state) => state.warnings);
  const fullResults = useResultStore((state) => state.fullResults);

  if (!status) {
    return <p>No results available. Please run an analysis first.</p>;
  }

  return (
    <div>
      <h1>Analysis Results</h1>
      {status !== 'success' && errors.length > 0 && (
        <div className="error-section">
          <h2>Errors</h2>
          <ul>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {warnings && warnings.length > 0 && (
        <div className="warning-section">
          <h2>Warnings</h2>
          <ul>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      {status === 'success' && fullResults && (
        <>
        <ResultsVisualizer results={fullResults} />
        </>
      )}
      <ResultsPlotter />
    </div>
  );
};

export default ResultsPage;
