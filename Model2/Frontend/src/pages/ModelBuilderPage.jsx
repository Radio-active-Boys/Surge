// src/pages/ModelBuilderPage.jsx
import { useState, useEffect } from 'react';
import ParametricEditor from '../components/model-builder/ParametricEditor';
import ModelViewer from '../components/visualization/ModelViewer';
import { useModelStore } from '../stores/useModelStore';
import './ModelBuilderPage.css';

const ModelBuilderPage = () => {
  // Initialize local state from the store's current snapshot
  const [modelJson, setModelJson] = useState(
    useModelStore.getState().toJson()
  );

  useEffect(() => {
    // Subscribe to all changes in the store
    const unsubscribe = useModelStore.subscribe(
      // On any change, re-serialize the JSON
      () => setModelJson(useModelStore.getState().toJson())
    );

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  const [activeTab, setActiveTab] = useState('model');

  const renderEditor = () => {
    switch (activeTab) {
      case 'model':
        return <ParametricEditor category="model" />;
      case 'nodes':
        return <ParametricEditor category="node" />;
      case 'supports':
        return <ParametricEditor category="boundryConditions" />;
      case 'materials':
        return <ParametricEditor category="uniaxialMaterial" />;
      case 'sections':
        return <ParametricEditor category="section" />;
      case 'timeSeries':
        return <ParametricEditor category="timeSeries" />;
      case 'pattern':
        return <ParametricEditor category="pattern" />;
      case 'elements':
        return <ParametricEditor category="element" />;
      case 'integrations':
        return <ParametricEditor category="beamIntegration" />;
      case 'transformations':
        return <ParametricEditor category="geomTransf" />;
      default:
        return null;
    }
  };

  return (
    <div className="model-builder">
      <div className="editors-panel">
        <div className="tabs">
          {[
            'model',
            'nodes',
            'supports',
            'materials',
            'sections',
            'transformations',
            'integrations',
            'elements',
            'timeSeries',
            'pattern'
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

        <div className="editor-container">{renderEditor()}</div>
      </div>
      

      <div className="visualization-panel">
        <ModelViewer />
        
      </div>
    </div>
  );
};

export default ModelBuilderPage;
