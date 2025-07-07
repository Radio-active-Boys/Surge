// api/jsonTemplates.js
import { useUserTypeStore } from '../utils/storeUserType';

// Advance User
import patternTemplates from './templates/pattern.json';
import beamIntegration from './templates/beamIntegration.json';
import uniaxialMaterial from './templates/uniaxialMaterial.json';
import element from './templates/element.json';
import geomTransf from './templates/geomTransf.json';
import timeSeries from './templates/timeSeries.json';
import node from './templates/node.json';
import model from './templates/model.json';
import boundaryConditions from './templates/boundryConditions.json';

import constraints from './templates/constraints.json';
import numberer from './templates/numberer.json';
import system from './templates/system.json';
import algorithm from './templates/algorithm.json';
import integrator from './templates/integrator.json';
import analysis from './templates/analysis.json';
import analyze from './templates/analyze.json';

import recorder from './templates/recorder.json';

// Section/fiber/patch/layer templates
import sectionTemplates from './templates/section.json';
import fiberTemplates from './templates/fiber.json';
import patchTemplates from './templates/patch.json';
import layerTemplates from './templates/layer.json';

const patternOnlyTemplates = patternTemplates.filter(t => t.category === 'pattern');
const loadTemplates = patternTemplates.filter(t => t.category === 'load');
const eleLoadTemplates = patternTemplates.filter(t => t.category === 'eleLoad');
const spTemplates = patternTemplates.filter(t => t.category === 'sp');

const AdvanceTemplates = {
  // Model-level
  model,
  node,
  boundaryConditions,
  beamIntegration,
  uniaxialMaterial,
  element,
  geomTransf,
  timeSeries,
  section: sectionTemplates,
  fiber: fiberTemplates,
  patch: patchTemplates,
  layer: layerTemplates,

  // Patterns & nested
  pattern: patternOnlyTemplates,
  load: loadTemplates,
  eleLoad: eleLoadTemplates,
  sp: spTemplates,

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

// Lite User
import patternTemplatesLite from './templatesLite/pattern.json';
import beamIntegrationLite from './templatesLite/beamIntegration.json';
import uniaxialMaterialLite from './templatesLite/uniaxialMaterial.json';
import elementLite from './templatesLite/element.json';
import geomTransfLite from './templatesLite/geomTransf.json';
import timeSeriesLite from './templatesLite/timeSeries.json';
import nodeLite from './templatesLite/node.json';
import modelLite from './templatesLite/model.json';
import boundaryConditionsLite from './templatesLite/boundryConditions.json';

import constraintsLite from './templatesLite/constraints.json';
import numbererLite from './templatesLite/numberer.json';
import systemLite from './templatesLite/system.json';
import algorithmLite from './templatesLite/algorithm.json';
import integratorLite from './templatesLite/integrator.json';
import analysisLite from './templatesLite/analysis.json';
import analyzeLite from './templatesLite/analyze.json';

import recorderLite from './templatesLite/recorder.json';

// Section/fiber/patch/layer templates
import sectionTemplatesLite from './templatesLite/section.json';
import fiberTemplatesLite from './templatesLite/fiber.json';
import patchTemplatesLite from './templatesLite/patch.json';
import layerTemplatesLite from './templatesLite/layer.json';

const patternOnlyTemplatesLite = patternTemplatesLite.filter(t => t.category === 'pattern');
const loadTemplatesLite = patternTemplatesLite.filter(t => t.category === 'load');
const eleLoadTemplatesLite = patternTemplatesLite.filter(t => t.category === 'eleLoad');
const LiteTemplates = {
  // Model-level
  modelLite,
  nodeLite,
  boundaryConditionsLite,
  beamIntegrationLite,
  uniaxialMaterialLite,
  elementLite,
  geomTransfLite,
  timeSeriesLite,
  section: sectionTemplatesLite,
  fiber: fiberTemplatesLite,
  patch: patchTemplatesLite,
  layer: layerTemplatesLite,

  // Patterns & nested
  pattern: patternOnlyTemplatesLite,
  load: loadTemplatesLite,
  eleLoad: eleLoadTemplatesLite,

  // Analysis
  constraintsLite,
  numbererLite,
  systemLite,
  algorithmLite,
  integratorLite,
  analysisLite,
  analyzeLite,
  // Output
  recorderLite,
};

// ✅ Helper to get correct mode templates
const getTemplateStore = () => {
  const status = useUserTypeStore.getState().status;

  return status === 'advanced' ? AdvanceTemplates : LiteTemplates;
};

// ✅ Get all templates of a category
export const getTemplates = (category) => {
  const store = getTemplateStore();

  return store[category] || [];
};

// ✅ Get a specific template by name in a category
export const getTemplateByName = (category, name) => {
  return getTemplates(category).find(t => t.name === name);
};

/**
 * Generate an OpenSees command from a template and parameter set.
 * Preserves numeric types for parameters, only flags remain strings.
 * For 'pattern' category, prefixes with pattern type name.
 */
export const generateCommand = (template, params) => {
  const rawArgs = template.command.args;

  function resolveArg(argSpec) {
    if (typeof argSpec === 'string') {
      if (argSpec.startsWith('*$')) {
        const key = argSpec.slice(2);
        const arr = params[key];
        return Array.isArray(arr) ? [...arr] : [];
      }
      if (argSpec.startsWith('$')) {
        const key = argSpec.slice(1);
        const val = params[key];
        return val != null
          ? (Array.isArray(val) ? [...val] : [val])
          : [];
      }
      return [argSpec];
    }

    if (typeof argSpec === 'number') {
      return [argSpec];
    }

    if (argSpec && typeof argSpec === 'object' && argSpec.cond && Array.isArray(argSpec.value)) {
      const negate = argSpec.cond.startsWith('!');
      const key = argSpec.cond.replace(/^!?\$/, '');
      const truthy = Boolean(params[key]);
      if (negate ? !truthy : truthy) {
        return argSpec.value.flatMap(resolveArg);
      }
      return [];
    }

    return [];
  }

  let finalArgs = rawArgs.flatMap(resolveArg);

  if (template.category === 'pattern') {
    // Ensure first two args exist: pattern type + tags
    finalArgs = [ ...finalArgs];
  }

  return {
    command: template.command.name,
    args: finalArgs,
    category: template.category,
    name: template.name,
  };
};
