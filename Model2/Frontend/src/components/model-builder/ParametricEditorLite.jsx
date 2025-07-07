import React, { useState, useEffect } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useModelStore } from '../../stores/useModelStore';
import './ParametricEditor.css';

const ParametricEditorLite = ({ category }) => {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rawParams, setRawParams] = useState({});
  const addComponent = useModelStore(state => state.addComponent);
  const setModelConfig = useModelStore(state => state.setModelConfig);
  const modelConfig = useModelStore(state => state.modelConfig);
  const patterns = useModelStore(state => state.patterns);
  const [patternId, setPatternId] = useState(null);

  const [modelType, setModelType] = useState(
    modelConfig.ndf === 3 ? 'frame' : 'truss'
  );

  useEffect(() => {
    if (modelType === 'truss') {
      setModelConfig({ ndm: 2, ndf: 2 });
    } else if (modelType === 'frame') {
      setModelConfig({ ndm: 2, ndf: 3 });
    }
  }, [modelType, setModelConfig]);

  useEffect(() => {
    if (category !== 'modelLite') {
      const tpls = getTemplates(category);
      setTemplates(tpls);
      if (tpls.length) {
        setSelected(tpls[0]);
        setRawParams(convertToRawParams(tpls[0].defaultParams));
      } else {
        setSelected(null);
        setRawParams({});
      }
      setPatternId(null);
    } else {
      setTemplates([]);
      setSelected(null);
      setRawParams({});
      setPatternId(null);
    }
  }, [category]);

  const convertToRawParams = (params) => {
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.map(String) : String(v),
      ])
    );
  };

  const parseParamValues = () => {
    const parsed = {};
    for (const [key, val] of Object.entries(rawParams)) {
      if (Array.isArray(val)) {
        const nums = val.map(v => parseFloat(v));
        if (nums.some(n => isNaN(n))) return null;
        parsed[key] = nums;
      } else {
        const num = parseFloat(val);
        if (isNaN(num)) return null;
        parsed[key] = num;
      }
    }
    return parsed;
  };

  const handleParamChange = (key, value) => {
    setRawParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (['load', 'eleLoad', 'sp'].includes(category) && !patternId) {
      alert('Please select a pattern to attach this command');
      return;
    }
    const parsed = parseParamValues();
    if (!parsed) {
      alert('One or more parameter values are invalid.');
      return;
    }
    addComponent(category, selected.name, parsed, patternId);
    setRawParams(convertToRawParams(selected.defaultParams));
  };

  if (category === 'modelLite') {
    return (
      <div className="param-editor">
        <h3>Structure Configuration</h3>
        <div className="button-group">
          {['truss', 'frame'].map(type => {
            const isActive = modelType === type;
            const label = type === 'truss' ? 'Truss' : 'Frame / Beam / Column';
            return (
              <button
                key={type}
                onClick={() => setModelType(type)}
                className={`model-type-button${isActive ? ' active' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!selected) return <div className="loading">Loading...</div>;

  return (
    <div className="model-param-editor">
      <div className="param-header">
        <select
          value={selected.name}
          onChange={e => {
            const tpl = templates.find(t => t.name === e.target.value);
            setSelected(tpl);
            setRawParams(convertToRawParams(tpl.defaultParams));
          }}
        >
          {templates.map(t => (
            <option key={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="params">
        {['load', 'eleLoad', 'sp'].includes(category) && (
          <div className="param-row">
            <label>Pattern</label>
            <select
              value={patternId || ''}
              onChange={e => setPatternId(Number(e.target.value) || null)}
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
                values={rawParams[key] || []}
                onChange={v => handleParamChange(key, v)}
              />
            ) : (
              <input
                type="text"
                value={rawParams[key] ?? ''}
                onChange={e => handleParamChange(key, e.target.value)}
                className={isNaN(parseFloat(rawParams[key])) ? 'invalid' : ''}
              />
            )}
          </div>
        ))}
      </div>

      <button className="submit-btn" onClick={handleSubmit}>
        Add ➕
      </button>
    </div>
  );
};

const ArrayInput = ({ values, onChange }) => {
  const [rawValues, setRawValues] = useState(values);

  useEffect(() => {
    setRawValues(values);
  }, [values]);

  const handleChange = (i, val) => {
    const updated = [...rawValues];
    updated[i] = val;
    setRawValues(updated);

    const parsed = updated.map(v => parseFloat(v));
    if (!parsed.some(n => isNaN(n))) {
      onChange(updated);
    }
  };

  const addItem = () => {
    const updated = [...rawValues, '0'];
    setRawValues(updated);
    onChange(updated);
  };

  const removeItem = i => {
    const updated = rawValues.filter((_, idx) => idx !== i);
    setRawValues(updated);
    onChange(updated);
  };

  return (
    <div className="array-input">
      {rawValues.map((v, i) => (
        <div key={i} className="array-row">
          <input
            type="text"
            value={v}
            onChange={e => handleChange(i, e.target.value)}
            className={isNaN(parseFloat(v)) ? 'invalid' : ''}
          />
          <button type="button" className="remove-btn" onClick={() => removeItem(i)}>×</button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={addItem}>+ Add</button>
    </div>
  );
};

export default ParametricEditorLite;
