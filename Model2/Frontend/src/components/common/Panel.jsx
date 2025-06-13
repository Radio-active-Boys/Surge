 // src/components/common/Panel.jsx
import { useState, useEffect } from 'react';
import CommandPreview from './CommandPreview';
import JsonEditor from './JsonEditor';
import { useModelStore } from '../../stores/useModelStore';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import './Panel.css';

const panelConfig = [
  {
    key: 'commandPreview',
    label: 'Command',
    component: (combinedJson) => <CommandPreview json={combinedJson} />,
  },
  {
    key: 'jsonEditor',
    label: 'Editor',
    component: () => <JsonEditor />,
  },
];

const JsonTogglePanel = () => {
  const [modelJson, setModelJson] = useState(useModelStore.getState().toJson());
  const [analysisJson, setAnalysisJson] = useState(useAnalysisStore.getState().toJson());
  const [activePanel, setActivePanel] = useState(null);

  useEffect(() => {
    const unsubModel = useModelStore.subscribe(() => {
      setModelJson(useModelStore.getState().toJson());
    });
    const unsubAnalysis = useAnalysisStore.subscribe(() => {
      setAnalysisJson(useAnalysisStore.getState().toJson());
    });

    return () => {
      unsubModel();
      unsubAnalysis();
    };
  }, []);

  const togglePanel = (key) => {
    setActivePanel(prev => (prev === key ? null : key));
  };

  const combinedJson = {
    ...modelJson,
    ...analysisJson,
  };

  return (
    <div className="panel-wrapper">
      <div className="panel-buttons">
        {panelConfig.map(panel => (
          <button
            key={panel.key}
            onClick={() => togglePanel(panel.key)}
            className={`panel-toggle-btn ${activePanel === panel.key ? 'active' : ''}`}
          >
            {activePanel === panel.key ? 'Hide' : 'View'} {panel.label}
          </button>
        ))}
      </div>

      <div className="panel-content">
        {panelConfig.map(panel => (
          activePanel === panel.key && (
            <div key={panel.key} className="panel-box">
              <button className="panel-close-btn" onClick={() => togglePanel(panel.key)}>×</button>
              {panel.component(combinedJson)}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default JsonTogglePanel;
