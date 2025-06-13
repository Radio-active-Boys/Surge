// src/components/model-builder/PatternEditor.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useModelStore } from '../../stores/useModelStore';
import './PatternEditor.css';

const PatternEditor = () => {
  // Keep the list of pattern‐templates stable
  const templates = useMemo(() => getTemplates('pattern'), []);

  // Core actions & state
  const addComponent    = useModelStore(s => s.addComponent);
  const updatePattern   = useModelStore(s => s.updatePattern);
  const removeComponent = useModelStore(s => s.removeComponent);
  const patterns        = useModelStore(s => s.patterns);

  // Nested‐command state
  const allLoads    = useModelStore(s => s.loads);
  const allEleLoads = useModelStore(s => s.eleLoads);
  const allSps      = useModelStore(s => s.sps);

  // — Add New Pattern form —
  const [newTplName, setNewTplName] = useState(templates[0]?.name || '');
  const [newParams, setNewParams]   = useState(
    templates[0] ? { ...templates[0].defaultParams } : {}
  );

  // Reset newParams when template changes
  useEffect(() => {
    const tpl = templates.find(t => t.name === newTplName);
    setNewParams(tpl ? { ...tpl.defaultParams } : {});
  }, [newTplName]);

  const handleAddPattern = () => {
    if (!newTplName) return;
    addComponent('pattern', newTplName, newParams, null);
    // reset form
    const tpl = templates.find(t => t.name === newTplName);
    if (tpl) setNewParams({ ...tpl.defaultParams });
  };

  // — Edit Existing Pattern —
  const [selectedPatternId, setSelectedPatternId] = useState('');
  const selectedPattern = patterns.find(p => p.id === selectedPatternId);

  const [editParams, setEditParams] = useState({});
  useEffect(() => {
    if (selectedPattern) {
      setEditParams({ ...selectedPattern.params });
    } else {
      setEditParams({});
    }
  }, [selectedPattern]);

  const handleSavePattern = () => {
    if (!selectedPattern) return;
    updatePattern(selectedPattern.id, editParams);
  };
  const handleRemovePattern = () => {
    if (!selectedPattern) return;
    removeComponent('pattern', selectedPattern.id);
    setSelectedPatternId('');
  };

  return (
    <div className="pattern-editor-container">
      <h3>Add New Pattern</h3>
      <div className="pattern-editor-param-row">
        <label>Template:</label>
        <select
          value={newTplName}
          onChange={e => setNewTplName(e.target.value)}
        >
          {templates.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      {newTplName && templates.find(t => t.name === newTplName)?.defaultParams &&
        Object.entries(templates.find(t => t.name === newTplName).defaultParams)
          .map(([key, def]) => (
            <div className="pattern-editor-param-row" key={key}>
              <label>{key}</label>
              {Array.isArray(def) ? (
                <ArrayInput
                  values={newParams[key] || []}
                  onChange={v => setNewParams(prev => ({ ...prev, [key]: v }))}
                />
              ) : (
                <input
                  type="number"
                  value={newParams[key] ?? ''}
                  onChange={e => setNewParams(prev => ({
                    ...prev,
                    [key]: parseFloat(e.target.value),
                  }))}
                />
              )}
            </div>
          ))
      }

      <button
        className="pattern-editor-button"
        onClick={handleAddPattern}
      >
        ➕ Add Pattern
      </button>

      <hr />

      <h3>Existing Patterns</h3>
      <select
        className="pattern-editor-select"
        value={selectedPatternId}
        onChange={e => setSelectedPatternId(e.target.value)}
      >
        <option value="">-- select pattern --</option>
        {patterns.map(p => (
          <option key={p.id} value={p.id}>
            {p.templateName} (id {p.id})
          </option>
        ))}
      </select>

      {selectedPattern && (
        <div className="pattern-editor-section">
          <h4>Edit "{selectedPattern.templateName}"</h4>
          {templates.find(t => t.name === selectedPattern.templateName)
            ?.defaultParams &&
            Object.entries(
              templates.find(t => t.name === selectedPattern.templateName)
                .defaultParams
            ).map(([key, def]) => (
              <div className="pattern-editor-param-row" key={key}>
                <label>{key}</label>
                {Array.isArray(def) ? (
                  <ArrayInput
                    values={editParams[key] || []}
                    onChange={v => setEditParams(prev => ({ ...prev, [key]: v }))}
                  />
                ) : (
                  <input
                    type="number"
                    value={editParams[key] ?? ''}
                    onChange={e => setEditParams(prev => ({
                      ...prev,
                      [key]: parseFloat(e.target.value),
                    }))}
                  />
                )}
              </div>
            ))
          }

          <button
            className="pattern-editor-button"
            onClick={handleSavePattern}
          >
            💾 Save Pattern
          </button>
          <button
            className="pattern-editor-button"
            onClick={handleRemovePattern}
            style={{ marginLeft: '0.5rem' }}
          >
            🗑 Remove Pattern
          </button>

          <NestedCommandsEditor
            patternId={selectedPattern.id}
            allLoads={allLoads}
            allEleLoads={allEleLoads}
            allSps={allSps}
            // pass down remover functions
            removeLoad={id => removeComponent('load', id)}
            removeEleLoad={id => removeComponent('eleLoad', id)}
            removeSp={id => removeComponent('sp', id)}
            addComponent={addComponent}
          />
        </div>
      )}
    </div>
  );
};

export default PatternEditor;


/** NestedCommandsEditor Component **/  
const NestedCommandsEditor = ({
  patternId,
  allLoads,
  allEleLoads,
  allSps,
  removeLoad,
  removeEleLoad,
  removeSp,
  addComponent,
}) => {
  const loads    = allLoads.filter(l => l.patternId === patternId);
  const eleLoads = allEleLoads.filter(el => el.patternId === patternId);
  const sps      = allSps.filter(sp => sp.patternId === patternId);

  const [subCategory, setSubCategory]     = useState('load');
  const [templatesList, setTemplatesList] = useState([]);
  const [selectedTpl, setSelectedTpl]     = useState(null);
  const [params, setParams]               = useState({});

  useEffect(() => {
    const tpls = getTemplates(subCategory);
    setTemplatesList(tpls);
    if (tpls.length) {
      setSelectedTpl(tpls[0]);
      setParams(tpls[0].defaultParams);
    } else {
      setSelectedTpl(null);
      setParams({});
    }
  }, [subCategory]);

  const handleAddNested = () => {
    if (!selectedTpl) return;
    addComponent(subCategory, selectedTpl.name, params, patternId);
    setParams(selectedTpl.defaultParams);
  };

  return (
    <div className="pattern-editor-nested">
      <h5>Nested Commands for Pattern</h5>

      <strong>Loads:</strong>
      {loads.length === 0 ? (
        <p><em>None</em></p>
      ) : (
        <ul>
          {loads.map(l => (
            <li key={l.id}>
              {l.command}([{l.args.join(', ')}])
              <button
                className="pattern-editor-remove-btn"
                onClick={() => removeLoad(l.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <strong>EleLoads:</strong>
      {eleLoads.length === 0 ? (
        <p><em>None</em></p>
      ) : (
        <ul>
          {eleLoads.map(el => (
            <li key={el.id}>
              {el.command}([{el.args.join(', ')}])
              <button
                className="pattern-editor-remove-btn"
                onClick={() => removeEleLoad(el.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <strong>SPs:</strong>
      {sps.length === 0 ? (
        <p><em>None</em></p>
      ) : (
        <ul>
          {sps.map(sp => (
            <li key={sp.id}>
              {sp.command}([{sp.args.join(', ')}])
              <button
                className="pattern-editor-remove-btn"
                onClick={() => removeSp(sp.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pattern-editor-param-row" style={{ marginTop: '1rem' }}>
        <label>Type:</label>
        <select
          value={subCategory}
          onChange={e => setSubCategory(e.target.value)}
        >
          <option value="load">load</option>
          <option value="eleLoad">eleLoad</option>
          <option value="sp">sp</option>
        </select>
      </div>

      {selectedTpl && (
        <>
          <div className="pattern-editor-param-row">
            <label>Template:</label>
            <select
              value={selectedTpl.name}
              onChange={e => {
                const tpl = templatesList.find(t => t.name === e.target.value);
                setSelectedTpl(tpl);
                setParams(tpl.defaultParams);
              }}
            >
              {templatesList.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {Object.entries(selectedTpl.defaultParams).map(([key, def]) => (
            <div className="pattern-editor-param-row" key={key}>
              <label>{key}</label>
              {Array.isArray(def) ? (
                <ArrayInput
                  values={params[key] || []}
                  onChange={v => setParams(prev => ({ ...prev, [key]: v }))}
                />
              ) : (
                <input
                  type="number"
                  value={params[key] ?? ''}
                  onChange={e => setParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                />
              )}
            </div>
          ))}

          <button className="pattern-editor-add-btn" onClick={handleAddNested}>
            ➕ Add {subCategory}
          </button>
        </>
      )}
    </div>
  );
};

/** ArrayInput helper component **/
const ArrayInput = ({ values, onChange }) => {
  const handleChange = (i, val) => {
    const arr = [...values];
    arr[i] = parseFloat(val);
    onChange(arr);
  };
  const addItem = () => onChange([...values, 0]);
  const removeItem = i => onChange(values.filter((_, idx) => idx !== i));

  return (
    <div className="pattern-editor-array-input">
      {values.map((v, i) => (
        <div key={i} className="pattern-editor-array-row">
          <input
            type="number"
            value={v}
            onChange={e => handleChange(i, e.target.value)}
          />
          <button
            type="button"
            className="pattern-editor-remove-btn"
            onClick={() => removeItem(i)}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="pattern-editor-add-btn"
        onClick={addItem}
      >
        + Add
      </button>
    </div>
  );
};
