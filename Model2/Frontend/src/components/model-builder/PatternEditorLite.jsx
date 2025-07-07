import React, { useState, useEffect, useMemo } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useModelStore } from '../../stores/useModelStore';
import './PatternEditor.css';

// ──────── UTILITY: Reconstruct params from args ──────────
function parseArgsToParams(template, args) {
  const params = {};
  if (!template || !template.command || !Array.isArray(template.command.args)) return params;

  template.command.args.forEach((arg, i) => {
    if (typeof arg === 'string' && arg.startsWith('$')) {
      const key = arg.slice(1);
      params[key] = args[i];
    }
  });

  return params;
}

export default function PatternEditorLite() {
  const templates = useMemo(() => getTemplates('pattern'), []);
  const addComponent = useModelStore(s => s.addComponent);
  const updateComponent = useModelStore(s => s.updateComponent);
  const removeComponent = useModelStore(s => s.removeComponent);
  const patterns = useModelStore(s => s.patterns);
  const allLoads = useModelStore(s => s.loads);
  const nodes = useModelStore(s => s.node);      // args[0] holds node ID
  const elements = useModelStore(s => s.element); // args[1] holds element ID
  const modelConfig = useModelStore(s => s.modelConfig);
  const modelType = modelConfig.ndf === 3 ? 'frame' : 'truss';

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

  const [newTpl, setNewTpl] = useState(templates[0]?.name || '');
  const [newParams, setNewParams] = useState(templates[0]?.defaultParams || {});
  const [selPatId, setSelPatId] = useState('');
  const selectedPattern = patterns.find(p => String(p.id) === selPatId);
  const [editParams, setEditParams] = useState({});

  useEffect(() => {
    const tpl = templates.find(t => t.name === newTpl);
    setNewParams(tpl ? { ...tpl.defaultParams } : {});
  }, [newTpl, templates]);

  useEffect(() => {
    if (selectedPattern) {
      const tpl = templates.find(t => t.name === selectedPattern.templateName);
      if (selectedPattern.params && Object.keys(selectedPattern.params).length > 0) {
        setEditParams({ ...selectedPattern.params });
      } else if (tpl) {
        const fallbackParams = parseArgsToParams(tpl, selectedPattern.args);
        setEditParams(fallbackParams);
      } else {
        setEditParams({});
      }
    } else {
      setEditParams({});
    }
  }, [selectedPattern, templates]);

  const handleAddPattern = () => {
    if (!newTpl) return;
    addComponent('pattern', newTpl, newParams);
    setNewParams(templates.find(t => t.name === newTpl).defaultParams);
  };

  const handleRemovePattern = () => {
    if (selectedPattern) removeComponent('pattern', selectedPattern.id);
    setSelPatId('');
  };

  return (
    <div className="pattern-editor-container">
      <h3>Add New Load Pattern</h3>
      {/* <select value={newTpl} onChange={e => setNewTpl(e.target.value)}>
        {templates.map(t => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select> */}
      {newTpl && renderParams(newTpl, newParams, setNewParams)}
      <button className="pattern-editor-button" onClick={handleAddPattern}>
        ➕ Add Pattern
      </button>

      <hr />

      <h3>Existing Loads Patterns</h3>
      <select value={selPatId} onChange={e => setSelPatId(e.target.value)}>
        <option value="">-- select pattern --</option>
        {patterns.map(p => (
          <option key={p.id} value={p.id}>
            {p.templateName} ID {p.args[1]}
          </option>
        ))}
      </select>

      {selectedPattern && (
        <div className="pattern-editor-section">
          {/* <h4>Edit “{selectedPattern.templateName}”</h4> */}
          {renderParams(selectedPattern.templateName, editParams, setEditParams)}
          <button className="pattern-editor-button" onClick={handleRemovePattern}>
            🗑 Remove Pattern
          </button>
          <NestedCommandsEditor
            patternId={selectedPattern.id}
            allLoads={allLoads}
            removeLoad={id => removeComponent('load', id)}
            removeEleLoad={id => removeComponent('eleLoad', id)}
            addComponent={addComponent}
            modelType={modelType}
            nodes={nodes}
            elements={elements}
          />
        </div>
      )}
    </div>
  );
}

function NestedCommandsEditor({ patternId, allLoads, removeLoad, removeEleLoad, addComponent, modelType, nodes, elements }) {
  const loads    = allLoads.filter(l => l.patternId === patternId && l.category === 'load');
  const eleLoads = allLoads.filter(l => l.patternId === patternId && l.category === 'eleLoad');

  const [subCategory, setSubCategory] = useState('load');
  const [templatesList, setTemplatesList] = useState([]);
  const [selectedTpl, setSelectedTpl] = useState(null);
  const [params, setParams] = useState({});

  useEffect(() => {
    const tpls = getTemplates(subCategory).filter(t =>
      (!t.tag || t.tag === modelType) && t.defaultParams
    );
    setTemplatesList(tpls);

    if (tpls.length > 0) {
      setSelectedTpl(tpls[0]);
      setParams({ ...tpls[0].defaultParams });
    } else {
      setSelectedTpl(null);
      setParams({});
    }
  }, [subCategory, modelType]);

  const handleAdd = () => {
    if (!selectedTpl) return;

    // ─── VALIDATION ──────────────────────────────────
    if (subCategory === 'load') {
      const nodeId = params['Node ID'];
      if (!nodes.some(n => n.args[0] === nodeId)) {
        window.alert(`Node ID ${nodeId} does not exist in the model.`);
        return;
      }
    }

    if (subCategory === 'eleLoad') {
      const idsToCheck = params.useRange
        ? [params.eleTag1, params.eleTag2]
        : params["Element ID's"] || [];

      const missing = idsToCheck.filter(id => !elements.some(e => e.args[1] === id));
      if (missing.length) {
        window.alert(
          `Element ID${missing.length > 1 ? 's' : ''} ${missing.join(', ')} do not exist in the model.`
        );
        return;
      }
    }
    // ─────────────────────────────────────────────────

    addComponent(subCategory, selectedTpl.name, params, patternId);
    setParams({ ...selectedTpl.defaultParams });
  };

  const combined = [...loads, ...eleLoads];

  return (
    <div className="pattern-editor-nested">
      <strong>Existing:</strong>
      {combined.length === 0 ? (
        <p><em>No Load Added Yet.</em></p>
      ) : (
        <ul>
          {combined.map(item => (
            <li key={item.id}>
              {item.command}([{item.args.join(', ')}])
              <button className="pattern-editor-remove-btn" onClick={() => {
                if (item.category === 'load') removeLoad(item.id);
                if (item.category === 'eleLoad') removeEleLoad(item.id);
              }}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pattern-editor-param-row" style={{ marginTop: 16 }}>
        <label>Load Type:</label>
        <select value={subCategory} onChange={e => setSubCategory(e.target.value)}>
          <option value="load">Nodal Loads</option>
          <option value="eleLoad">Element Loads</option>
        </select>
      </div>

      {selectedTpl && (
        <>
          <div className="pattern-editor-param-row">
            {/* <label>Template:</label> */}
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


          {/* Generic params */}
          {Object.entries(selectedTpl.defaultParams).filter(([key]) =>
            !['useRange', 'eleTag1', 'eleTag2', 'eleTags'].includes(key)
          ).map(([key, def]) => (
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
          {/* <button onClick={() => remove(i)}>×</button> */}
        </div>
      ))}
      {/* <button onClick={add}>+ new</button> */}
    </div>
  );
}
