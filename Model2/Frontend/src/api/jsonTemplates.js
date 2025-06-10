// src/api/jsonTemplates.js
// Model
import beamIntegration from './templates/beamIntegration.json';
import uniaxialMaterial from './templates/uniaxialMaterial.json';
import element from './templates/element.json';
import geomTransf from './templates/geomTransf.json'
import pattern from './templates/pattern.json'
import timeSeries from './templates/timeSeries.json'
import section from './templates/section.json'
import node from './templates/node.json'
import model from './templates/model.json'
import boundryConditions from './templates/boundryConditions.json'

// Analysis
import constraints from './templates/constraints.json';
import numberer from './templates/numberer.json';
import system from './templates/system.json';
import algorithm from './templates/algorithm.json';
import integrator from './templates/integrator.json';
import analysis from './templates/analysis.json';
import analyze from './templates/analyze.json';

// Output
import recorder from './templates/recorder.json';

const TEMPLATES = {
  // Model
  beamIntegration,
  uniaxialMaterial,
  element,
  geomTransf,
  pattern,
  timeSeries,
  section,
  node,
  model,
  boundryConditions,


  // Analysis 
  constraints,
  numberer, 
  system,
  algorithm,
  integrator,
  analysis,
  analyze,

  // Output
  recorder,

};

export const getTemplates = (category) => {
  return TEMPLATES[category] || [];
};

export const getTemplateByName = (category, name) => {
  const templates = getTemplates(category);
  return templates.find(t => t.name === name);
};

export const generateCommand = (template, params) => {
  const args = template.command.args.map(arg => {
    if (typeof arg === 'string') {
      if (arg.startsWith('$')) {
        const paramKey = arg.slice(1);
        return params[paramKey];
      }
      if (arg.startsWith('*$')) {
        const arrayKey = arg.slice(2);
        return params[arrayKey] || [];
      }
      return arg;
    }
    return arg;
  });
  
  return {
    command: template.command.name,
    args: args.flat(),
    category: template.category,
    name: template.name
  };
}; 
