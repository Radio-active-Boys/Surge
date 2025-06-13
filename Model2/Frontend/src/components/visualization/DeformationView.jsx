// src/components/visualization/DeformationView.jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DeformationView = ({ elementId, elementData, recorderData }) => {
  if (!elementId || !elementData) return null;

  // Extract deformation data from recorders
  const deformationData = useMemo(() => {
    if (!recorderData || !elementId) return [];
    
    const recorderKey = `elem${elementId}_section_deformations.txt`;
    const recorder = recorderData[recorderKey];
    
    if (!recorder || !recorder.isNumeric) return [];
    
    // Format: [position, axial, curvatureY, curvatureZ]
    return recorder.data.map((row, index) => {
      const position = row[0]; // Position along element
      const deformation = row[1]; // Axial deformation
      
      return {
        position,
        deformation,
        elementLength: recorder.data[recorder.data.length - 1][0]
      };
    });
  }, [recorderData, elementId]);

  if (deformationData.length === 0) {
    return (
      <div className="deformation-view">
        <h3>Deformation - Element {elementId}</h3>
        <div className="no-data">
          No deformation data available for this element
        </div>
      </div>
    );
  }

  return (
    <div className="deformation-view">
      <h3>Deformation - Element {elementId}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={deformationData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="position" 
            label={{ value: 'Position Along Element (m)', position: 'insideBottom', offset: -5 }} 
          />
          <YAxis 
            label={{ value: 'Deformation (m)', angle: -90, position: 'insideLeft' }} 
          />
          <Tooltip formatter={(value) => [value.toFixed(6), 'Deformation (m)']} />
          <Line 
            type="monotone" 
            dataKey="deformation" 
            stroke="#8b5cf6" 
            strokeWidth={2} 
            dot={false} 
            activeDot={{ r: 6 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DeformationView;