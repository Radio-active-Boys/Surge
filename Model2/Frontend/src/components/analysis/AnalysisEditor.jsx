// src/components/analysis/AnalysisEditor.jsx
import React, { useState, useEffect } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import './AnalysisEditor.css';

const AnalysisEditor = ({ category }) => {
  // Sequence methods
  const addComponent = useAnalysisStore(state => state.addComponent);
  const sequence = useAnalysisStore(state => state.sequence);
  const moveUp = useAnalysisStore(state => state.moveUp);
  const moveDown = useAnalysisStore(state => state.moveDown);
  const removeComponent = useAnalysisStore(state => state.removeComponent);

  // Recorder methods
  const recorders = useAnalysisStore(state => state.recorders);
  const updateRecorder = useAnalysisStore(state => state.updateRecorder);
  const addRecorder = useAnalysisStore(state => state.addRecorder);
  const removeRecorder = useAnalysisStore(state => state.removeRecorder);

  // For non-recorder, template-based tabs
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState({});

  // For 'analyze' special case
  const [analyzeSteps, setAnalyzeSteps] = useState(1); // CHANGED: local state for analyze count

  useEffect(() => {
    if (!category) {
      setTemplates([]); setSelected(null); setParams({});
      return;
    }
    if (category === 'recorder') {
      setTemplates([]); setSelected(null); setParams({});
      return;
    }
    if (category === 'analyze') {
      // CHANGED: reset local analyzeSteps if desired
      setTemplates([]);
      setSelected(null);
      setParams({});
      setAnalyzeSteps(1);
      return;
    }
    // other categories: fetch templates
    const tpls = getTemplates(category);
    setTemplates(tpls);
    if (tpls.length) {
      setSelected(tpls[0]);
      setParams(tpls[0].defaultParams);
    } else {
      setSelected(null);
      setParams({});
    }
  }, [category]);

  const handleParamChange = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };
  const handleSubmit = () => {
    if (!selected) return;
    addComponent(category, selected.name, params);
    setParams(selected.defaultParams);
  };

  // For adding custom recorder
  const [recName, setRecName] = useState('Node');
  const [fileName, setFileName] = useState('');
  const [customNodeIds, setCustomNodeIds] = useState([]);
  const [customDofs, setCustomDofs] = useState([]);
  const [customEleIds, setCustomEleIds] = useState([]);
  const [responseType, setResponseType] = useState('');

  const handleAddRecorder = () => {
    if (!fileName || !responseType) {
      alert('Specify file name and response type');
      return;
    }
    addRecorder({
      name: recName,
      fileName,
      nodeIds: customNodeIds,
      dofs: customDofs,
      eleIds: customEleIds,
      responseType
    });
    setFileName('');
    setResponseType('');
    setCustomNodeIds([]);
    setCustomDofs([]);
    setCustomEleIds([]);
  };

  return (
    <div className="param-editor">
      {category !== 'recorder' && category !== 'analyze' ? (
        // Template-based tabs except 'analyze'
        <>
          {selected && (
            <>
              <div className="param-header">
                <label>Template:</label>
                <select
                  value={selected.name}
                  onChange={e => {
                    const tpl = templates.find(t => t.name === e.target.value);
                    setSelected(tpl);
                    setParams(tpl.defaultParams);
                  }}
                >
                  {templates.map(t => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="params">
                {Object.entries(selected.defaultParams).map(([key, def]) => (
                  <div className="param-row" key={key}>
                    <label>{key}</label>
                    {Array.isArray(def) ? (
                      <ArrayInput
                        values={params[key] || []}
                        onChange={v => handleParamChange(key, v)}
                      />
                    ) : (
                      <input
                        type="number"
                        value={params[key] ?? ''}
                        onChange={e => handleParamChange(key, parseFloat(e.target.value))}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button className="submit-btn" onClick={handleSubmit}>
                ➕ Add
              </button>
            </>
          )}

          <div className="sequence-section">
            <h3>Analysis Sequence</h3>
            {sequence.length === 0 ? (
              <p className="empty-note"><em>No steps added yet</em></p>
            ) : (
              <ol className="sequence-list">
                {sequence.map(item => (
                  <li key={item.id} className="sequence-item">
                    <div>
                      <strong>{item.category}</strong>: {item.command}({item.args.join(', ')})
                    </div>
                    <div className="button-group">
                      <button onClick={() => moveUp(item.id)} title="Move up">↑</button>
                      <button onClick={() => moveDown(item.id)} title="Move down">↓</button>
                      <button className="remove-btn" onClick={() => removeComponent(item.id)}>❌</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      ) : category === 'analyze' ? (
        // CHANGED: special UI for 'analyze'
        <div className="analyze-section">
          <h3>Analyze Step</h3>
          <div className="param-row">
            <label>Number of steps/iterations:</label>
            <input
              type="number"
              min="1"
              value={analyzeSteps}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                setAnalyzeSteps(isNaN(v) || v < 1 ? 1 : v);
              }}
            />
          </div>
          <button
            className="submit-btn"
            onClick={() => {
              // add an 'analyze' step with the specified count
              addComponent('analyze', null, { steps: analyzeSteps });
            }}
          >
            ➕ Add Analyze
          </button>

          <div className="sequence-section" style={{ marginTop: '1rem' }}>
            <h3>Analysis Sequence</h3>
            {sequence.length === 0 ? (
              <p className="empty-note"><em>No steps added yet</em></p>
            ) : (
              <ol className="sequence-list">
                {sequence.map(item => (
                  <li key={item.id} className="sequence-item">
                    <div>
                      <strong>{item.category}</strong>: {item.command}({item.args.join(', ')})
                    </div>
                    <div className="button-group">
                      <button onClick={() => moveUp(item.id)} title="Move up">↑</button>
                      <button onClick={() => moveDown(item.id)} title="Move down">↓</button>
                      <button className="remove-btn" onClick={() => removeComponent(item.id)}>❌</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : (
        // Recorder tab
        <div className="recorder-section">
          <h3>Recorders</h3>
          <ul className="recorder-list">
            {recorders.map(r => (
              <li key={r.id} className="recorder-item">
                <div>
                  {r.immutable && <em>(default)</em>}
                </div>
                {r.immutable ? (
                  <DefaultRecorderEditor recorder={r} updateRecorder={updateRecorder} />
                ) : (
                  <CustomRecorderEditor recorder={r} updateRecorder={updateRecorder} removeRecorder={removeRecorder} />
                )}
              </li>
            ))}
          </ul>

          <div className="add-recorder-form">
            <h4>Add Custom Recorder</h4>
            <div className="param-row">
              <label>Type:</label>
              <select value={recName} onChange={e => setRecName(e.target.value)}>
                <option value="Node">Node</option>
                <option value="Element">Element</option>
              </select>
            </div>
            <div className="param-row">
              <label>File name:</label>
              <input
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder="e.g. custom_nodes.txt"
              />
            </div>
            {recName === 'Node' && (
              <>
                <div className="param-row">
                  <label>Node IDs:</label>
                  <input
                    type="text"
                    value={customNodeIds.join(',')}
                    onChange={e => {
                      const arr = e.target.value
                        .split(',')
                        .map(s => parseInt(s.trim(), 10))
                        .filter(n => !isNaN(n));
                      setCustomNodeIds(arr);
                    }}
                    placeholder="e.g. 1,2,3"
                  />
                </div>
                <div className="param-row">
                  <label>DOFs:</label>
                  <input
                    type="text"
                    value={customDofs.join(',')}
                    onChange={e => {
                      const arr = e.target.value
                        .split(',')
                        .map(s => parseInt(s.trim(), 10))
                        .filter(n => !isNaN(n));
                      setCustomDofs(arr);
                    }}
                    placeholder="e.g. 1,2"
                  />
                </div>
              </>
            )}
            {recName === 'Element' && (
              <div className="param-row">
                <label>Element IDs:</label>
                <input
                  type="text"
                  value={customEleIds.join(',')}
                  onChange={e => {
                    const arr = e.target.value
                      .split(',')
                      .map(s => parseInt(s.trim(), 10))
                      .filter(n => !isNaN(n));
                    setCustomEleIds(arr);
                  }}
                  placeholder="e.g. 1,2"
                />
              </div>
            )}
            <div className="param-row">
              <label>Response:</label>
              <input
                type="text"
                value={responseType}
                onChange={e => setResponseType(e.target.value)}
                placeholder="e.g. disp, vel, force..."
              />
            </div>
            <button className="submit-btn" onClick={handleAddRecorder}>➕ Add Recorder</button>
          </div>
        </div>
      )}
    </div>
  );
};

const DefaultRecorderEditor = ({ recorder, updateRecorder }) => {
  const { id, name, responseType, nodeIds, dofs, eleIds } = recorder;
  const [localNodeIds, setLocalNodeIds] = useState([...nodeIds]);
  const [localDofs, setLocalDofs] = useState([...dofs]);
  const [localEleIds, setLocalEleIds] = useState([...eleIds]);

  useEffect(() => {
    setLocalNodeIds([...recorder.nodeIds]);
    setLocalDofs([...recorder.dofs]);
    setLocalEleIds([...recorder.eleIds]);
  }, [recorder]);

  const handleSave = () => {
    updateRecorder({
      id,
      nodeIds: recorder.name === 'Node' ? localNodeIds : undefined,
      dofs: recorder.name === 'Node' ? localDofs : undefined,
      eleIds: recorder.name === 'Element' ? localEleIds : undefined
    });
  };

  return (
    <div className="default-recorder-editor" style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
      <div>{recorder.name} - {responseType} <em>(default)</em></div>
      {recorder.name === 'Node' ? (
        <>
          <div className="param-row">
            <label>Node IDs:</label>
            <input
              type="text"
              value={localNodeIds.join(',')}
              onChange={e => {
                const arr = e.target.value
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n));
                setLocalNodeIds(arr);
              }}
            />
          </div>
          <div className="param-row">
            <label>DOFs:</label>
            <input
              type="text"
              value={localDofs.join(',')}
              onChange={e => {
                const arr = e.target.value
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n));
                setLocalDofs(arr);
              }}
            />
          </div>
        </>
      ) : (
        <div className="param-row">
          <label>Element IDs:</label>
          <input
            type="text"
            value={localEleIds.join(',')}
            onChange={e => {
              const arr = e.target.value
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));
              setLocalEleIds(arr);
            }}
          />
        </div>
      )}
      <button type="button" onClick={handleSave} style={{ marginTop: '0.25rem' }}>
        Save Changes
      </button>
    </div>
  );
};

const CustomRecorderEditor = ({ recorder, updateRecorder, removeRecorder }) => {
  const { id, name, fileName, responseType, nodeIds, dofs, eleIds } = recorder;
  const [localNodeIds, setLocalNodeIds] = useState([...nodeIds]);
  const [localDofs, setLocalDofs] = useState([...dofs]);
  const [localEleIds, setLocalEleIds] = useState([...eleIds]);

  useEffect(() => {
    setLocalNodeIds([...recorder.nodeIds]);
    setLocalDofs([...recorder.dofs]);
    setLocalEleIds([...recorder.eleIds]);
  }, [recorder]);

  const handleSave = () => {
    updateRecorder({
      id,
      nodeIds: recorder.name === 'Node' ? localNodeIds : undefined,
      dofs: recorder.name === 'Node' ? localDofs : undefined,
      eleIds: recorder.name === 'Element' ? localEleIds : undefined
    });
  };

  return (
    <div className="custom-recorder-editor" style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
      <div><strong>File:</strong> {fileName}</div>
      <div><strong>Response:</strong> {responseType}</div>
      <div className="param-row">
        <label>Type:</label> {name}
      </div>
      {name === 'Node' ? (
        <>
          <div className="param-row">
            <label>Node IDs:</label>
            <input
              type="text"
              value={localNodeIds.join(',')}
              onChange={e => {
                const arr = e.target.value
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n));
                setLocalNodeIds(arr);
              }}
            />
          </div>
          <div className="param-row">
            <label>DOFs:</label>
            <input
              type="text"
              value={localDofs.join(',')}
              onChange={e => {
                const arr = e.target.value
                  .split(',')
                  .map(s => parseInt(s.trim(), 10))
                  .filter(n => !isNaN(n));
                setLocalDofs(arr);
              }}
            />
          </div>
        </>
      ) : (
        <div className="param-row">
          <label>Element IDs:</label>
          <input
            type="text"
            value={localEleIds.join(',')}
            onChange={e => {
              const arr = e.target.value
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n));
              setLocalEleIds(arr);
            }}
          />
        </div>
      )}
      <div style={{ marginTop: '0.25rem' }}>
        <button type="button" onClick={handleSave}>Save</button>
        <button type="button" onClick={() => removeRecorder(id)} style={{ marginLeft: '0.5rem' }}>
          Remove
        </button>
      </div>
    </div>
  );
};

const ArrayInput = ({ values, onChange }) => {
  const handleChange = (i, val) => {
    const arr = [...values];
    arr[i] = parseFloat(val);
    onChange(arr);
  };
  const addItem = () => onChange([...values, 0]);
  const removeItem = i => {
    const arr = values.filter((_, idx) => idx !== i);
    onChange(arr);
  };
  return (
    <div className="array-input">
      {values.map((v, i) => (
        <div key={i} className="array-row">
          <input
            type="number"
            value={v}
            onChange={e => handleChange(i, e.target.value)}
          />
          <button type="button" className="remove-btn" onClick={() => removeItem(i)}>×</button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={addItem}>+ Add</button>
    </div>
  );
};

export default AnalysisEditor;
