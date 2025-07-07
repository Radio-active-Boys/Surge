import React, { useState, useEffect } from 'react';
import { getTemplates } from '../../api/jsonTemplates';
import { useModelStore } from '../../stores/useModelStore';
import './SectionEditor.css';

const SectionEditor = () => {
  const sectionTemplates = getTemplates('section');
  const addComponent = useModelStore(state => state.addComponent);
  const updateComponent = useModelStore(state => state.updateComponent);
  const removeComponent = useModelStore(state => state.removeComponent);
  const sections = useModelStore(state => state.section);

  const [newTplName, setNewTplName] = useState(sectionTemplates[0]?.name || '');
  const [newParams, setNewParams] = useState(sectionTemplates[0]?.defaultParams || {});

  useEffect(() => {
    const tpl = sectionTemplates.find(t => t.name === newTplName);
    if (tpl) setNewParams(tpl.defaultParams);
  }, [newTplName]);

  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const selectedSection = sections.find(s => s.id === selectedSectionId);
  const [editParams, setEditParams] = useState({});

  useEffect(() => {
    if (selectedSection) {
      setEditParams(selectedSection.params || {});
    } else {
      setEditParams({});
    }
  }, [selectedSection]);

  const handleAddSection = () => {
    if (!newTplName) return;

    addComponent('section', newTplName, newParams);
    const tpl = sectionTemplates.find(t => t.name === newTplName);
    if (tpl) setNewParams(tpl.defaultParams);
  };

  const handleSaveSection = () => {
    if (!selectedSection) return;
    updateComponent('section', selectedSection.id, editParams);
  };

  const handleRemoveSection = () => {
    if (!selectedSection) return;
    removeComponent('section', selectedSection.id);
    setSelectedSectionId(null);
  };

  return (
    <div className="section-editor-container">
      <h3 className="section-editor-heading">Add New Section</h3>
      <div className="section-editor-row">
        <label>Template:</label>
        <select
          value={newTplName}
          onChange={e => setNewTplName(e.target.value)}
        >
          {sectionTemplates.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>
      {newTplName && (() => {
        const tpl = sectionTemplates.find(t => t.name === newTplName);
        if (!tpl) return null;
        return Object.entries(tpl.defaultParams).map(([key, def]) => (
          <div className="section-editor-row" key={key}>
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
                onChange={e => {
                  const val = e.target.value;
                  setNewParams(prev => ({ ...prev, [key]: val === '' ? '' : parseFloat(val) }));
                }}
              />
            )}
          </div>
        ));
      })()}
      <button className="section-editor-button" onClick={handleAddSection}>➕ Add Section</button>

      <hr />

      <h3 className="section-editor-heading">Existing Sections</h3>
      <select
        value={selectedSectionId || ''}
        onChange={e => setSelectedSectionId(e.target.value || null)}
      >
        <option value="">-- select section --</option>
        {sections.map(s => (
          <option key={s.id} value={s.id}>
            {s.templateName} (id {s.id})
          </option>
        ))}
      </select>

      {selectedSection && (
        <div className="section-editor-section">
          <h4>Edit Section "{selectedSection.templateName}"</h4>
          {(() => {
            const tpl = sectionTemplates.find(t => t.name === selectedSection.templateName);
            if (!tpl) return null;
            return Object.entries(tpl.defaultParams).map(([key, def]) => (
              <div className="section-editor-row" key={key}>
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
                    onChange={e => {
                      const val = e.target.value;
                      setEditParams(prev => ({ ...prev, [key]: val === '' ? '' : parseFloat(val) }));
                    }}
                  />
                )}
              </div>
            ));
          })()}
          <button className="section-editor-button" onClick={handleSaveSection}>💾 Save Section</button>
          <button className="section-editor-button" onClick={handleRemoveSection} style={{ marginLeft: '0.5rem' }}>🗑 Remove Section</button>

          <NestedFibersEditor section={selectedSection} />
        </div>
      )}
    </div>
  );
};

const NestedFibersEditor = ({ section }) => {
  const addComponent = useModelStore(state => state.addComponent);
  const updateComponent = useModelStore(state => state.updateComponent);
  const removeComponent = useModelStore(state => state.removeComponent);

  const fiberTemplates = getTemplates('fiber');
  const patchTemplates = getTemplates('patch');
  const layerTemplates = getTemplates('layer');

  const [subCategory, setSubCategory] = useState('fiber');
  const [templates, setTemplates] = useState(fiberTemplates);
  const [selectedTplName, setSelectedTplName] = useState(fiberTemplates[0]?.name || '');
  const [params, setParams] = useState(fiberTemplates[0]?.defaultParams || {});

  useEffect(() => {
    let tpls = [];
    if (subCategory === 'fiber') tpls = fiberTemplates;
    else if (subCategory === 'patch') tpls = patchTemplates;
    else if (subCategory === 'layer') tpls = layerTemplates;
    setTemplates(tpls);
    if (tpls.length) {
      setSelectedTplName(tpls[0].name);
      setParams(tpls[0].defaultParams);
    } else {
      setSelectedTplName(null);
      setParams({});
    }
  }, [subCategory]);

  const handleParamChange = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleAddNested = () => {
    if (!selectedTplName) return;
    addComponent(subCategory, selectedTplName, params, section.id);
    const tpl = templates.find(t => t.name === selectedTplName);
    if (tpl) setParams(tpl.defaultParams);
  };

  const fibers = section.fibers || [];

  return (
    <div className="section-editor-nested">
      <h5>Fibers for Section</h5>
      {fibers.length === 0 ? <p><em>No fibers added.</em></p> :
        <ul>
          {fibers.map(f => (
            <li key={f.id}>
              <strong>{f.category}</strong> "{f.templateName}" args: [{f.args.join(', ')}]
              <button className="section-editor-remove-btn" onClick={() => removeComponent(f.category, f.id)}>Remove</button>
              <button className="section-editor-edit-btn" onClick={() => {
                // Implement inline edit UI if desired. For now, simple prompt-based:
                const tpl = getTemplates(f.category).find(t => t.name === f.templateName);
                if (!tpl) return;
                // Example: prompt JSON; in practice, build a proper form/modal.
                const newJson = prompt(`Edit params as JSON for ${f.templateName}`, JSON.stringify(f.params));
                if (newJson) {
                  try {
                    const newParams = JSON.parse(newJson);
                    updateComponent(f.category, f.id, newParams);
                  } catch (err) {
                    alert('Invalid JSON');
                  }
                }
              }}>Edit</button>
            </li>
          ))}
        </ul>
      }

      <div className="section-editor-row" style={{ marginTop: '1rem' }}>
        <label>Type:</label>
        <select value={subCategory} onChange={e => setSubCategory(e.target.value)}>
          <option value="fiber">fiber</option>
          <option value="patch">patch</option>
          <option value="layer">layer</option>
        </select>
      </div>
      {selectedTplName && (
        <>
          <div className="section-editor-row">
            <label>Template:</label>
            <select
              value={selectedTplName}
              onChange={e => {
                const tpl = templates.find(t => t.name === e.target.value);
                setSelectedTplName(tpl.name);
                setParams(tpl.defaultParams);
              }}
            >
              {templates.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          {(() => {
            const tpl = templates.find(t => t.name === selectedTplName);
            if (!tpl) return null;
            return Object.entries(tpl.defaultParams).map(([key, def]) => (
              <div className="section-editor-row" key={key}>
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
                    onChange={e => {
                      const val = e.target.value;
                      handleParamChange(key, val === '' ? '' : parseFloat(val));
                    }}
                  />
                )}
              </div>
            ));
          })()}
          <button className="section-editor-button" onClick={handleAddNested}>➕ Add {subCategory}</button>
        </>
      )}
    </div>
  );
};

const ArrayInput = ({ values, onChange }) => {
  const handleChange = (i, val) => {
    const arr = [...values];
    arr[i] = parseFloat(val);
    onChange(arr);
  };
  const addItem = () => onChange([...(values || []), 0]);
  const removeItem = i => {
    const arr = (values || []).filter((_, idx) => idx !== i);
    onChange(arr);
  };

  return (
    <div className="array-input">
      {(values || []).map((v, i) => (
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

export default SectionEditor;
