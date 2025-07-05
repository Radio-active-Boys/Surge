// src/pages/AnalysisPageLite.jsx

import React, { useState, useEffect } from 'react';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import AnalysisConfig from '../components/analysis/AnalysisConfig';
import { useModelStore } from '../stores/useModelStore';
import './AnalysisPage.css';
import { useUserTypeStore } from '../utils/storeUserType';
const AnalysisPage = () => {
  const initializeDefaultRecorders = useAnalysisStore(state => state.initializeDefaultRecorders);
  // Get model node/element arrays and ndf from model store
  const modelNodes = useModelStore(state => state.node);
  const modelElements = useModelStore(state => state.element);
  const ndf = useModelStore(state => state.modelConfig.ndf); // CHANGED: subscribe to ndf
  const status = useUserTypeStore(state => state.status);
  const initializeDefaults = useModelStore(s => s.initializeDefaults);

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


  return (
    <div className="model-builder">
      <div className="analysis-panel">
        <AnalysisConfig />
      </div>
    </div>
  );
};

export default AnalysisPage;
