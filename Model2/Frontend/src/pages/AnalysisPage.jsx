// src/pages/ModelBuilderPage.jsx
import { useState, useEffect } from 'react';
import AnalysisEditor from '../components/analysis/AnalysisEditor';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import AnalysisConfig from '../components/analysis/AnalysisConfig';
import './AnalysisPage.css';

const AnalysisPage = () => {
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
        return <AnalysisEditor category="constraints" />;
      case 'numberer':
        return <AnalysisEditor category="numberer" />;
      case 'system':
        return <AnalysisEditor category="system" />;
      case 'algorithm':
        return <AnalysisEditor category="algorithm" />;
      case 'integrator':
        return <AnalysisEditor category="integrator" />;
      case 'analysis':
        return <AnalysisEditor category="analysis" />;
      case 'analyze':
        return <AnalysisEditor category="analyze" />;
      case 'recorder':
        return <AnalysisEditor category="recorder" />;
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
            'analyze',
            'recorder',
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
        <div className="analysis-container">{renderEditor()}</div>
      </div>

      <div className="analysis-panel">
        <AnalysisConfig />
      </div>
    </div>
  );
};

export default AnalysisPage;
