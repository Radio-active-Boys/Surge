// src/stores/useModelStore.js
import { create } from 'zustand';
import { generateCommand, getTemplateByName } from '../api/jsonTemplates';
import { generateId } from '../utils/idGenerator';

export const useModelStore = create((set, get) => ({
  modelConfig: { ndm: 2, ndf: 2 },

  // core arrays
  node: [],
  boundaryConditions: [],
  uniaxialMaterial: [],
  section: [],      // items: { id, command, templateName, args, params, fibers: [] }
  element: [],
  geomTransf: [],
  beamIntegration: [],
  patterns: [],
  loads: [],        // holds load / eleLoad / sp entries
  timeSeries: [],

  // merge without overwriting
  setModelConfig: config =>
    set(state => ({ modelConfig: { ...state.modelConfig, ...config } })),

  // universal addComponent
  addComponent: (category, templateName, params, parentId = null) => {
    const tpl = getTemplateByName(category, templateName);
    if (!tpl) return;
    const id = generateId();
    const { command, args } = generateCommand(tpl, params);

    // 1) section
    if (category === 'section') {
      set(state => ({
        section: [
          ...state.section,
          { id, command, templateName, args, params: { ...params }, fibers: [] }
        ]
      }));
      return;
    }

    // 2) fiber / patch / layer
    if (['fiber','patch','layer'].includes(category)) {
      if (!parentId) return;
      const fiberId = generateId();
      const newFiber = { id: fiberId, category, command, templateName, args, params: { ...params } };
      set(state => ({
        section: state.section.map(sec =>
          sec.id !== parentId
            ? sec
            : { ...sec, fibers: [...(sec.fibers||[]), newFiber] }
        )
      }));
      return;
    }

    // 3) pattern
    if (category === 'pattern') {
      set(state => ({
        patterns: [
          ...state.patterns,
          { id, category, templateName, params: { ...params }, command, args }
        ]
      }));
      return;
    }

    // 4) loads / eleLoad / sp — all into `loads[]`
    if (['load','eleLoad','sp'].includes(category)) {
      if (!parentId) return;
      set(state => ({
        loads: [
          ...state.loads,
          { id, patternId: parentId, category, command, args }
        ]
      }));
      return;
    }

    // 5) all other generic categories
    const arrMap = {
      node: 'node',
      boundaryConditions: 'boundaryConditions',
      uniaxialMaterial: 'uniaxialMaterial',
      element: 'element',
      geomTransf: 'geomTransf',
      beamIntegration: 'beamIntegration',
      timeSeries: 'timeSeries'
    };
    const arrName = arrMap[category] || null;
    if (!arrName) return;

    const item = { id, command, args, category };
    if (['uniaxialMaterial','element','timeSeries','section','geomTransf','beamIntegration'].includes(category)) {
      item.templateName = templateName;
      item.params = { ...params };
    }
    set(state => ({ [arrName]: [...(state[arrName]||[]), item] }));
  },

  // update section / fibers / pattern
  updateComponent: (category, id, newParams) => {
    const state = get();

    // section
    if (category === 'section') {
      const sec = state.section.find(s => s.id === id);
      if (!sec) return;
      const tpl = getTemplateByName('section', sec.templateName);
      if (!tpl) return;
      const { command, args } = generateCommand(tpl, newParams);
      set(state => ({
        section: state.section.map(s =>
          s.id !== id ? s : { ...s, params: { ...newParams }, command, args }
        )
      }));
      return;
    }

    // fiber / patch / layer
    if (['fiber','patch','layer'].includes(category)) {
      set(state => ({
        section: state.section.map(sec => {
          const idx = sec.fibers.findIndex(f => f.id === id);
          if (idx === -1) return sec;
          const fiber = sec.fibers[idx];
          const tpl = getTemplateByName(category, fiber.templateName);
          if (!tpl) return sec;
          const { command, args } = generateCommand(tpl, newParams);
          const updated = { ...fiber, params: { ...newParams }, command, args };
          const fibers = [...sec.fibers];
          fibers[idx] = updated;
          return { ...sec, fibers };
        })
      }));
      return;
    }

    // pattern
    if (category === 'pattern') {
      const pat = state.patterns.find(p => p.id === id);
      if (!pat) return;
      const tpl = getTemplateByName('pattern', pat.templateName);
      if (!tpl) return;
      const { command, args } = generateCommand(tpl, newParams);
      set(state => ({
        patterns: state.patterns.map(p =>
          p.id !== id ? p : { ...p, params: { ...newParams }, command, args }
        )
      }));
      return;
    }
  },

  // unified removeComponent
  removeComponent: (category, id) => {
    // section
    if (category === 'section') {
      set(state => ({ section: state.section.filter(s => s.id !== id) }));
      return;
    }
    // fibers
    if (['fiber','patch','layer'].includes(category)) {
      set(state => ({
        section: state.section.map(sec => ({
          ...sec,
          fibers: sec.fibers.filter(f => f.id !== id)
        }))
      }));
      return;
    }
    // pattern
    if (category === 'pattern') {
      set(state => ({
        patterns: state.patterns.filter(p => p.id !== id),
        loads: state.loads.filter(l => l.patternId !== id)
      }));
      return;
    }
    // any load type
    if (['load','eleLoad','sp'].includes(category)) {
      set(state => ({ loads: state.loads.filter(l => l.id !== id) }));
      return;
    }
    // generic arrays
    const arrMap = {
      node: 'node',
      boundaryConditions: 'boundaryConditions',
      uniaxialMaterial: 'uniaxialMaterial',
      element: 'element',
      geomTransf: 'geomTransf',
      beamIntegration: 'beamIntegration',
      timeSeries: 'timeSeries'
    };
    const arrName = arrMap[category];
    if (arrName) {
      set(state => ({
        [arrName]: state[arrName].filter(item => item.id !== id)
      }));
    }
  },
updateComponentArgs: (category, id, newArgs) => {
  const state = get();

  // SECTION
  if (category === 'section') {
    set(state => ({
      section: state.section.map(s =>
        s.id === id ? { ...s, args: newArgs } : s
      )
    }));
    return;
  }

  // PATTERNS
  if (category === 'patterns') {
    set(state => ({
      patterns: state.patterns.map(p =>
        p.id === id ? { ...p, args: newArgs } : p
      )
    }));
    return;
  }

  // LOADS (load / eleLoad / sp)
  if (category === 'loads') {
    set(state => ({
      loads: state.loads.map(l =>
        l.id === id ? { ...l, args: newArgs } : l
      )
    }));
    return;
  }

  // STANDARD categories (node, element, etc.)
  const arrMap = {
    node: 'node',
    boundaryConditions: 'boundaryConditions',
    uniaxialMaterial: 'uniaxialMaterial',
    element: 'element',
    geomTransf: 'geomTransf',
    beamIntegration: 'beamIntegration',
    timeSeries: 'timeSeries',
  };
  const arrName = arrMap[category];
  if (!arrName) return;

  set(state => ({
    [arrName]: state[arrName].map(item =>
      item.id === id ? { ...item, args: newArgs } : item
    )
  }));
},

  // export to JSON
  toJson: () => {
    const s = get();
    return {
      model_config: s.modelConfig,
      nodes: s.node.map(i => ({ command: i.command, args: i.args })),
      boundary_conditions: s.boundaryConditions.map(i => ({ command: i.command, args: i.args })),
      materials: s.uniaxialMaterial.map(i => ({ command: i.command, name: i.templateName, args: i.args })),
      sections: s.section.map(sec => ({
        command: sec.command,
        name: sec.templateName,
        args: sec.args,
        fibers: sec.fibers.map(f => ({ command: f.command, name: f.templateName, args: f.args }))
      })),
      transformations: s.geomTransf.map(i => ({ command: i.command, name: i.templateName, args: i.args })),
      integrations: s.beamIntegration.map(i => ({ command: i.command, name: i.templateName, args: i.args })),
      elements: s.element.map(i => ({ command: i.command, name: i.templateName, args: i.args })),
      patterns: s.patterns.map(p => ({
        command: p.command,
        name: p.templateName,
        args: p.args,
        loads: s.loads
          .filter(l => l.patternId === p.id)
          .map(l => ({ command: l.command, args: l.args }))
      })),
      time_series: s.timeSeries.map(i => ({ command: i.command, name: i.templateName, args: i.args }))
    };
  }
}));
