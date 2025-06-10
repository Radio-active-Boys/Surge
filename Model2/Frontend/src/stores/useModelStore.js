import { create } from 'zustand';
import { generateCommand, getTemplateByName } from '../api/jsonTemplates';

let globalId = 1;  

export const useModelStore = create((set, get) => ({
  // Model state
  model: [],
  node: [],
  boundryConditions: [],
  uniaxialMaterial: [],
  section: [],
  element: [],
  geomTransf: [],
  beamIntegration: [],
  pattern: [],
  timeSeries: [],

  setModelConfig: (config) => set({ modelConfig: config }),

  addComponent: (category, templateName, params) => {
    const template = getTemplateByName(category, templateName);
    if (!template) return;

    const command = {
      ...generateCommand(template, params),
      id: globalId++ 
    };

    set(state => ({
      [category]: [...state[category], command]
    }));

    console.log("command ", command);
  },

  updateComponent: (category, id, updates) => {
    set(state => ({
      [category]: state[category].map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  },

  removeComponent: (category, id) => {
    set(state => ({
      [category]: state[category].filter(item => item.id !== id)
    }));
  },

  toJson: () => {
    const s = get();
    return {
      model:           s.model,
      node:            s.node,
      supports:        s.boundryConditions,
      materials:       s.uniaxialMaterial,
      sections:        s.section,
      elements:        s.element,
      transformations: s.geomTransf,
      integrations:    s.beamIntegration,
      pattern:         s.pattern,
      timeSeries:      s.timeSeries,
    };
  }
}));
