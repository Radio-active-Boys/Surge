/*
src/stores/useAnalysisStore.js
*/
import { create } from 'zustand';
import { generateCommand, getTemplateByName } from '../api/jsonTemplates';
import { generateId } from '../utils/idGenerator';

// Helper: build args array for a recorder given its metadata
function buildRecorderArgs({ name, fileName, nodeIds = [], dofs = [], eleIds = [], responseType }) {
  const args = ['-file', fileName, '-time', name === 'Element' ? '-ele' : '-node'];
  if (name === 'Node') {
    args.push( ...nodeIds, '-dof', ...dofs, responseType);
  } else if (name === 'Element') {
    args.push( ...eleIds, responseType);
  }
  return args;
}

// Create a default recorder metadata object
function makeDefaultRecorder({ name, fileName, responseType, nodeIds = [], dofs = [], eleIds = [] }) {
  const id = generateId();
  const args = buildRecorderArgs({ name, fileName, nodeIds, dofs, eleIds, responseType });
  return {
    id,
    category: 'recorder',
    command: 'recorder',
    name,
    fileName,
    responseType,
    nodeIds: [...nodeIds],
    dofs: [...dofs],
    eleIds: [...eleIds],
    args,
    immutable: true
  };
}

export const useAnalysisStore = create((set, get) => ({
  sequence: [],
  recorders: [],

  initializeDefaultRecorders: ({ nodeIds = [], dofs = [1, 2], eleIds = [] }) => {
    const defaults = [
      { name: 'Node', fileName: 'node_disp.txt', responseType: 'disp' },
      { name: 'Node', fileName: 'node_reaction.txt', responseType: 'reaction' },
      { name: 'Node', fileName: 'node_vel.txt', responseType: 'vel' },
      { name: 'Node', fileName: 'node_accel.txt', responseType: 'accel' },
      { name: 'Element', fileName: 'elem_force_global.txt', responseType: 'force' },
      { name: 'Element', fileName: 'elem_localForce.txt', responseType: 'localForce' },
      { name: 'Element', fileName: 'elem_deformation.txt', responseType: 'deformation' },
      { name: 'Element', fileName: 'elem_axialForce.txt', responseType: 'axialForce' },
      { name: 'Element', fileName: 'elem_basicDeformation.txt', responseType: 'basicDeformation' },
      { name: 'Element', fileName: 'elem_basicForce.txt', responseType: 'basicForce' },
      { name: 'Element', fileName: 'elem_stiffness.txt', responseType: 'stiffness' },
    ];
    const recorderCmds = defaults.map(def => 
      makeDefaultRecorder({ name: def.name, fileName: def.fileName, responseType: def.responseType, nodeIds, dofs, eleIds })
    );
    set(() => ({ recorders: recorderCmds }));
  },

  updateRecorder: ({ id, nodeIds, dofs, eleIds }) => {
    set(state => {
      const recs = state.recorders.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r };
        if (r.name === 'Node') {
          if (Array.isArray(nodeIds)) updated.nodeIds = [...nodeIds];
          if (Array.isArray(dofs)) updated.dofs = [...dofs];
        } else if (r.name === 'Element') {
          if (Array.isArray(eleIds)) updated.eleIds = [...eleIds];
        }
        updated.args = buildRecorderArgs({ name: updated.name, fileName: updated.fileName, nodeIds: updated.nodeIds, dofs: updated.dofs, eleIds: updated.eleIds, responseType: updated.responseType });
        return updated;
      });
      return { recorders: recs };
    });
  },

  addRecorder: ({ name, fileName, nodeIds = [], dofs = [], eleIds = [], responseType }) => {
    const existing = get().recorders;
    if (existing.some(r => r.fileName === fileName)) {
      console.warn(`Recorder with fileName "${fileName}" already exists; skipping.`);
      return;
    }
    const id = generateId();
    const args = buildRecorderArgs({ name, fileName, nodeIds, dofs, eleIds, responseType });
    const cmdObj = { id, category: 'recorder', command: 'recorder', name, fileName, responseType, nodeIds: [...nodeIds], dofs: [...dofs], eleIds: [...eleIds], args, immutable: false };
    set(state => ({ recorders: [...state.recorders, cmdObj] }));
  },
  updateSequenceArgs: (id, newArgs) => {
    set(state => ({
      sequence: state.sequence.map(item =>
        item.id === id ? { ...item, args: newArgs } : item
      )
    }));
  },

  // YOU ALREADY ADDED this, but for clarity:
  updateRecorderArgs: (id, newArgs) => {
    set(state => ({
      recorders: state.recorders.map(r =>
        r.id === id ? { ...r, args: newArgs } : r
      )
    }));
  },


  removeRecorder: (id) => {
    const recs = get().recorders;
    const rec = recs.find(r => r.id === id);
    if (!rec) return;
    if (rec.immutable) {
      console.warn('Cannot remove default recorder');
      return;
    }
    set(state => ({ recorders: state.recorders.filter(r => r.id !== id) }));
  },

  addComponent: (category, templateName, params) => {
    const template = getTemplateByName(category, templateName);
    if (!template) return;
    const id = generateId();
    const cmdObj = generateCommand(template, params);
    const item = { id, command: cmdObj.command, args: cmdObj.args, category };
    if (['generator', 'timeSeries', 'uniaxialMaterial', 'section', 'geomTransf', 'beamIntegration', 'element'].includes(category)) {
      item.templateName = templateName;
      item.params = { ...params };
    }
    set(state => ({ sequence: [...state.sequence, item] }));
  },

  removeComponent: (id) => set(state => ({ sequence: state.sequence.filter(item => item.id !== id) })),

  moveUp: (id) => {
    set(state => {
      const seq = [...state.sequence];
      const idx = seq.findIndex(item => item.id === id);
      if (idx > 0) [seq[idx-1], seq[idx]] = [seq[idx], seq[idx-1]];
      return { sequence: seq };
    });
  },

  moveDown: (id) => {
    set(state => {
      const seq = [...state.sequence];
      const idx = seq.findIndex(item => item.id === id);
      if (idx >= 0 && idx < seq.length - 1) [seq[idx], seq[idx+1]] = [seq[idx+1], seq[idx]];
      return { sequence: seq };
    });
  },

  toJson: () => {
    const s = get();
    const seqJson = s.sequence.map(item => {
      const out = { command: item.command, args: item.args };
      if (item.templateName) out.name = item.templateName;
      return out;
    });
    const recJson = s.recorders.map(r => ({ command: r.command, name: r.name, args: r.args }));
    return { analysis_sequence: seqJson, recorders: recJson };
  }
}));
