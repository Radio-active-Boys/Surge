// src/components/analysis/AnalysisConfig.jsx
import { useState } from 'react';
import { useAnalysisStore } from '../../stores/useAnalysisStore';
import { useModelStore } from '../../stores/useModelStore';
import { useResultStore } from '../../stores/useResultStore';
import { runAnalysis,cleanupOutput } from '../../api/openseesService';
import { importModel } from '../../utils/modelUtils';
import './AnalysisConfig.css';

const AnalysisConfig = () => {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [importedJson, setImportedJson] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [inputKey, setInputKey] = useState(0);

  const setResultData = useResultStore((state) => state.setResultData);
  const clearResults = useResultStore((state) => state.clearResults);

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
  clearResults();

  let fullPayload;
  if (importedJson) {
    fullPayload = importedJson;
    importModel(fullPayload);
  } else {
    const modelJson = useModelStore.getState().toJson();
    const analysisJson = useAnalysisStore.getState().toJson();
    fullPayload = { ...modelJson, ...analysisJson };
  }

  if (!fullPayload.nodes || fullPayload.nodes.length === 0) {
    setError("You must define at least one node before running analysis.");
    setIsLoading(false);
    return;
  }

  try {
    const response = await runAnalysis(fullPayload);

    if (response.status === "success") {
      setResults(response);
      setResultData(response);

      // ✅ Automatically run cleanup in the background
      if (response.output_dir) {
        cleanupOutput(response.output_dir).catch((err) => {
          console.warn("Cleanup failed:", err);
        });
      }

    } else {
      let msg = "Analysis failed. Please verify loading and boundary conditions.";

      if (Array.isArray(response.errors) && response.errors.length > 0) {
        const errorMsgs = response.errors.map(e => {
          if (typeof e === "string") return e;

          // Safely construct a detailed error message
          const command = e.command || "unknown";
          const args = Array.isArray(e.args) ? e.args.join(", ") : e.args || "none";
          const errorText = e.error || "";

          return `Model build failed due to "${command}" command with args [${args}]`;
        });

        msg = errorMsgs.join("; ");
      } else if (typeof response.message === "string" && response.message.trim() !== "") {
        msg = response.message;
      }

      setError(msg);

      setResultData({
        status: false,
        errors: response.errors || [msg],
        warnings: response.warnings || [],
        monitoring: null,
        recorders: null,
        model: null,
        output_dir: response.output_dir || null,
      });

      // Optional: you can still clean up even if it failed
      if (response.output_dir) {
        cleanupOutput(response.output_dir).catch((err) => {
          console.warn("Cleanup failed :", err);
        });
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    const msg = err.message || "An unexpected error occurred.";
    setError(msg);
    setResultData({
      status: false,
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
      <div className="button-row">
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
      </div>

      {importFileName && (
        <div className="file-pill ">
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

      {error && (
        <div className="error-message mt-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {results && (
        <div className="result-message mt-4">
          <strong>✅ Results are ready!</strong>
        </div>
      )}
    </div>
  );
};

export default AnalysisConfig;
