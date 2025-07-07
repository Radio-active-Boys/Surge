// src/components/PatternEditor.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useModelStore } from '../../stores/useModelStore';
import './PatternEditor.css';

export default function PatternEditor() {
  const templates       = useMemo(() => getTemplates('pattern'), []);
  const addComponent    = useModelStore(s => s.addComponent);
  const updateComponent = useModelStore(s => s.updateComponent);
  const removeComponent = useModelStore(s => s.removeComponent);
  const patterns        = useModelStore(s => s.patterns);
  const allLoads        = useModelStore(s => s.loads);

  // — Shared render logic for both Add & Edit forms —
const renderParams = (tplName, params, setParams) => {
  const tpl = templates.find(t => t.name === tplName);
  if (!tpl || !tpl.defaultParams) {
    return <div className="warning">❌ Template "{tplName}" not found.</div>;
  }

  return Object.entries(tpl.defaultParams)
    .filter(([key]) => {
      if (key === 'useRange') return true;
      if (key === 'range') return params.useRange;
      if (key === 'eleTag1' || key === 'eleTag2') return params.useRange;
      return !['range', 'eleTag1', 'eleTag2'].includes(key);
    })
    .map(([key, def]) => (
      <div key={key} className="pattern-editor-param-row">
        <label>{key}</label>
        {typeof def === 'boolean' ? (
          <input
            type="checkbox"
            checked={!!params[key]}
            onChange={e => setParams(p => ({ ...p, [key]: e.target.checked }))}
          />
        ) : Array.isArray(def) ? (
          <ArrayInput
            values={params[key] || []}
            onChange={v => setParams(p => ({ ...p, [key]: v }))}
          />
        ) : (
          <input
            type="number"
            value={params[key] ?? ''}
            onChange={e => {
              const v = e.target.value;
              setParams(p => ({ ...p, [key]: v === '' ? '' : parseFloat(v) }));
            }}
          />
        )}
      </div>
    ));
};

  // — Add New Pattern —
  const [newTpl, setNewTpl]       = useState(templates[0]?.name || '');
  const [newParams, setNewParams] = useState(templates[0]?.defaultParams || {});

  useEffect(() => {
    const tpl = templates.find(t => t.name === newTpl);
    setNewParams(tpl ? { ...tpl.defaultParams } : {});
  }, [newTpl, templates]);

  const handleAddPattern = () => {
    if (!newTpl) return;
    addComponent('pattern', newTpl, newParams);
    setNewParams(templates.find(t => t.name === newTpl).defaultParams);
  };

  // — Edit Existing Pattern —
  const [selPatId, setSelPatId]     = useState('');
  const selectedPattern             = patterns.find(p => String(p.id) === selPatId);
  const [editParams, setEditParams] = useState({});

  useEffect(() => {
    setEditParams(selectedPattern ? { ...selectedPattern.params } : {});
  }, [selectedPattern]);

  const handleSavePattern   = () => {
    if (selectedPattern) updateComponent('pattern', selectedPattern.id, editParams);
  };
  const handleRemovePattern = () => {
    if (selectedPattern) removeComponent('pattern', selectedPattern.id);
    setSelPatId('');
  };

  return (
    <div className="pattern-editor-container">
      {/* Add New Pattern */}
      <h3>Add New Pattern</h3>
      <select value={newTpl} onChange={e => setNewTpl(e.target.value)}>
        {templates.map(t => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
      {newTpl && renderParams(newTpl, newParams, setNewParams)}
      <button className="pattern-editor-button" onClick={handleAddPattern}>
        ➕ Add Pattern
      </button>

      <hr/>

      {/* Edit Existing Pattern */}
      <h3>Existing Patterns</h3>
      <select value={selPatId} onChange={e => setSelPatId(e.target.value)}>
        <option value="">-- select pattern --</option>
        {patterns.map(p => (
          <option key={p.id} value={p.id}>
            {p.templateName} (id {p.id})
          </option>
        ))}
      </select>

      {selectedPattern && (
        <div className="pattern-editor-section">
          <h4>Edit “{selectedPattern.templateName}”</h4>
          {renderParams(selectedPattern.templateName, editParams, setEditParams)}
          <button className="pattern-editor-button" onClick={handleSavePattern}>
            💾 Save Pattern
          </button>
          <button
            className="pattern-editor-button"
            style={{ marginLeft: 8 }}
            onClick={handleRemovePattern}
          >
            🗑 Remove Pattern
          </button>

          <NestedCommandsEditor
            patternId={selectedPattern.id}
            allLoads={allLoads}
            removeLoad={id => removeComponent('load', id)}
            removeEleLoad={id => removeComponent('eleLoad', id)}
            removeSp={id => removeComponent('sp', id)}
            addComponent={addComponent}
          />
        </div>
      )}
    </div>
  );
}

function NestedCommandsEditor({
  patternId,
  allLoads,
  removeLoad,
  removeEleLoad,
  removeSp,
  addComponent,
}) {
  const loads    = allLoads.filter(l => l.patternId === patternId && l.category === 'load');
  const eleLoads = allLoads.filter(l => l.patternId === patternId && l.category === 'eleLoad');
  const sps      = allLoads.filter(l => l.patternId === patternId && l.category === 'sp');

  const [subCategory, setSubCategory]     = useState('load');
  const [templatesList, setTemplatesList] = useState([]);
  const [selectedTpl, setSelectedTpl]     = useState(null);
  const [params, setParams]               = useState({});

  useEffect(() => {
    const tpls = getTemplates(subCategory)
    .filter(t => t.defaultParams != null);
    setTemplatesList(tpls);

    if (tpls.length > 0 && tpls[0]?.defaultParams) {
      setSelectedTpl(tpls[0]);
      setParams({ ...tpls[0].defaultParams });
    } else {
      setSelectedTpl(null);
      setParams({});
    }
  }, [subCategory]);

  const handleAdd = () => {
    if (!selectedTpl) return;
    addComponent(subCategory, selectedTpl.name, params, patternId);
    setParams({ ...selectedTpl.defaultParams });
  };

  const combined = [...loads, ...eleLoads, ...sps];

  return (
    <div className="pattern-editor-nested">
      <h5>Nested Commands for Pattern</h5>

      <strong>Existing:</strong>
      {combined.length === 0 ? (
        <p><em>None</em></p>
      ) : (
        <ul>
          {combined.map(item => (
            <li key={item.id}>
              {item.command}([{item.args.join(', ')}])
              <button
                className="pattern-editor-remove-btn"
                onClick={() => {
                  if (item.category === 'load')    removeLoad(item.id);
                  if (item.category === 'eleLoad') removeEleLoad(item.id);
                  if (item.category === 'sp')      removeSp(item.id);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* select sub‑category */}
      <div className="pattern-editor-param-row" style={{ marginTop: 16 }}>
        <label>Type:</label>
        <select value={subCategory} onChange={e => setSubCategory(e.target.value)}>
          <option value="load">load</option>
          <option value="eleLoad">eleLoad</option>
          <option value="sp">sp</option>
        </select>
      </div>

      {/* --- SPECIAL CASE: eleLoad --- */}
      {subCategory === 'eleLoad' && (
        <>
          {/* — TEMPLATE SELECTOR — */}
          <div className="pattern-editor-param-row">
            <label>Template:</label>
            <select
              value={selectedTpl?.name || ''}
              onChange={e => {
              const tpl = templatesList.find(t => t.name === e.target.value);
              if (tpl && tpl.defaultParams) {
                setSelectedTpl(tpl);
                setParams({ ...tpl.defaultParams });
              } else {
                setSelectedTpl(null);
                setParams({});
              }

              }}
            >
              {templatesList.map(t => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* — useRange checkbox — */}
          <div className="pattern-editor-param-row">
            <label>useRange</label>
            <input
              type="checkbox"
              checked={!!params.useRange}
              onChange={e => setParams(p => ({ ...p, useRange: e.target.checked }))}
            />
          </div>

          {/* — RANGE OR TAGS — */}
          {params.useRange ? (
            <>
              <div className="pattern-editor-param-row">
                <label>eleTag1</label>
                <input
                  type="number"
                  value={params.eleTag1 ?? ''}
                  onChange={e => setParams(p => ({ ...p, eleTag1: parseInt(e.target.value, 10) }))}
                />
              </div>
              <div className="pattern-editor-param-row">
                <label>eleTag2</label>
                <input
                  type="number"
                  value={params.eleTag2 ?? ''}
                  onChange={e => setParams(p => ({ ...p, eleTag2: parseInt(e.target.value, 10) }))}
                />
              </div>
            </>
          ) : (
            <div className="pattern-editor-param-row">
              <label>eleTags</label>
              <ArrayInput
                values={params.eleTags || []}
                onChange={v => setParams(p => ({ ...p, eleTags: v }))}
              />
            </div>
          )}

          {/* — OTHER eleLoad PARAMS — */}
          {Object.entries(selectedTpl?.defaultParams ?? {})
            .filter(([key]) => !['useRange','element','eleTag1','eleTag2','eleTags'].includes(key))
            .map(([key, def]) => (
              <div key={key} className="pattern-editor-param-row">
                <label>{key}</label>
                {Array.isArray(def) ? (
                  <ArrayInput
                    values={params[key] || []}
                    onChange={v => setParams(p => ({ ...p, [key]: v }))}
                  />
                ) : (
                  <input
                    type="number"
                    value={params[key] ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      setParams(p => ({ ...p, [key]: v === '' ? '' : parseFloat(v) }));
                    }}
                  />
                )}
              </div>
            ))
          }

          <button className="pattern-editor-add-btn" onClick={handleAdd}>
            ➕ Add eleLoad
          </button>
        </>
      )}

      {/* --- GENERIC CASE for load & sp --- */}
      {subCategory !== 'eleLoad' && selectedTpl && (
        <>
          <div className="pattern-editor-param-row">
            <label>Template:</label>
            <select
              value={selectedTpl.name}
            onChange={e => {
              const tpl = templatesList.find(t => t.name === e.target.value);
              if (tpl && tpl.defaultParams) {
                setSelectedTpl(tpl);
                setParams({ ...tpl.defaultParams });
              } else {
                setSelectedTpl(null);
                setParams({});
              }
            }}

            >
              {templatesList.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {Object.entries(selectedTpl.defaultParams).map(([key, def]) => (
            <div key={key} className="pattern-editor-param-row">
              <label>{key}</label>
              {Array.isArray(def) ? (
                <ArrayInput
                  values={params[key] || []}
                  onChange={v => setParams(p => ({ ...p, [key]: v }))}
                />
              ) : (
                <input
                  type="number"
                  value={params[key] ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setParams(p => ({ ...p, [key]: v === '' ? '' : parseFloat(v) }));
                  }}
                />
              )}
            </div>
          ))}

          <button className="pattern-editor-add-btn" onClick={handleAdd}>
            ➕ Add {subCategory}
          </button>
        </>
      )}
    </div>
  );
}

// ArrayInput remains unchanged
function ArrayInput({ values = [], onChange }) {
  const handle = (i, val) => {
    const num = parseFloat(val);
    const arr = [...values];
    arr[i] = val === '' || isNaN(num) ? '' : num;
    onChange(arr);
  };
  const add = () => onChange([...values, 0]);
  const remove = i => onChange(values.filter((_, idx) => idx !== i));

  return (
    <div className="pattern-editor-array-input">
      {values.map((v, i) => (
        <div key={i} className="pattern-editor-array-row">
          <input
            type="number"
            value={v ?? ''}
            onChange={e => handle(i, e.target.value)}
          />
          <button onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button onClick={add}>+ Add</button>
    </div>
  );
}
