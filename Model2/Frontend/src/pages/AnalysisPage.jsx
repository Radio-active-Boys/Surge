// src/pages/AnalysisPage.jsx

import React, { useState, useEffect } from 'react';
import AnalysisEditor from '../components/analysis/AnalysisEditor';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import AnalysisConfig from '../components/analysis/AnalysisConfig';
import { useModelStore } from '../stores/useModelStore';
import './AnalysisPage.css';

const AnalysisPage = () => {
  const initializeDefaultRecorders = useAnalysisStore(state => state.initializeDefaultRecorders);
  // Get model node/element arrays from model store
  const modelNodes = useModelStore(state => state.node);
  const modelElements = useModelStore(state => state.element);

  useEffect(() => {
    // Extract node IDs and element IDs
    const nodeIds = (modelNodes || []).map(n => n.args[0]);
    const dofs = [1, 2]; // adjust if your model supports other DOFs
    const eleIds = (modelElements || []).map(e => e.args[0]);
    initializeDefaultRecorders({ nodeIds, dofs, eleIds });
  }, [modelNodes, modelElements, initializeDefaultRecorders]);

  // Subscribe to JSON for display
  const [analysisJson, setAnalysisJson] = useState(useAnalysisStore.getState().toJson());
  useEffect(() => {
    const unsub = useAnalysisStore.subscribe(() => {
      setAnalysisJson(useAnalysisStore.getState().toJson());
    });
    return unsub;
  }, []);

  const tabs = [
    'constraints',
    'numberer',
    'system',
    'algorithm',
    'integrator',
    'analysis',
    'analyze',
    'recorder'
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="model-builder">
      <div className="editors-panel">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="analysis-container">
          <AnalysisEditor category={activeTab} />
        </div>
      </div>

      <div className="analysis-panel">
        <AnalysisConfig />
      </div>
    </div>
  );
};

export default AnalysisPage;
