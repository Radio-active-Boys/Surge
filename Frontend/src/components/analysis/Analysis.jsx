// Analysis.jsx

import React, { useState, useEffect } from 'react';
import './Analysis.css';
import SocketConnect from '../middleware/SocketConnect';
import {
  useDataCentre,
  addAnalysisSetting,
  updateAnalysisSetting
} from '../middleware/DataCentre';

const Analysis = () => {
  const { data, setData } = useDataCentre();

  const defaultSettings = {
    constraints: 'Plain',
    system: 'BandSPD',
    numberer: 'RCM',
    integrator: { type: 'LoadControl', incr: 1.0 },
    algorithm: 'Linear',
    analysis: { type: 'Static', steps: 1 }
  };

  const existingSettings = Object.keys(data.analysis_settings).length === 0
    ? defaultSettings
    : data.analysis_settings;

  const [settings, setSettings] = useState({ ...existingSettings });

  useEffect(() => {
    console.log('Local settings state:', settings);
  }, [settings]);

  useEffect(() => {
    if (Object.keys(data.analysis_settings).length > 0) {
      console.log('Context analysis_settings changed to:', data.analysis_settings);
      setSettings({ ...data.analysis_settings });
    }
  }, [data.analysis_settings]);

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleIntegratorTypeChange = (value) => {
    setSettings(prev => ({
      ...prev,
      integrator: { ...prev.integrator, type: value }
    }));
  };
  const handleIntegratorIncrChange = (value) => {
    setSettings(prev => ({
      ...prev,
      integrator: { ...prev.integrator, incr: parseFloat(value) }
    }));
  };

  const handleAnalysisTypeChange = (value) => {
    setSettings(prev => ({
      ...prev,
      analysis: { ...prev.analysis, type: value }
    }));
  };
  const handleAnalysisStepsChange = (value) => {
    setSettings(prev => ({
      ...prev,
      analysis: { ...prev.analysis, steps: parseInt(value, 10) }
    }));
  };

  const handleSave = () => {
    console.log('Saving settings to context:', settings);

    if (Object.keys(data.analysis_settings).length === 0) {
      console.log('→ calling addAnalysisSetting');
      addAnalysisSetting(setData, settings);
    } else {
      console.log('→ calling updateAnalysisSetting');
      updateAnalysisSetting(setData, 0, settings);
    }
  };

  return (
    <>
      <div className="analysis-wrapper">

        <div className="analysis-container">
          <h2>Analysis Settings</h2>

          <label>
            Constraints:
            <select
              value={settings.constraints}
              onChange={e => handleChange('constraints', e.target.value)}
            >
              <option value="Plain">Plain</option>
              <option value="Penalty">Penalty</option>
            </select>
          </label>

          <label>
            System:
            <select
              value={settings.system}
              onChange={e => handleChange('system', e.target.value)}
            >
              <option value="BandSPD">BandSPD</option>
              <option value="BandGeneral">BandGeneral</option>
              <option value="SparseGeneral">SparseGeneral</option>
            </select>
          </label>

          <label>
            Numberer:
            <select
              value={settings.numberer}
              onChange={e => handleChange('numberer', e.target.value)}
            >
              <option value="RCM">RCM</option>
              <option value="Plain">Plain</option>
            </select>
          </label>

          <label>
            Integrator Type:
            <select
              value={settings.integrator.type}
              onChange={e => handleIntegratorTypeChange(e.target.value)}
            >
              <option value="LoadControl">LoadControl</option>
              <option value="DisplacementControl">DisplacementControl</option>
            </select>
          </label>

          <label>
            Increment (incr):
            <input
              type="number"
              step="0.01"
              value={settings.integrator.incr}
              onChange={e => handleIntegratorIncrChange(e.target.value)}
            />
          </label>

          <label>
            Algorithm:
            <select
              value={settings.algorithm}
              onChange={e => handleChange('algorithm', e.target.value)}
            >
              <option value="Linear">Linear</option>
              <option value="Newton">Newton</option>
            </select>
          </label>

          <label>
            Analysis Type:
            <select
              value={settings.analysis.type}
              onChange={e => handleAnalysisTypeChange(e.target.value)}
            >
              <option value="Static">Static</option>
              <option value="Dynamic">Dynamic</option>
            </select>
          </label>

          <label>
            Steps:
            <input
              type="number"
              value={settings.analysis.steps}
              onChange={e => handleAnalysisStepsChange(e.target.value)}
            />
          </label>

          <button className="save-button" onClick={handleSave}>
            Save Analysis Settings
          </button>
        </div>

        <div className="socket-wrapper">
          <SocketConnect />
        </div>
      </div>
    </>
  );
};

export default Analysis;
