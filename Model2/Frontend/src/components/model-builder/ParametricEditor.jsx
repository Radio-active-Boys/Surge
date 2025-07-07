import React, { useState, useEffect } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useModelStore } from '../../stores/useModelStore';
import './ParametricEditor.css';

const ParametricEditor = ({ category }) => {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [params, setParams] = useState({});
  const addComponent = useModelStore(state => state.addComponent);
  const setModelConfig = useModelStore(state => state.setModelConfig);
  const modelConfig = useModelStore(state => state.modelConfig);
  const patterns = useModelStore(state => state.patterns);
  const [patternId, setPatternId] = useState(null);

  useEffect(() => {
    if (category !== 'model') {
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
    } else {
      setTemplates([]);
      setSelected(null);
      setParams({});
      setPatternId(null);
    }
  }, [category]);

  if (category === 'model') {
    const handleConfigChange = (key, value) => {
      setModelConfig({ [key]: value });
    };
    return (
      <div className="param-editor">
        <h3>Model Configuration</h3>
        <div className="param-row">
          <label>ndm</label>
          <input
            type="text"
            value={modelConfig.ndm}
            onChange={e => handleConfigChange('ndm', e.target.value)}
            onBlur={e => {
              const val = parseInt(e.target.value, 10);
              if (isNaN(val)) alert("ndm must be a number");
              else handleConfigChange('ndm', val);
            }}
          />
        </div>
        <div className="param-row">
          <label>ndf</label>
          <input
            type="text"
            value={modelConfig.ndf}
            onChange={e => handleConfigChange('ndf', e.target.value)}
            onBlur={e => {
              const val = parseInt(e.target.value, 10);
              if (isNaN(val)) alert("ndf must be a number");
              else handleConfigChange('ndf', val);
            }}
          />
        </div>
      </div>
    );
  }

  if (!selected) return <div className="loading">Loading...</div>;

  const handleParamChange = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (['load', 'eleLoad', 'sp'].includes(category) && !patternId) {
      alert('Please select a pattern to attach this command');
      return;
    }

    const parsedParams = {};
    try {
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) {
          parsedParams[k] = v.map(x => {
            const num = parseFloat(x);
            if (isNaN(num)) throw new Error(`Invalid number in array param '${k}'`);
            return num;
          });
        } else {
          const num = parseFloat(v);
          if (isNaN(num)) throw new Error(`Parameter '${k}' must be a number`);
          parsedParams[k] = num;
        }
      }
    } catch (err) {
      alert(err.message);
      return;
    }

    addComponent(category, selected.name, parsedParams, patternId);
    setParams(selected.defaultParams);
  };

  return (
    <div className="model-param-editor">
      <div className="param-header">
        <label>Template:</label>
        <select
          value={selected.name}
          onChange={e => {
            const tpl = templates.find(t => t.name === e.target.value);
            if (tpl) {
              setSelected(tpl);
              setParams(tpl.defaultParams);
            } else {
              setSelected(null);
              setParams({});
            }
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
                values={params[key] || []}
                onChange={v => handleParamChange(key, v)}
              />
            ) : (
              <input
                type="text"
                value={params[key] ?? ''}
                onChange={e => handleParamChange(key, e.target.value)}
                onBlur={e => {
                  const val = e.target.value.trim();
                  if (val === '' || isNaN(val)) {
                    alert(`${key} must be a number`);
                  } else {
                    handleParamChange(key, parseFloat(val));
                  }
                }}
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
    arr[i] = val;
    onChange(arr);
  };

  const handleBlur = (i, val) => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      alert(`Array value at position ${i + 1} must be a number`);
    } else {
      const arr = [...values];
      arr[i] = num;
      onChange(arr);
    }
  };

  const addItem = () => onChange([...values, '']);
  const removeItem = i => {
    const arr = values.filter((_, idx) => idx !== i);
    onChange(arr);
  };

  return (
    <div className="array-input">
      {values.map((v, i) => (
        <div key={i} className="array-row">
          <input
            type="text"
            value={v}
            onChange={e => handleChange(i, e.target.value)}
            onBlur={e => handleBlur(i, e.target.value)}
          />
          <button type="button" className="remove-btn" onClick={() => removeItem(i)}>×</button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={addItem}>+ Add</button>
    </div>
  );
};

export default ParametricEditor;
