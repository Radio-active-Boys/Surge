// src/pages/ModelBuilderPage.jsx
import { useState, useEffect } from 'react';
import ParametricEditor from '../components/model-builder/ParametricEditor';
import ModelViewer from '../components/visualization/ModelViewer';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import JsonTogglePanel from '../components/common/Panel';
import './AnalysisPage.css';

const ResultsPage = () => {
  // Initialize local state from the store's current snapshot
  const [modelJson, setModelJson] = useState(
    useAnalysisStore.getState().toJson()
  );

  useEffect(() => {
    // Subscribe to all changes in the store
    const unsubscribe = useAnalysisStore.subscribe(
      // On any change, re-serialize the JSON
      () => setModelJson(useAnalysisStore.getState().toJson())
    );

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  const [activeTab, setActiveTab] = useState('constraints');

  const renderEditor = () => {
    switch (activeTab) {
      case 'constraints':
        return <ParametricEditor category="constraints" />;
      case 'numberer':
        return <ParametricEditor category="numberer" />;
      case 'system':
        return <ParametricEditor category="system" />;
      case 'algorithm':
        return <ParametricEditor category="algorithm" />;
      case 'integrator':
        return <ParametricEditor category="integrator" />;
      case 'analysis':
        return <ParametricEditor category="analysis" />;
      case 'analyze':
        return <ParametricEditor category="analyze" />;
      default:
        return null;
    }
  };

  return (
    <div className="model-builder">
      <div className="editors-panel">
        <div className="tabs">
          {[
            'constraints',
            'numberer',
            'system',
            'algorithm',
            'integrator',
            'analysis',
            'analyze' 
          ].map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <JsonTogglePanel />
        <div className="editor-container">{renderEditor()}</div>
      </div>
      

      <div className="visualization-panel">
        <ModelViewer />
        
      </div>
    </div>
  );
};

export default ResultsPage;
