import { useAnalysisStore } from "../stores/useAnalysisStore";
import { useModelStore } from "../stores/useModelStore";
import { generateId } from "./idGenerator";
import { getTemplateByName } from '../api/jsonTemplates';

function parseRecorderArgs(args) {
  const result = { fileName: null, nodeIds: [], dofs: [], eleIds: [], responseType: null };
  for (let i = 0; i < args.length; ) {
    const tok = args[i];
    if (tok === "-file") {
      result.fileName = args[i+1];
      i += 2;
    } else if (tok === "-node") {
      i++;
      while (i < args.length && typeof args[i] !== 'string') {
        result.nodeIds.push(args[i]);
        i++;
      }
    } else if (tok === "-ele") {
      i++;
      while (i < args.length && typeof args[i] !== 'string') {
        result.eleIds.push(args[i]);
        i++;
      }
    } else if (tok === "-dof") {
      i++;
      while (i < args.length && typeof args[i] !== 'string') {
        result.dofs.push(args[i]);
        i++;
      }
    } else {
      result.responseType = tok;
      i++;
    }
  }
  return result;
}

export const importModel = (payload) => {
  if (payload.model_config) {
    useModelStore.setState({ modelConfig: payload.model_config });
  }
  const nodes = (payload.nodes || []).map(n => ({
    id: generateId(),
    command: n.command,
    args: n.args,
    category: 'node'
  }));
  useModelStore.setState({ node: nodes });

  const bcs = (payload.boundary_conditions || []).map(b => ({
    id: generateId(),
    command: b.command,
    args: b.args,
    category: 'boundaryConditions'
  }));
  useModelStore.setState({ boundaryConditions: bcs });

  const mats = (payload.materials || []).map(m => ({
    id: generateId(),
    command: m.command,
    templateName: m.name,
    args: m.args,
    category: 'uniaxialMaterial',
    params: { ...m.args }
  }));
  useModelStore.setState({ uniaxialMaterial: mats });

  // Sections with nested fibers
  const secs = [];
  (payload.sections || []).forEach(s => {
    const secId = generateId();
    const sectionObj = {
      id: secId,
      command: s.command,
      templateName: s.name,
      args: s.args,
      params: {},  // optionally reconstruct from args if needed
      fibers: []
    };
    (s.fibers || []).forEach(f => {
      const fiberId = generateId();
      sectionObj.fibers.push({
        id: fiberId,
        category: f.command, // assuming command matches category: "patch"/"layer"/"fiber"
        command: f.command,
        templateName: f.name,
        args: f.args,
        params: {} // optionally reconstruct
      });
    });
    secs.push(sectionObj);
  });
  useModelStore.setState({ section: secs });

  const geoms = (payload.transformations || []).map(t => ({
    id: generateId(),
    command: t.command,
    templateName: t.name,
    args: t.args,
    category: 'geomTransf'
  }));
  useModelStore.setState({ geomTransf: geoms });

  const beaminteg = (payload.integrations || []).map(bi => ({
    id: generateId(),
    command: bi.command,
    templateName: bi.name,
    args: bi.args,
    category: 'beamIntegration'
  }));
  useModelStore.setState({ beamIntegration: beaminteg });

  const elems = (payload.elements || []).map(el => ({
    id: generateId(),
    command: el.command,
    templateName: el.name,
    args: el.args,
    category: 'element'
  }));
  useModelStore.setState({ element: elems });

  const tss = (payload.time_series || []).map(ts => ({
    id: generateId(),
    command: ts.command,
    templateName: ts.name,
    args: ts.args,
    category: 'timeSeries'
  }));
  useModelStore.setState({ timeSeries: tss });

  const patterns = (payload.patterns || []).map(p => {
    const id = generateId();
    // grab the template to clone its defaults
    const tpl = getTemplateByName('pattern', p.name);
    const params = tpl
      ? { ...tpl.defaultParams }
      : {};

    return {
      id,
      command: p.command,
      templateName: p.name,
      args: p.args,
      params,
      category: 'pattern'
    };
  });
  useModelStore.setState({ patterns });

  const loads = [];
  const eleLoads = [];
  const sps = [];
  patterns.forEach(pattern => {
    const source = (payload.patterns || []).find(p => p.name === pattern.templateName && JSON.stringify(p.args) === JSON.stringify(pattern.args));
    if (!source) return;
    (source.loads || []).forEach(l => loads.push({
      id: generateId(),
      patternId: pattern.id,
      command: l.command,
      args: l.args,
      category: 'load'
    }));
    (source.eleLoads || []).forEach(el => eleLoads.push({
      id: generateId(),
      patternId: pattern.id,
      command: el.command,
      args: el.args,
      category: 'eleLoad'
    }));
    (source.sps || []).forEach(sp => sps.push({
      id: generateId(),
      patternId: pattern.id,
      command: sp.command,
      args: sp.args,
      category: 'sp'
    }));
  });
  useModelStore.setState({ loads, eleLoads, sps });

  const recs = (payload.recorders || []).map(r => {
    const parsed = parseRecorderArgs(r.args || []);
    return {
      id: generateId(),
      category: 'recorder',
      command: r.command,
      name: r.name,
      args: r.args,
      nodeIds: parsed.nodeIds,
      dofs: parsed.dofs,
      eleIds: parsed.eleIds,
      responseType: parsed.responseType,
      fileName: parsed.fileName,
      immutable: r.immutable ?? false
    };
  });
  useAnalysisStore.setState({ recorders: recs });

  const seq = (payload.analysis_sequence || []).map(step => ({
    id: generateId(),
    command: step.command,
    templateName: step.name,
    args: step.args,
    category: 'analysis'
  }));
  useAnalysisStore.setState({ sequence: seq });

  if (payload.monitoring) {
    console.warn("Imported monitoring:", payload.monitoring);
    useAnalysisStore.setState({ monitoring: payload.monitoring });
  }
};
