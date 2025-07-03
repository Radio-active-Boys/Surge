// src/components/analysis/AnalysisConfig.jsx

import { useState } from 'react';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { useModelStore } from '../../stores/useModelStore';
import { useResultStore } from '../../stores/useResultStore';
import { runAnalysis } from '../../api/openseesService';
import ResultsVisualizer from './ResultsVisualizer';
import { importModel } from '../../utils/modelUtils';
import './AnalysisConfig.css';

const AnalysisConfig = () => {
  // Local UI state
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for imported JSON payload
  const [importedJson, setImportedJson] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [inputKey, setInputKey] = useState(0);

  // Zustand store actions
  const setResultData = useResultStore((state) => state.setResultData);
  const clearResults = useResultStore((state) => state.clearResults);

  // Handler for file input change
  const handleFileChange = (e) => {
    setImportError(null);
    setImportedJson(null);
    setImportFileName('');

    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('Please select a .json file');
      return;
    }
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = JSON.parse(text);
        setImportedJson(parsed);
      } catch (err) {
        console.error('JSON parse error:', err);
        setImportError('Invalid JSON file: ' + err.message);
      }
    };
    reader.onerror = (err) => {
      console.error('File read error:', err);
      setImportError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    clearResults(); // clear previous result data in store

    // Build payload
    let fullPayload;
    if (importedJson) {
      fullPayload = importedJson;
      importModel(fullPayload);
    } else {
      const modelJson = useModelStore.getState().toJson();
      const analysisJson = useAnalysisStore.getState().toJson();
      fullPayload = { ...modelJson, ...analysisJson };
    }

    try {
      const response = await runAnalysis(fullPayload);

      if (response.status === 'success') {
        setResults(response);
        setResultData(response);
      } else {
        let msg = response.message || 'Analysis failed.';
        if (Array.isArray(response.errors)) {
          const errorMsgs = response.errors.map(e =>
            typeof e === 'string'
              ? e
              : e.stderr || e.error || JSON.stringify(e)
          );
          msg += ' ' + errorMsgs.join('; ');
        }
        setError(msg);
        setResultData({
          status: 'failure',
          errors: response.errors || [msg],
          warnings: response.warnings || [],
          monitoring: null,
          recorders: null,
          model: null,
          output_dir: response.output_dir || null,
        });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      const msg = err.message || 'An unexpected error occurred.';
      setError(msg);
      setResultData({
        status: 'error',
        errors: [msg],
        warnings: [],
        monitoring: null,
        recorders: null,
        model: null,
        output_dir: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearImport = () => {
    setImportedJson(null);
    setImportError(null);
    setImportFileName('');
    setInputKey((prev) => prev + 1);
  };

  return (
    <div className="analysis-container">
      {/* Import & Download Controls */}
      <div className="import-section mb-4">

        <div className="flex items-center gap-4">
            <div className="file-upload-wrapper">
              <input
                id="json-upload"
                key={inputKey}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden-input"
              />
              <label htmlFor="json-upload" className="import-button">
                📁 Import Model
              </label>
            </div>

          <button
            className="download-button"
            onClick={() => {
              const modelJson = useModelStore.getState().toJson();
              const analysisJson = useAnalysisStore.getState().toJson();
              const fullPayload = { ...modelJson, ...analysisJson };
              const blob = new Blob(
                [JSON.stringify(fullPayload, null, 2)],
                { type: 'application/json' }
              );
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = 'model_config.json';
              link.click();
            }}
          >
            ⬇️ Download Model
          </button>
        </div>

{importFileName && (
  <div className="file-pill mt-3">
    <span className="file-name">{importFileName}</span>
    <button
      onClick={handleClearImport}
      className="file-clear-btn"
      type="button"
      aria-label="Clear imported file"
    >
      ✖
    </button>
  </div>
)}

        {importError && (
          <div className="import-error text-red-600 text-sm mt-1">
            {importError}
          </div>
        )}
      </div>

      {/* Run Analysis */}
      <button
        onClick={handleRunAnalysis}
        disabled={isLoading}
        className={`analysis-button ${isLoading ? 'loading' : ''}`}
      >
        {isLoading ? (
          <span className="button-content">
            <span className="spinner"></span>
            Running Analysis...
          </span>
        ) : (
          '🚀 Run Analysis'
        )}
      </button>

      {error && (
        <div className="error-message mt-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {results && (
        <div className="result-message mt-4">
          <strong>✅ Results are ready!</strong>
          <ResultsVisualizer data={results} />
        </div>
      )}
    </div>
  );
};

export default AnalysisConfig;
