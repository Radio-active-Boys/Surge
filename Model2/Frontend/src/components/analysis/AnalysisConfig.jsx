// src/components/analysis/AnalysisConfig.jsx
import { useState } from 'react';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { useModelStore } from '../../stores/useModelStore';
import { runAnalysis } from '../../api/openseesService';
import ResultsVisualizer from './ResultsVisualizer';
import './AnalysisConfig.css';

const AnalysisConfig = () => {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for imported JSON payload
  const [importedJson, setImportedJson] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importFileName, setImportFileName] = useState('');

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
        // Optional: you can add validation here, e.g., check required keys like "nodes", "analysis_sequence", etc.
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

  // Optionally: function to load importedJson into zustand stores, if structure matches your store schema.
  const loadIntoStores = () => {
    if (!importedJson) return;
    // Example: if your JSON has keys like "model", "node", etc matching your store keys.
    // WARNING: this is highly dependent on the shape of importedJson. Adapt as needed.
    const modelStore = useModelStore.getState();
    const analysisStore = useAnalysisStore.getState();

    // Clear existing store contents? You might need methods to reset the stores.
    // For example, if your stores had `clearAll()` method, call it here. If not, you can individually remove components:
    // (Assuming each category array is in state and you have removeComponent; 
    // but you’d need the IDs. Alternatively, you might rebuild the store from scratch; but Zustand doesn’t provide built-in reset unless you code it.)
    // Here, we'll assume you just send the imported JSON to backend, without updating stores.

    // If you really want to update the stores to reflect imported JSON:
    // 1. You need to define in your store a reset or initialize function.
    // 2. Then iterate through importedJson keys and dispatch addComponent or set state directly.
    // E.g.:
    // if (importedJson.nodes) {
    //   importedJson.nodes.forEach(nodeCmd => {
    //     // You need a template matching function; if imported JSON already has command objects, 
    //     // you might bypass the template system and store raw commands in state, 
    //     // but that requires your components to handle raw commands as well.
    //   });
    // }
    // For now, we skip store-loading and just send to backend.
  };

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    // Decide payload: importedJson if present, else build from stores
    let fullPayload;
    if (importedJson) {
      fullPayload = importedJson;
    } else {
      const modelJson = useModelStore.getState().toJson();
      const analysisJson = useAnalysisStore.getState().toJson();
      fullPayload = { ...modelJson, ...analysisJson };
    }

    try {
      const response = await runAnalysis(fullPayload);
      if (response.status === 'success') {
        setResults(response);
      } else {
        setError(response.message || 'Analysis failed with an unknown error.');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearImport = () => {
    setImportedJson(null);
    setImportError(null);
    setImportFileName('');
    // Also clear the file input value. We can use a ref, or simpler: reset the input via key change.
    // Easiest: force re-render of <input> by changing its key. We'll handle that below.
    setInputKey((prev) => prev + 1);
  };

  // To reset file input, we use a key on the input element:
  const [inputKey, setInputKey] = useState(0);

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

      {/* Optionally: button to load into stores */}
      {/* 
      {importedJson && (
        <button
          onClick={() => {
            loadIntoStores();
            // Possibly show a message like "Loaded into UI stores"
          }}
          className="load-stores-button mb-4 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          type="button"
        >
          Load into UI
        </button>
      )} 
      */}

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

      {results && (
        <div className="results-section mt-6">
          <ResultsVisualizer results={results} />
        </div>
      )}
    </div>
  );
};

export default AnalysisConfig;
