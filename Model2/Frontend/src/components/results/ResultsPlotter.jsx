// src/components/results/ResultsPlotter.jsx
import React from 'react';
import ResultsVisualizer from '../analysis/ResultsVisualizer';
import Model from '../visualization/Model';
import DeflectedShape from '../visualization/DeflectedShape2';
import SectionForce from '../visualization/SectionForce';

const ResultsPlotter = ({ view, results }) => {
  switch (view) {
    case 'results':
      return <ResultsVisualizer results={results} />;
    case 'model':
      return <Model />;
    case 'deflected':
      return <DeflectedShape />;
    case 'section':
      return <SectionForce />;
    default:
      return null;
  }
};

export default ResultsPlotter;
