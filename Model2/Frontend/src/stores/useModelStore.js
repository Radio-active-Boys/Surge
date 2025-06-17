// src/stores/useModelStore.js
import { create } from 'zustand';
import { generateCommand, getTemplateByName } from '../api/jsonTemplates';
import { generateId } from '../utils/idGenerator';

export const useModelStore = create((set, get) => ({
  modelConfig: { ndm: 2, ndf: 2 },
  node: [],
  boundaryConditions: [],
  uniaxialMaterial: [],
  section: [],       // each: {id, command, templateName, args, params, fibers: [...]}  
  element: [],
  geomTransf: [],
  beamIntegration: [],

  patterns: [],
  loads: [],
  eleLoads: [],
  sps: [],

  timeSeries: [],

  setModelConfig: (config) => set({ modelConfig: config }),

  addComponent: (category, templateName, params, parentId = null) => {
    const template = getTemplateByName(category, templateName);
    if (!template) return;
    const id = generateId();
    const commandObj = generateCommand(template, params);

    if (category === 'section') {
      const sectionObj = {
        id,
        command: commandObj.command,
        templateName,
        args: commandObj.args,
        params: { ...params },
        fibers: []
      };
      set(state => ({ section: [...state.section, sectionObj] }));
    }
    else if (['fiber', 'patch', 'layer'].includes(category)) {
      if (!parentId) return;
      const fiberId = generateId();
      const fiberObj = {
        id: fiberId,
        category,
        command: commandObj.command,
        templateName,
        args: commandObj.args,
        params: { ...params }
      };
      set(state => {
        const sections = state.section.map(sec => {
          if (sec.id !== parentId) return sec;
          return { ...sec, fibers: [...(sec.fibers || []), fiberObj] };
        });
        return { section: sections };
      });
    }
    if (category === 'pattern') {
      const p = { id, templateName, params: { ...params }, command: commandObj.command, args: commandObj.args, category };
      set(state => ({ patterns: [...state.patterns, p] }));
    }
    else if (category === 'load') {
      if (!parentId) return;
      const cmd = commandObj;
      set(state => ({ loads: [...state.loads, { id, patternId: parentId, command: cmd.command, args: cmd.args, category }] }));
    }
    else {
      const arrName = (() => {
        switch(category) {
          case 'node': return 'node';
          case 'boundaryConditions': return 'boundaryConditions';
          case 'uniaxialMaterial': return 'uniaxialMaterial';
          case 'element': return 'element';
          case 'geomTransf': return 'geomTransf';
          case 'beamIntegration': return 'beamIntegration';
          case 'timeSeries': return 'timeSeries';
          default: return null;
        }
      })();
      if (arrName) {
        const item = { id, command: commandObj.command, args: commandObj.args, category };
        if (['uniaxialMaterial','element','timeSeries','section','geomTransf','beamIntegration'].includes(category)) {
          item.templateName = templateName;
          item.params = { ...params };
        }
        set(state => {
          const arr = state[arrName] || [];
          return { [arrName]: [...arr, item] };
        });
      }
    }
  },

  updateComponent: (category, id, newParams) => {
    if (category === 'section') {
      const state = get();
      const sec = state.section.find(s => s.id === id);
      if (!sec) return;
      const tpl = getTemplateByName('section', sec.templateName);
      if (!tpl) return;
      const cmd = generateCommand(tpl, newParams);
      set(state => ({ section: state.section.map(s => s.id !== id ? s : { ...s, params: { ...newParams }, command: cmd.command, args: cmd.args }) }));
    }
    else if (['fiber','patch','layer'].includes(category)) {
      const state = get();
      set(state => ({ section: state.section.map(sec => {
        const idx = (sec.fibers || []).findIndex(f => f.id === id);
        if (idx === -1) return sec;
        const fiber = sec.fibers[idx];
        const tpl = getTemplateByName(category, fiber.templateName);
        if (!tpl) return sec;
        const cmd = generateCommand(tpl, newParams);
        const newFiber = { ...fiber, params: { ...newParams }, command: cmd.command, args: cmd.args };
        const newFibers = [...sec.fibers]; newFibers[idx] = newFiber;
        return { ...sec, fibers: newFibers };
      }) }));
    }
    else if (category === 'pattern') {
      const tpl = getTemplateByName('pattern', get().patterns.find(p => p.id === id)?.templateName);
      if (!tpl) return;
      const cmd = generateCommand(tpl, newParams);
      const newArgs = cmd.args.slice(1);
      set(state => ({ patterns: state.patterns.map(p => p.id !== id ? p : { ...p, params: { ...newParams }, command: cmd.command, args: newArgs }) }));
    }
  },

  updateComponentArgs: (category, id, newArgs) => {
    set(state => {
      const arr = [...state[category]];
      const index = arr.findIndex(item => item.id === id);
      if (index === -1) return;
      arr[index] = { ...arr[index], args: newArgs };
      return { [category]: arr };
    });
  },

  removeComponent: (category, id) => {
    if (category === 'section') {
      set(state => ({ section: state.section.filter(sec => sec.id !== id) }));
    }
    else if (['fiber','patch','layer'].includes(category)) {
      set(state => ({ section: state.section.map(sec => ({ ...sec, fibers: sec.fibers?.filter(f => f.id !== id) || [] })) }));
    }
    else if (category === 'pattern') {
      set(state => ({ patterns: state.patterns.filter(p => p.id !== id), loads: state.loads.filter(l => l.patternId !== id), eleLoads: state.eleLoads.filter(el => el.patternId !== id), sps: state.sps.filter(sp => sp.patternId !== id) }));
    }
    else if (['load','eleLoad','sp'].includes(category)) {
      set(state => ({ [category === 'load' ? 'loads' : category === 'eleLoad' ? 'eleLoads' : 'sps']: state[category === 'load' ? 'loads' : category === 'eleLoad' ? 'eleLoads' : 'sps'].filter(item => item.id !== id) }));
    }
  },

  toJson: () => {
    const s = get();
    const sectionsOut = s.section.map(sec => {
      const base = { command: sec.command, name: sec.templateName, args: sec.args };
      if (sec.fibers?.length) base.fibers = sec.fibers.map(f => ({ command: f.command, name: f.templateName, args: f.args }));
      return base;
    });

    return {
      model_config: s.modelConfig,
      nodes: s.node.map(item => ({ command: item.command, args: item.args })),
      boundary_conditions: s.boundaryConditions.map(item => ({ command: item.command, args: item.args })),
      materials: s.uniaxialMaterial.map(item => ({ command: item.command, name: item.templateName, args: item.args })),
      sections: sectionsOut,
      transformations: s.geomTransf.map(item => ({ command: item.command, name: item.templateName, args: item.args })),
      integrations: s.beamIntegration.map(item => ({ command: item.command, name: item.templateName, args: item.args })),
      elements: s.element.map(item => ({ command: item.command, name: item.templateName, args: item.args })),
      patterns: s.patterns.map(p => {
        const base = { command: p.command, name: p.templateName, args: p.args };
        const loadsFor = s.loads.filter(l => l.patternId === p.id);
        if (loadsFor.length) base.loads = loadsFor.map(l => ({ command: l.command, args: l.args }));
        const eleLoadsFor = s.eleLoads.filter(el => el.patternId === p.id);
        if (eleLoadsFor.length) base.eleLoads = eleLoadsFor.map(el => ({ command: el.command, args: el.args }));
        const spsFor = s.sps.filter(sp => sp.patternId === p.id);
        if (spsFor.length) base.sps = spsFor.map(sp => ({ command: sp.command, args: sp.args }));
        return base;
      }),
      time_series: s.timeSeries.map(item => ({ command: item.command, name: item.templateName, args: item.args }))
    };
  }
}));
