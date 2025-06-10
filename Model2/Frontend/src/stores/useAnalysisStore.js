 import { create } from 'zustand';
import { generateCommand, getTemplateByName } from '../api/jsonTemplates';

let globalId = 1;  

export const useAnalysisStore = create((set, get) => ({
  // Analysis state
  constraints: [],
  numberer: [],
  system: [],
  algorithm: [],
  integrator: [],
  analysis: [],
  analyze: [],
  recorder: [],


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
    constraints: s.constraints,
    numberer: s.numberer,
    system: s.system,
    algorithm: s.algorithm,
    integrator: s.integrator,
    analysis: s.analysis,
    analyze: s.analyze,
    recorder: s.recorder,
    };
  }
}));
