import React, { useState, useEffect } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useModelStore } from '../../stores/useModelStore';
import './ParametricEditor.css';

const ParametricEditor = ({ category }) => {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState({});
  const addComponent = useModelStore(state => state.addComponent);

  const patterns = useModelStore(state => state.patterns);
  const [patternId, setPatternId] = useState(null);

  useEffect(() => {
    const tpls = getTemplates(category);
    setTemplates(tpls);
    if (tpls.length) {
      setSelected(tpls[0]);
      setParams(tpls[0].defaultParams);
    } else {
      setSelected(null);
      setParams({});
    }
    setPatternId(null);
  }, [category]);

  if (!selected) return <div className="loading">Loading...</div>;

  const handleParamChange = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (['load','eleLoad','sp'].includes(category) && !patternId) {
      alert('Please select a pattern to attach this command');
      return;
    }
    addComponent(category, selected.name, params, patternId);
    setParams(selected.defaultParams);
  };

  return (
    <div className="param-editor">
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
        {['load','eleLoad','sp'].includes(category) && (
          <div className="param-row">
            <label>Pattern</label>
            <select
              value={patternId || ''}
              onChange={e => setPatternId(Number(e.target.value))}
            >
              <option value="">-- select pattern --</option>
              {patterns.map(p => (
                <option key={p.id} value={p.id}>
                  {p.templateName} (id {p.id})
                </option>
              ))}
            </select>
          </div>
        )}

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
        Add {category}
      </button>
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

export default ParametricEditor;
