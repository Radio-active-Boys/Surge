import React, { createContext, useContext, useState } from 'react';

// Initial shape of the shared data
const initialData = {
  nodes: [],
  elements: [],
  forces: [],
  supports: []
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

// CRUD helpers
export const addNode       = (setData, node)       => setData(d => ({ ...d, nodes: [...d.nodes, node] }));
export const addElement    = (setData, el)         => setData(d => ({ ...d, elements: [...d.elements, el] }));
export const addForce      = (setData, f)          => setData(d => ({ ...d, forces: [...d.forces, f] }));
export const addSupport    = (setData, s)          => setData(d => ({ ...d, supports: [...d.supports, s] }));
export const updateForce = (setData, idx, newForce) =>  setData(d => {const forces = [...d.forces]; forces[idx] = newForce; return {...d, forces }; });
export const updateSupport = (setData, idx, newSupport) => setData(d => {const supports = [...d.supports]; supports[idx] = newSupport; return { ...d, supports }; });
export const updateNode = (setData, idx, newNode) =>
  setData(d => {
    const nodes = [...d.nodes];
    nodes[idx] = newNode;
    return { ...d, nodes };
  });

export const updateElement = (setData, idx, newEl) =>
  setData(d => {
    const elements = [...d.elements];
    elements[idx] = newEl;
    return { ...d, elements };
  });