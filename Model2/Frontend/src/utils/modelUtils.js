import { useAnalysisStore } from "../stores/useAnalysisStore";
import { useModelStore } from "../stores/useModelStore";
import { generateId } from "./idGenerator";
import { getTemplateByName } from '../api/jsonTemplates';

function parseRecorderArgs(args) {
  const result = { fileName: null, nodeIds: [], dofs: [], eleIds: [], responseType: null };
  for (let i = 0; i < args.length; ) {
    const tok = args[i];
    if (tok === "-file") {
      result.fileName = args[i+1]; i += 2;
    } else if (tok === "-node") {
      i++;
      while (i < args.length && typeof args[i] !== 'string') { result.nodeIds.push(args[i]); i++; }
    } else if (tok === "-ele") {
      i++;
      while (i < args.length && typeof args[i] !== 'string') { result.eleIds.push(args[i]); i++; }
    } else if (tok === "-dof") {
      i++;
      while (i < args.length && typeof args[i] !== 'string') { result.dofs.push(args[i]); i++; }
    } else {
      result.responseType = tok; i++;
    }
  }
  return result;
}

export const importModel = (payload) => {
  if (payload.model_config) {
    useModelStore.setState({ modelConfig: payload.model_config });
  }

  // Nodes
  const nodes = (payload.nodes || []).map(n => ({ id: generateId(), command: n.command, args: n.args, category: 'node' }));
  useModelStore.setState({ node: nodes });

  // Boundary Conditions
  const bcs = (payload.boundary_conditions || []).map(b => ({ id: generateId(), command: b.command, args: b.args, category: 'boundaryConditions' }));
  useModelStore.setState({ boundaryConditions: bcs });

  // Materials
  const mats = (payload.materials || []).map(m => ({ id: generateId(), command: m.command, templateName: m.name, args: m.args, category: 'uniaxialMaterial', params: { ...m.args } }));
  useModelStore.setState({ uniaxialMaterial: mats });

  // Sections & Fibers
  const secs = [];
  (payload.sections || []).forEach(s => {
    const secId = generateId();
    const sectionObj = { id: secId, command: s.command, templateName: s.name, args: s.args, params: {}, fibers: [] };
    (s.fibers || []).forEach(f => {
      const fiberId = generateId();
      sectionObj.fibers.push({ id: fiberId, category: f.command, command: f.command, templateName: f.name, args: f.args, params: {} });
    });
    secs.push(sectionObj);
  });
  useModelStore.setState({ section: secs });

  // Geometric Transformations
  const geoms = (payload.transformations || []).map(t => ({ id: generateId(), command: t.command, templateName: t.name, args: t.args, category: 'geomTransf' }));
  useModelStore.setState({ geomTransf: geoms });

  // Beam Integrations
  const beaminteg = (payload.integrations || []).map(bi => ({ id: generateId(), command: bi.command, templateName: bi.name, args: bi.args, category: 'beamIntegration' }));
  useModelStore.setState({ beamIntegration: beaminteg });

  // Elements
  const elems = (payload.elements || []).map(el => ({ id: generateId(), command: el.command, templateName: el.name, args: el.args, category: 'element' }));
  useModelStore.setState({ element: elems });

  // Time Series
  const tss = (payload.time_series || []).map(ts => ({ id: generateId(), command: ts.command, templateName: ts.name, args: ts.args, category: 'timeSeries' }));
  useModelStore.setState({ timeSeries: tss });

  // Patterns & Loads
  const patterns = (payload.patterns || []).map(p => {
    const id = generateId();
    return { id, command: p.command, templateName: p.name, args: p.args, params: {}, category: 'pattern' };
  });
  useModelStore.setState({ patterns });

  const loads = [];
  const eleLoads = [];
  const sps = [];

  patterns.forEach(pattern => {
    const src = (payload.patterns || []).find(p => p.name === pattern.templateName && JSON.stringify(p.args) === JSON.stringify(pattern.args));
    if (!src) return;
    (src.loads || []).forEach(l => loads.push({ id: generateId(), patternId: pattern.id, command: l.command, args: l.args, category: 'load' }));
    (src.eleLoads || []).forEach(el => eleLoads.push({ id: generateId(), patternId: pattern.id, command: el.command, args: el.args, category: 'eleLoad' }));
    (src.sps || src.sp_constraints || []).forEach(sp => sps.push({ id: generateId(), patternId: pattern.id, command: sp.command, args: sp.args, category: 'sp' }));
  });
  useModelStore.setState({ loads, eleLoads, sps });

  // Recorders
  const recs = (payload.recorders || []).map(r => {
    const parsed = parseRecorderArgs(r.args || []);
    return { id: generateId(), category: 'recorder', command: r.command, name: r.name, args: r.args, ...parsed, immutable: r.immutable ?? false };
  });
  useAnalysisStore.setState({ recorders: recs });

  // Analysis Sequence
  const seq = (payload.analysis_sequence || []).map(step => ({ id: generateId(), command: step.command, templateName: step.name, args: step.args, category: 'analysis' }));
  useAnalysisStore.setState({ sequence: seq });

  // Monitoring
  if (payload.monitoring) {
    console.warn("Imported monitoring:", payload.monitoring);
    useAnalysisStore.setState({ monitoring: payload.monitoring });
  }
};