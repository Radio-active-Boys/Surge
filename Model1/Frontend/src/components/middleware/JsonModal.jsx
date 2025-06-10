import React from 'react';
import { useDataCentre } from './DataHandler/DataCentreTruss2D';
import './JsonModal.css';
 
const JsonModal = ({ show, onClose }) => {
  const { data, setData } = useDataCentre();
  if (!show) return null;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'exported-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target.result.trim());
        setData(json);
      } catch (err) {
        alert(`Invalid JSON:\n${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file, 'utf-8');
  };

 return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>JSON Data</h3>
        <pre className="modal-content">{JSON.stringify(data, null, 2)}</pre>
        <div className="button-group">
          <button className="close-button" onClick={onClose}>
            Close
          </button>
          <button className="export-button" onClick={exportData}>
            Export
          </button>
          <label className="import-button">
            Import
            <input
              type="file"
              accept=".json,application/json"
              onChange={importData}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};


export default JsonModal;
