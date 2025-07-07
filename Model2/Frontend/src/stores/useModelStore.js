// src/stores/useModelStore.js
import { create } from 'zustand';
import { generateCommand, getTemplateByName } from '../api/jsonTemplates';
import { generateId } from '../utils/idGenerator';
import { useUserTypeStore } from '../utils/storeUserType';

// Helper to extract the OpenSeES tag from args
// Helper to extract an OpenSees tag from a command’s args
const getOpenseesTag = (category, args) => {
  if (['node', 'nodeLite'].includes(category))     return args[0];
  if (['element', 'elementLite'].includes(category)) return args[1];
  return null;
};

// Given a category and a candidate tag, check across the store
const isTagUnique = (state, category, tag) => {
  // decide which array we’re checking
  let arrName = null;
  if (['node','nodeLite'].includes(category))       arrName = 'node';
  else if (['element','elementLite'].includes(category)) arrName = 'element';
  else return true; // only enforce on node/element

  return !state[arrName].some(item =>
    getOpenseesTag(category, item.args) === tag
  );
};


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
  // call this whenever you want to reset/populate defaults
initializeDefaults: () => {
  // 1) pull both status and modelConfig from their stores
  const status = useUserTypeStore.getState().status;
  const { modelConfig } = get();


  // default components for lite users
  const defaultSections = [
    { id: null, command: 'section', templateName: 'Elastic2D',
      args: ['Elastic', 1, 200000000000, 0.01, 0.00000833], fibers: [] }
  ];
  const defaultTransformations = [
    { id: null, command: 'geomTransf', templateName: 'Linear', args: ['Linear', 1] }
  ];
  const defaultIntegrations = [
    { id: null, command: 'beamIntegration', templateName: 'Lobatto', args: ['Lobatto', 1, 1, 2] }
  ];
  const defaultTimeSeries = [
    { id: null, command: 'timeSeries', templateName: 'Constant', args: ['Constant', 1, '-factor', 1] }
  ];

  // 2) now the condition will actually see modelConfig.ndf


  if (status === 'lite') {
      if (modelConfig.ndf === 2) {
              set({
      timeSeries: defaultTimeSeries.map(def => ({ ...def, id: generateId() }))
    });
      }
  else if (modelConfig.ndf === 3) {
    set({
      // section: defaultSections.map(def => ({ ...def, id: generateId() })),  
      geomTransf: defaultTransformations.map(def => ({ ...def, id: generateId() })),
      // beamIntegration: defaultIntegrations.map(def => ({ ...def, id: generateId() })),
      timeSeries: defaultTimeSeries.map(def => ({ ...def, id: generateId() }))
    });
  }
  else {
    // In case you add a 4‑DOF or something later…
    set({
      section: [],
      geomTransf: [],
      beamIntegration: [],
      timeSeries: []
    });
  }
} else {
  // non‑lite users
  set({
    section: [],
    geomTransf: [],
    beamIntegration: [],
    timeSeries: []
  });
}

},


  // universal addComponent
 // inside your create((set, get) => ({ … }))
// ────────────────────────────────────────────────────────────────────────────
// 1) addComponent with tag‑uniqueness guard
addComponent: (category, templateName, params, parentId = null) => {
  const tpl = getTemplateByName(category, templateName);
  if (!tpl) return;
  const id = generateId();
  const { command, args } = generateCommand(tpl, params);

  // Determine if we should enforce uniqueness (node → args[0], element → args[1])
  let arrName, tagArgIndex;
  if (category === 'node' || category === 'nodeLite') {
    arrName = 'node';
    tagArgIndex = 0;
  } else if (category === 'element' || category === 'elementLite') {
    arrName = 'element';
    tagArgIndex = 1;
  }
  // If it’s a node/element, check existing tags
  if (arrName) {
    const state = get();
    const existingTags = state[arrName].map(item => item.args[tagArgIndex]);
    const newTag = args[tagArgIndex];

    if (existingTags.includes(newTag)) {
      window.alert(
        `${arrName} id "${newTag}" already exists`
      );
      return; 
    }
  }

  // Now proceed with the usual add logic…
  if (category === 'section' || category === 'sectionLite') {
    set(state => ({
      section: [
        ...state.section,
        { id, command, templateName, args, params: { ...params }, fibers: [] }
      ]
    }));
    return;
  }
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
  if (category === 'pattern' || category === 'patternLite') {
    set(state => ({
      patterns: [
        ...state.patterns,
        { id, category, templateName, params: { ...params }, command, args }
      ]
    }));
    return;
  }
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
  // generic arrays (node, element, etc. for advanced users)
  const status = useUserTypeStore.getState().status;
  const arrMapLite = {
    nodeLite: 'node', elementLite: 'element',
    boundaryConditionsLite: 'boundaryConditions',
    uniaxialMaterialLite: 'uniaxialMaterial',
    geomTransfLite: 'geomTransf',
    beamIntegrationLite: 'beamIntegration',
    timeSeriesLite: 'timeSeries'
  };
  const arrMapAdvance = {
    node: 'node', element: 'element',
    boundaryConditions: 'boundaryConditions',
    uniaxialMaterial: 'uniaxialMaterial',
    geomTransf: 'geomTransf',
    beamIntegration: 'beamIntegration',
    timeSeries: 'timeSeries'
  };
  const arrMap = status === 'lite' ? arrMapLite : arrMapAdvance;
  const arrKey = arrMap[category];
  if (!arrKey) return;

  const item = { id, command, args, category: arrKey };
  if (['uniaxialMaterial','element','timeSeries','section','geomTransf','beamIntegration'].includes(arrKey)) {
    item.templateName = templateName;
    item.params = { ...params };
  }
  set(state => ({ [arrKey]: [...(state[arrKey]||[]), item] }));
},

// ────────────────────────────────────────────────────────────────────────────
// 2) updateComponentArgs with the same uniqueness guard
updateComponentArgs: (category, id, newArgs) => {
  // Only nodes (args[0]) and elements (args[1]) need checking
  let arrName, tagArgIndex;
  if (category === 'node') {
    arrName = 'node'; tagArgIndex = 0;
  } else if (category === 'element') {
    arrName = 'element'; tagArgIndex = 1;
  }
  if (arrName) {
    const state = get();
    const existingTags = state[arrName]
      .filter(item => item.id !== id)      // exclude the one we’re editing
      .map(item => item.args[tagArgIndex]);
    const newTag = newArgs[tagArgIndex];

    if (existingTags.includes(newTag)) {
      window.alert(
        `${arrName} id "${newTag}" already exists`
      );
      return; // bail out on duplicate
    }
  }

  // Delegate to your existing updateComponentArgs logic:
  const arrMap = {
    node: 'node',
    boundaryConditions: 'boundaryConditions',
    uniaxialMaterial: 'uniaxialMaterial',
    element: 'element',
    geomTransf: 'geomTransf',
    beamIntegration: 'beamIntegration',
    timeSeries: 'timeSeries'
  };
  const arrKey = arrMap[category];
  if (!arrKey) return;

  set(state => ({
    [arrKey]: state[arrKey].map(item =>
      item.id === id ? { ...item, args: newArgs } : item
    )
  }));
},
// ────────────────────────────────────────────────────────────────────────────

  // unified removeComponent
  removeComponent: (category, id) => {
    // section
    if (category === 'section' || category === 'sectionLite') {
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
    if (category === 'pattern' || category === 'patternLite') {
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
    const status = useUserTypeStore.getState().status;
  const arrMapLite = {
      nodeLite: 'node',
      boundaryConditionsLite: 'boundaryConditions',
      uniaxialMaterialLite: 'uniaxialMaterial',
      elementLite: 'element',
      geomTransfLite: 'geomTransf',
      beamIntegrationLite: 'beamIntegration',
      timeSeriesLite: 'timeSeries'
  };
    const arrMapAdvance = {
      node: 'node',
      boundaryConditions: 'boundaryConditions',
      uniaxialMaterial: 'uniaxialMaterial',
      element: 'element',
      geomTransf: 'geomTransf',
      beamIntegration: 'beamIntegration',
      timeSeries: 'timeSeries'
    };
    const arrMap = status === 'lite' ? arrMapLite : arrMapAdvance;

    const arrName = arrMap[category] || null;

    if (arrName) {
      set(state => ({
        [arrName]: state[arrName].filter(item => item.id !== id)
      }));
    }
  },
updateComponentArgs: (category, id, newArgs) => {
  const state = get();

  //
  // ── 1) DUPLICATE‑TAG GUARD FOR NODE/ELEMENT ────────────────────────────────
  //
  let arrName, tagArgIndex;
  if (category === 'node') {
    arrName      = 'node';
    tagArgIndex  = 0;
  } else if (category === 'element') {
    arrName      = 'element';
    tagArgIndex  = 1;
  }

  if (arrName) {
    // collect all tags except the one being edited
    const existingTags = state[arrName]
      .filter(item => item.id !== id)
      .map(item => item.args[tagArgIndex]);

    const newTag = newArgs[tagArgIndex];

    if (existingTags.includes(newTag)) {
      // you can swap this for console.warn if you prefer
      window.alert(
        `Cannot rename ${arrName} to tag "${newTag}" — that tag is already in use.`
      );
      return;
    }
  }

  //
  // ── 2) YOUR ORIGINAL UPDATE LOGIC ───────────────────────────────────────────
  //

  // SECTION
  if (category === 'section') {
    set(s => ({
      section: s.section.map(sec =>
        sec.id === id ? { ...sec, args: newArgs } : sec
      )
    }));
    return;
  }

  // PATTERNS
  if (category === 'patterns') {
    set(s => ({
      patterns: s.patterns.map(p =>
        p.id === id ? { ...p, args: newArgs } : p
      )
    }));
    return;
  }

  // LOADS (load / eleLoad / sp)
  if (category === 'loads') {
    set(s => ({
      loads: s.loads.map(l =>
        l.id === id ? { ...l, args: newArgs } : l
      )
    }));
    return;
  }

  // GENERIC ARRAYS
  const arrMap = {
    node: 'node',
    boundaryConditions: 'boundaryConditions',
    uniaxialMaterial: 'uniaxialMaterial',
    element: 'element',
    geomTransf: 'geomTransf',
    beamIntegration: 'beamIntegration',
    timeSeries: 'timeSeries'
  };
  const arrKey = arrMap[category];
  if (!arrKey) return;

  set(s => ({
    [arrKey]: s[arrKey].map(item =>
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
