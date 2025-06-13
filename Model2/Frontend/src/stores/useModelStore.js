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
          return {
            ...sec,
            fibers: [...(sec.fibers || []), fiberObj]
          };
        });
        return { section: sections };
      });
    }
    else if (category === 'pattern') {
      const p = {
        id,
        templateName,
        params: { ...params },
        command: commandObj.command,
        args: commandObj.args,
        category
      };
      set(state => ({ patterns: [...state.patterns, p] }));
    }
    else if (category === 'load') {
      if (!parentId) return;
      const cmd = commandObj;
      set(state => ({ loads: [...state.loads, { id, patternId: parentId, command: cmd.command, args: cmd.args, category }] }));
    }
    else if (category === 'eleLoad') {
      if (!parentId) return;
      const cmd = commandObj;
      set(state => ({ eleLoads: [...state.eleLoads, { id, patternId: parentId, command: cmd.command, args: cmd.args, category }] }));
    }
    else if (category === 'sp') {
      if (!parentId) return;
      const cmd = commandObj;
      set(state => ({ sps: [...state.sps, { id, patternId: parentId, command: cmd.command, args: cmd.args, category }] }));
    }
    else {
      // other categories like node, boundaryConditions, uniaxialMaterial, element, geomTransf, beamIntegration, timeSeries
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
      set(state => ({
        section: state.section.map(s => {
          if (s.id !== id) return s;
          return {
            ...s,
            params: { ...newParams },
            command: cmd.command,
            args: cmd.args
          };
        })
      }));
    }
    else if (['fiber','patch','layer'].includes(category)) {
      const state = get();
      set(state => {
        const sections = state.section.map(sec => {
          const idx = (sec.fibers || []).findIndex(f => f.id === id);
          if (idx === -1) return sec;
          const fiber = sec.fibers[idx];
          const tpl = getTemplateByName(category, fiber.templateName);
          if (!tpl) return sec;
          const cmd = generateCommand(tpl, newParams);
          const newFiber = {
            ...fiber,
            params: { ...newParams },
            command: cmd.command,
            args: cmd.args
          };
          const newFibers = [...sec.fibers];
          newFibers[idx] = newFiber;
          return { ...sec, fibers: newFibers };
        });
        return { section: sections };
      });
    }
    else if (category === 'pattern') {
      const state = get();
      set({
        patterns: state.patterns.map(p => {
          if (p.id !== id) return p;
          const tpl = getTemplateByName('pattern', p.templateName);
          if (!tpl) return p;
          const cmd = generateCommand(tpl, newParams);
          return { ...p, params: { ...newParams }, command: cmd.command, args: cmd.args };
        })
      });
    }
    // loads/eleLoads/sp update normally via separate methods if implemented
  },

  removeComponent: (category, id) => {
    if (category === 'section') {
      set(state => ({
        section: state.section.filter(sec => sec.id !== id)
      }));
    }
    else if (['fiber','patch','layer'].includes(category)) {
      set(state => {
        const sections = state.section.map(sec => {
          const newFibers = (sec.fibers || []).filter(f => f.id !== id);
          if (newFibers.length === sec.fibers?.length) return sec;
          return { ...sec, fibers: newFibers };
        });
        return { section: sections };
      });
    }
    else if (category === 'pattern') {
      set(state => ({
        patterns: state.patterns.filter(p => p.id !== id),
        loads: state.loads.filter(l => l.patternId !== id),
        eleLoads: state.eleLoads.filter(el => el.patternId !== id),
        sps: state.sps.filter(sp => sp.patternId !== id)
      }));
    }
    else if (category === 'load') {
      set(state => ({ loads: state.loads.filter(l => l.id !== id) }));
    }
    else if (category === 'eleLoad') {
      set(state => ({ eleLoads: state.eleLoads.filter(el => el.id !== id) }));
    }
    else if (category === 'sp') {
      set(state => ({ sps: state.sps.filter(sp => sp.id !== id) }));
    }
    else {
      // other categories: implement if needed
    }
  },

  toJson: () => {
    const s = get();
    const sectionsOut = s.section.map(sec => {
      const base = {
        command: sec.command,
        name: sec.templateName,
        args: sec.args
      };
      if (sec.fibers && sec.fibers.length) {
        base.fibers = sec.fibers.map(f => ({
          command: f.command,
          name: f.templateName,
          args: f.args
        }));
      }
      return base;
    });

    // other parts: nodes, boundary_conditions, materials, etc.
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
