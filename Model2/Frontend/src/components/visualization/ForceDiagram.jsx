// src/components/visualization/ForceDiagram.jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ForceDiagram = ({ elementId, diagramType, elementData, recorderData }) => {
  if (!elementId || !elementData) {
    return (
      <div className="diagram-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.75.75H7.5a.75.75 0 010-1.5h9a.75.75 0 01.75.75z" clipRule="evenodd" />
        </svg>
        <p>Select an element to view force diagrams</p>
      </div>
    );
  }

  // Extract section force data from recorders
  const sectionData = useMemo(() => {
    if (!recorderData || !elementId) return [];
    
    const recorderKey = `elem${elementId}_section_forces.txt`;
    const recorder = recorderData[recorderKey];
    
    if (!recorder || !recorder.isNumeric) return [];
    
    // Format: [position, axial, shearY, shearZ, torsion, momentY, momentZ]
    return recorder.data.map((row, index) => {
      const position = row[0]; // Position along element
      let value;
      
      switch(diagramType) {
        case 'axial':
          value = row[1]; // Axial force
          break;
        case 'shear':
          value = row[2]; // Shear force
          break;
        case 'moment':
          value = row[5]; // Bending moment
          break;
        default:
          value = 0;
      }
      
      return {
        position,
        value,
        elementLength: recorder.data[recorder.data.length - 1][0]
      };
    });
  }, [recorderData, elementId, diagramType]);

  if (sectionData.length === 0) {
    return (
      <div className="diagram-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.75.75H7.5a.75.75 0 010-1.5h9a.75.75 0 01.75.75z" clipRule="evenodd" />
        </svg>
        <p>No section force data available for element {elementId}</p>
      </div>
    );
  }

  // Determine diagram labels
  const diagramLabels = {
    axial: 'Axial Force (N)',
    shear: 'Shear Force (N)',
    moment: 'Bending Moment (N·m)',
    deformation: 'Deformation (m)'
  };

  return (
    <div className="force-diagram">
      <h3>{diagramLabels[diagramType]} Diagram - Element {elementId}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={sectionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="position" 
            label={{ value: 'Position Along Element (m)', position: 'insideBottom', offset: -5 }} 
          />
          <YAxis 
            label={{ value: diagramLabels[diagramType], angle: -90, position: 'insideLeft' }} 
          />
          <Tooltip formatter={(value) => [value.toFixed(2), diagramLabels[diagramType]]} />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={false} 
            activeDot={{ r: 6 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ForceDiagram;