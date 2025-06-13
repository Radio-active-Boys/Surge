// src/stores/useResultStore.js
import { create } from 'zustand';

export const useResultStore = create((set) => ({
  // Raw full results if you ever need it
  fullResults: null,

  // Broken-out fields for easy subscription
  status: null,         // e.g., 'success', 'failure', 'error'
  errors: [],           // array of error messages
  warnings: [],         // array of warnings
  monitoring: null,     // e.g., { time_history: [...] }
  recorders: null,      // e.g., { "file1.txt": { data: [...], type: "...", ... }, ... }
  model: null,          // final model state if provided
  outputDir: null,      // output directory string if provided

  // Visualization-related state
  selectedElement: null,
  selectedNode: null,
  viewMode: 'undeformed', // 'undeformed', 'deformed', 'both'
  scaleFactor: 5,
  diagramType: 'axial',  // 'axial', 'shear', 'moment', 'deformation'

  // Action: set all result data at once
  setResultData: (res) => {
    // res is the full response from backend
    set({
      fullResults: res,
      status: res.status || null,
      errors: res.errors || [],
      warnings: res.warnings || [],
      monitoring: res.monitoring || null,
      recorders: res.recorders || null,
      model: res.model || null,
      outputDir: res.output_dir || res.outputDir || null,
      // visualization selections cleared on new data
      selectedElement: null,
      selectedNode: null,
      // Optionally reset viewMode/diagramType if desired:
      // viewMode: 'undeformed',
      // diagramType: 'axial',
    });
  },

  // Clear all result data
  clearResults: () => {
    set({
      fullResults: null,
      status: null,
      errors: [],
      warnings: [],
      monitoring: null,
      recorders: null,
      model: null,
      outputDir: null,
      selectedElement: null,
      selectedNode: null,
      // Optionally reset viewMode/diagramType:
      // viewMode: 'undeformed',
      // diagramType: 'axial',
    });
  },

  // Visualization actions
  selectElement: (elementId) => set({ selectedElement: elementId }),
  selectNode: (nodeId) => set({ selectedNode: nodeId }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setScaleFactor: (factor) => set({ scaleFactor: factor }),
  setDiagramType: (type) => set({ diagramType: type }),
}));
