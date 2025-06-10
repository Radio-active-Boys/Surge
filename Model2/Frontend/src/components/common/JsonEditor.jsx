// src/components/editor/JsonEditor.jsx
import React, { useState } from 'react';
import { useModelStore } from '../../stores/useModelStore';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { shallow } from 'zustand/shallow';
import './JsonEditor.css';

const JsonEditor = () => {
  const model = useModelStore(s => s.model, shallow);
  const node = useModelStore(s => s.node, shallow);
  const uniaxialMaterial = useModelStore(s => s.uniaxialMaterial, shallow);
  const section = useModelStore(s => s.section, shallow);
  const element = useModelStore(s => s.element, shallow);
  const geomTransf = useModelStore(s => s.geomTransf, shallow);
  const beamIntegration = useModelStore(s => s.beamIntegration, shallow);
  const pattern = useModelStore(s => s.pattern, shallow);
  const timeSeries = useModelStore(s => s.timeSeries, shallow);
  const constraints = useAnalysisStore(s => s.constraints, shallow);
  const numberer = useAnalysisStore(s => s.numberer, shallow);
  const system = useAnalysisStore(s => s.system, shallow);
  const algorithm = useAnalysisStore(s => s.algorithm, shallow);
  const integrator = useAnalysisStore(s => s.integrator, shallow);
  const analysis = useAnalysisStore(s => s.analysis, shallow);
  const analyze = useAnalysisStore(s => s.analyze, shallow);

  const data = { model, node, uniaxialMaterial, section, element, geomTransf, beamIntegration, pattern, timeSeries, constraints, numberer, system, algorithm, integrator, analysis, analyze, };
  const updateComponent = useModelStore(state => state.updateComponent);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const toggleCategory = (category) => {
    setExpandedCategory(prev => (prev === category ? null : category));
  };

  const handleArgChange = (category, id, index, value) => {
    const item = data[category].find(i => i.id === id);
    if (!item) return;
    const newArgs = [...item.args];
    newArgs[index] = value;
    updateComponent(category, id, { args: newArgs });
  };

  return (
    <div className="json-editor">
      {Object.entries(data).map(([category, items]) => (
        <div key={category} className="category-card">
          <div className="category-header" onClick={() => toggleCategory(category)}>
            <h4>{category}</h4>
            <span>{expandedCategory === category ? '▲' : '▼'}</span>
          </div>

          {expandedCategory === category && items.length === 0 && (
            <div className="empty-msg">No items in this category</div>
          )}

          {expandedCategory === category && items.length > 0 && (
            <div className="category-content">
              {items.map(item => (
                <div key={item.id} className="command-card">
                  <div className="command-title">
                    <strong>Command:</strong> {item.command.name}
                  </div>
                  <div>
                    <strong>Args:</strong>
                    {item.args.map((arg, i) => (
                      <input
                        key={i}
                        type="text"
                        // ensure value is not null to avoid React warning
                        value={arg ?? ''}
                        onChange={e => handleArgChange(category, item.id, i, e.target.value)}
                        className="arg-input"
                      />
                    ))}
                  </div>
                  <div className="command-id">ID: {item.id}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default JsonEditor;
