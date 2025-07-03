// src/components/editor/JsonEditor.jsx
import React, { useState, useMemo } from 'react';
import { useModelStore }    from '../../stores/useModelStore';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { shallow }          from 'zustand/shallow';
import './JsonEditor.css';

export default function JsonEditor() {
  // MODEL SELECTORS
  const modelSelectors = {
    node:               useModelStore(s => s.node, shallow),
    boundaryConditions: useModelStore(s => s.boundaryConditions, shallow),
    uniaxialMaterial:   useModelStore(s => s.uniaxialMaterial, shallow),
    section:            useModelStore(s => s.section, shallow),
    element:            useModelStore(s => s.element, shallow),
    geomTransf:         useModelStore(s => s.geomTransf, shallow),
    beamIntegration:    useModelStore(s => s.beamIntegration, shallow),
    patterns:           useModelStore(s => s.patterns, shallow),
    loads:              useModelStore(s => s.loads, shallow),
    timeSeries:         useModelStore(s => s.timeSeries, shallow),
  };

  // ANALYSIS SELECTORS
  const analysisSelectors = {
    sequence:  useAnalysisStore(s => s.sequence, shallow),
    recorders: useAnalysisStore(s => s.recorders, shallow),
  };

  // UPDATERS
  const updateComponentArgs = useModelStore(s => s.updateComponentArgs);
  const updateSequenceArgs  = useAnalysisStore(s => s.updateSequenceArgs);
  const updateRecorderArgs  = useAnalysisStore(s => s.updateRecorderArgs);

  // LOCAL UI STATE
  const [openCategory, setOpenCategory] = useState(null);
  const toggleCategory = cat =>
    setOpenCategory(prev => (prev === cat ? null : cat));

  // MERGE & MEMOIZE
  const data = useMemo(() => ({
    ...modelSelectors,
    ...analysisSelectors
  }), [
    ...Object.values(modelSelectors),
    ...Object.values(analysisSelectors)
  ]);

  // UTILS: parse comma list into numbers or strings
  const parseList = str => str
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')
    .map(s => /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s);

  // REBUILD args[] from recorder metadata
  const rebuildRecorderArgs = rec => {
    const base = ['-file', rec.fileName, '-time'];
    if (rec.name === 'Node') {
      return [
        ...base,
        '-node', ...rec.nodeIds,
        '-dof',  ...rec.dofs,
        rec.responseType
      ];
    }
    return [
      ...base,
      '-ele', ...rec.eleIds,
      rec.responseType
    ];
  };

  // GENERIC ARG CHANGE HANDLER
  const handleArgChange = (category, id, idx, raw) => {
    const arr = data[category] || [];
    const item = arr.find(i => i.id === id);
    if (!item?.args) return;

    const v = raw.trim();
    const numLit = /^-?\d+(\.\d+)?$/;
    const newVal = v === '' ? '' : (numLit.test(v) ? Number(v) : raw);
    const newArgs = [...item.args];
    newArgs[idx] = newVal;

    if (category === 'sequence')       updateSequenceArgs(id, newArgs);
    else if (category === 'recorders') updateRecorderArgs(id, newArgs);
    else                                updateComponentArgs(category, id, newArgs);
  };

  // RENDER
  return (
    <div className="json-editor">
      {Object.entries(data).map(([category, items]) => {
        const arr = Array.isArray(items) ? items : [];
        return (
          <div key={category} className="category-card">
            <div
              className="category-header"
              onClick={() => toggleCategory(category)}
            >
              <h4>{category.replace(/_/g,' ')}</h4>
              <span>{openCategory === category ? '▲' : '▼'}</span>
            </div>

            {openCategory === category && arr.length === 0 && (
              <div className="empty-msg">No items</div>
            )}

            {openCategory === category && arr.length > 0 && (
              <div className="category-content">
                {arr.map(item => {
                  if (category === 'recorders') {
                    // Recorder UI
                    return (
                      <div key={item.id} className="command-card recorder-card">
                        <div><strong>Recorder:</strong> {item.name}</div>
                        <div><code>-file</code> {item.fileName} <code>-time</code></div>

                        {item.name === 'Node' ? (
                          <>
                            <div><code>-node</code></div>
                            <input
                              className="arg-input nested"
                              value={item.nodeIds.join(',')}
                              onChange={e => {
                                const nodeIds = parseList(e.target.value);
                                const updated = {...item, nodeIds};
                                updateRecorderArgs(item.id, rebuildRecorderArgs(updated));
                              }}
                            />

                            <div><code>-dof</code></div>
                            <input
                              className="arg-input nested"
                              value={item.dofs.join(',')}
                              onChange={e => {
                                const dofs = parseList(e.target.value);
                                const updated = {...item, dofs};
                                updateRecorderArgs(item.id, rebuildRecorderArgs(updated));
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <div><code>-ele</code></div>
                            <input
                              className="arg-input nested"
                              value={item.eleIds.join(',')}
                              onChange={e => {
                                const eleIds = parseList(e.target.value);
                                const updated = {...item, eleIds};
                                updateRecorderArgs(item.id, rebuildRecorderArgs(updated));
                              }}
                            />
                          </>
                        )}

                        <div><em>response:</em> {item.responseType}</div>
                      </div>
                    );
                  }

                  // Other categories
                  return (
                    <div key={item.id} className="command-card">
                      <div><strong>Command:</strong> {item.command}</div>
                      <div><strong>ID:</strong>      {item.id}</div>
                      <div>
                        <strong>Args:</strong>
                        {item.args.map((arg, i) => (
                          <input
                            key={i}
                            type="text"
                            value={arg ?? ''}
                            className="arg-input"
                            onChange={e => handleArgChange(category, item.id, i, e.target.value)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
