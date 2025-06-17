// src/components/results/ResultsPlotter.jsx
import React from 'react';
import { useResultStore } from '../../stores/useResultStore';
import TrussVisualizer from '../visualization/TrussVisualizer';
import Model from '../visualization/Model';
import DeflectedShape from '../visualization/DeflectedShape';

const ResultsPlotter = () => {
  const hasResults = useResultStore(state => !!state.fullResults);

  if (!hasResults) {
    return (
      <div className="no-results">
        <div className="placeholder">
          <h3>No Analysis Results Available</h3>
          <p>Run an analysis to view structural visualization</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* <TrussVisualizer /> */}
      <Model />
      <DeflectedShape />
    </>
  );
};

export default ResultsPlotter;
