// src/pages/AnalysisPage.jsx

// src/pages/AnalysisPage.jsx
import React, { useState, useEffect } from 'react';
import AnalysisEditor from '../components/analysis/AnalysisEditor';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import AnalysisConfig from '../components/analysis/AnalysisConfig';
import { useModelStore } from '../stores/useModelStore';
import { useUserTypeStore } from '../utils/storeUserType';
import './AnalysisPage.css';

const AnalysisPage = () => {
  const initializeDefaultRecorders = useAnalysisStore(state => state.initializeDefaultRecorders);
  // Get model node/element arrays and ndf from model store
  const modelNodes = useModelStore(state => state.node);
  const modelElements = useModelStore(state => state.element);
  const ndf = useModelStore(state => state.modelConfig.ndf); // CHANGED: subscribe to ndf
  const initializeDefaults = useModelStore(s => s.initializeDefaults);
  const status = useUserTypeStore(s => s.status);

    useEffect(() => {
      initializeDefaults();
    }, [status, initializeDefaults]);

  useEffect(() => {
    // Extract node IDs and element IDs
    const nodeIds = (modelNodes || []).map(n => n.args[0]);
    // CHANGED: build dofs array up to ndf
    const dofs = Array.from({ length: ndf || 1 }, (_, i) => i + 1);
    const eleIds = (modelElements || []).map(e => e.args[1]);
    initializeDefaultRecorders({ nodeIds, dofs, eleIds });
  }, [
    modelNodes,
    modelElements,
    ndf, // CHANGED: re-run when ndf changes
    initializeDefaultRecorders
  ]);

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
    'analyze',   // CHANGED: remains, but handled specially in editor
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
