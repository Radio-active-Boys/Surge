// DataCentre.jsx

import React, { createContext, useContext, useState } from 'react';

// Initial shape of the shared data
const initialData = {
  metadata: {},                
  nodes: [],
  elements: [],
  forces: [],
  supports: [],
  materials: [],
  load_patterns: [],
  analysis_settings: {}        
};

const DataCentreContext = createContext();
export const DataCentreProvider = ({ children }) => {
  const [data, setData] = useState(initialData);
  return (
    <DataCentreContext.Provider value={{ data, setData }}>
      {children}
    </DataCentreContext.Provider>
  );
};

export const useDataCentre = () => {
  const ctx = useContext(DataCentreContext);
  if (!ctx) throw new Error('useDataCentre must be inside DataCentreProvider');
  return ctx;
};

// Nodes
export const addNode    = (setData, node)         => setData(d => ({ ...d, nodes: [...d.nodes, node] }));
export const updateNode = (setData, idx, newNode) => setData(d => {
  const nodes = [...d.nodes];
  nodes[idx] = newNode;
  return { ...d, nodes };
});

// Elements
export const addElement    = (setData, el)           => setData(d => ({ ...d, elements: [...d.elements, el] }));
export const updateElement = (setData, idx, newEl)   => setData(d => {
  const elements = [...d.elements];
  elements[idx] = newEl;
  return { ...d, elements };
});

// Forces
export const addForce    = (setData, f)            => setData(d => ({ ...d, forces: [...d.forces, f] }));
export const updateForce = (setData, idx, newForce) => setData(d => {
  const forces = [...d.forces];
  forces[idx] = newForce;
  return { ...d, forces };
});

// Supports
export const addSupport    = (setData, s)              => setData(d => ({ ...d, supports: [...d.supports, s] }));
export const updateSupport = (setData, idx, newSupport) => setData(d => {
  const supports = [...d.supports];
  supports[idx] = newSupport;
  return { ...d, supports };
});

// Materials
export const addMaterial    = (setData, mat)          => setData(d => ({ ...d, materials: [...d.materials, mat] }));
export const updateMaterial = (setData, idx, newMat)  => setData(d => {
  const materials = [...d.materials];
  materials[idx] = newMat;
  return { ...d, materials };
});

// Load Patterns
export const addLoadPattern    = (setData, load)              => setData(d => ({ ...d, load_patterns: [...d.load_patterns, load] }));
export const updateLoadPattern = (setData, idx, newLoadPattern) => setData(d => {
  const load_patterns = [...d.load_patterns];
  load_patterns[idx] = newLoadPattern;
  return { ...d, load_patterns };
});

// ### METADATA as a SINGLE OBJECT (unchanged) ###
export const addMetadata    = (setData, meta)           => setData(d => ({ ...d, metadata: { ...meta } }));
export const updateMetadata = (setData, idxIgnored, newMeta) => setData(d => ({
  ...d,
  metadata: { ...newMeta }
}));

// ### ANALYSIS SETTINGS as a SINGLE OBJECT ###
export const addAnalysisSetting = (setData, setting) => 
  setData(d => ({ ...d, analysis_settings: { ...setting } }));

export const updateAnalysisSetting = (setData, idxIgnored, newSetting) => 
  setData(d => ({
    ...d,
    analysis_settings: { ...newSetting }
  }));

// delete helpers (unchanged)
export const removeNode           = (setData, idx) => setData(d => ({ ...d, nodes: d.nodes.filter((_, i) => i !== idx) }));
export const removeElement        = (setData, idx) => setData(d => ({ ...d, elements: d.elements.filter((_, i) => i !== idx) }));
export const removeForce          = (setData, idx) => setData(d => ({ ...d, forces: d.forces.filter((_, i) => i !== idx) }));
export const removeSupport        = (setData, idx) => setData(d => ({ ...d, supports: d.supports.filter((_, i) => i !== idx) }));
export const removeMaterial       = (setData, idx) => setData(d => ({ ...d, materials: d.materials.filter((_, i) => i !== idx) }));
export const removeLoadPattern    = (setData, idx) => setData(d => ({ ...d, load_patterns: d.load_patterns.filter((_, i) => i !== idx) }));
export const removeAnalysisSetting = (setData, idx) => setData(d => ({ ...d, analysis_settings: {} }));
