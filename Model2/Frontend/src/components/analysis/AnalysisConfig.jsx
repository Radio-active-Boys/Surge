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
        // Optional: validate structure
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
    clearResults();  // clear previous result data in store

    // Build payload
    let fullPayload;
    if (importedJson) {
      fullPayload = importedJson;
      importModel(fullPayload)
    } else {
      const modelJson = useModelStore.getState().toJson();
      const analysisJson = useAnalysisStore.getState().toJson();
      fullPayload = { ...modelJson, ...analysisJson };
    }

    try {
      const response = await runAnalysis(fullPayload);
      if (response.status === 'success') {
        // Local state for inline render if desired
        setResults(response);
        // Populate global store with broken-out data
        setResultData(response);
      } else {
        const msg = response.message || 'Analysis failed with an unknown error.';
        setError(msg);
        // Still populate store so downstream can show errors
        setResultData({
          status: 'failure',
          errors: [msg],
          warnings: response.warnings || [],
          monitoring: null,
          recorders: null,
          model: null,
          output_dir: null,
          // other fields can be omitted or null
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
      {/* File import section */}
      <div className="import-section mb-4">
        <label className="import-label font-medium">Import JSON Config:</label>
        <input
          key={inputKey}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="import-input mt-1"
        />
        {importFileName && (
          <div className="import-info text-sm text-gray-700">
            Selected file: <strong>{importFileName}</strong>
            <button
              onClick={handleClearImport}
              className="ml-2 text-red-600 hover:underline"
              type="button"
            >
              Clear
            </button>
          </div>
        )}
        {importError && (
          <div className="import-error text-red-600 text-sm">
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
        ) : 'Run Analysis'}
      </button>

      {error && (
        <div className="error-message mt-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Inline display: renders immediate results if desired */}
      {results && (
        <div className="results-section mt-6">
          <ResultsVisualizer results={results} />
        </div>
      )}
    </div>
  );
};

export default AnalysisConfig;
