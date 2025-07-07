// src/pages/ModelBuilderPage.jsx
import { useState, useEffect } from 'react';
import ParametricEditorLite from '../components/model-builder/ParametricEditorLite';
import PatternEditorLite from '../components/model-builder/PatternEditorLite';
import SectionEditor from '../components/model-builder/SectionEditor';
import ModelViewer from '../components/visualization/ModelViewer';
import { useUserTypeStore } from '../utils/storeUserType';
import { useModelStore } from '../stores/useModelStore';
import './ModelBuilderPage.css';

const ModelBuilderPageLite = () => {
  const [modelJson, setModelJson] = useState(useModelStore.getState().toJson());
  const initializeDefaults = useModelStore(s => s.initializeDefaults);
  const status = useUserTypeStore(s => s.status);

  useEffect(() => {
    initializeDefaults();
  }, [status, initializeDefaults]);

  useEffect(() => {
    const unsubscribe = useModelStore.subscribe(() => 
      setModelJson(useModelStore.getState().toJson())
    );
    return unsubscribe;
  }, []);

  const [activeTab, setActiveTab] = useState('model');

  const renderEditor = () => {
    switch (activeTab) {
      case 'model':
        return <ParametricEditorLite category="modelLite" />;
      case 'nodes':
        return <ParametricEditorLite category="nodeLite" />;
      case 'supports':
        return <ParametricEditorLite category="boundaryConditionsLite" />;
      case 'materials':
        return <ParametricEditorLite category="uniaxialMaterialLite" />;
      case 'sections':
        return <SectionEditor />;
      case 'timeSeries':
        return <ParametricEditorLite category="timeSeriesLite" />;
      case 'pattern':
        return <PatternEditorLite />;
      case 'elements':
        return <ParametricEditorLite category="elementLite" />;
      case 'integrations':
        return <ParametricEditorLite category="beamIntegrationLite" />;
      case 'transformations':
        return <ParametricEditorLite category="geomTransfLite" />;
      default:
        return null;
    }
  };

  return (
    <div className="model-builder">
      <div className="model-editors-panel">
        <div className="tabs">
          {[
            'model',
            'nodes',
            'supports',
            'materials',
            // 'sections',
            // 'transformations',
            // 'integrations',
            'elements',
            // 'timeSeries',
            'pattern'
          ].map(tab => (
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

export default ModelBuilderPageLite;
