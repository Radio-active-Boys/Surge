// src/components/visualization/ResultControls.jsx
import React from 'react';
import {useResultStore} from '../../stores/useResultStore';

const ResultControls = () => {
  const {
    viewMode,
    scaleFactor,
    diagramType,
    setViewMode,
    setScaleFactor,
    setDiagramType
  } = useResultStore();

  return (
    <div className="result-controls">
      <div className="control-group">
        <label>View Mode:</label>
        <select 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value)}
        >
          <option value="undeformed">Undeformed</option>
          <option value="deformed">Deformed</option>
          <option value="both">Both</option>
        </select>
      </div>
      
      <div className="control-group">
        <label>Deformation Scale:</label>
        <input 
          type="range" 
          min="1" 
          max="50" 
          value={scaleFactor} 
          onChange={(e) => setScaleFactor(Number(e.target.value))}
        />
        <span>{scaleFactor}x</span>
      </div>
      
      <div className="control-group">
        <label>Diagram Type:</label>
        <select 
          value={diagramType} 
          onChange={(e) => setDiagramType(e.target.value)}
        >
          <option value="axial">Axial Force</option>
          <option value="shear">Shear Force</option>
          <option value="moment">Bending Moment</option>
          <option value="deformation">Deformation</option>
        </select>
      </div>
    </div>
  );
};

export default ResultControls;