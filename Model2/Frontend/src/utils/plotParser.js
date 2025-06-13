// src/utils/plotParser.js

import { useMemo } from 'react';
import { useModelStore } from '../stores/useModelStore';
import { useResultStore } from '../stores/useResultStore';

/**
 * Helper to parse support constraints (SP) from modelSupports array,
 * grouping by nodeId and filling DOFs up to ndf with default 0 if not specified.
 */

// {
//   nodeCoordinates: {
//     [nodeId: number]: { x: number, y: number }
//   },
//   elementConnectivity: Array<{
//     id: number,
//     i: number,
//     j: number
//   }>,
//   supports: Array<{
//     nodeId: number,
//     dof: number[],        // e.g., [1, 2]
//     value: number[]       // e.g., [1, 0] meaning DOF1 is fixed, DOF2 is free
//   }>,
//   loads: Array<{
//     nodeId: number,
//     values: number[]      // nodal force/moment values
//   }>,
//   eleLoads: Array<{
//     eleIds: number[],
//     type: string | null,
//     params: { values?: any[] }
//   }>,

//   // --- Recorder Series: Each is an array of entries over time
//   nodeDispSeries: Array<{
//     time: number,
//     data: {
//       [nodeId: number]: {
//         [dof: number]: number
//       }
//     }
//   }>,
//   nodeReactionSeries: same as nodeDispSeries,
//   nodeVelSeries: same,
//   nodeAccelSeries: same,

//   eleGlobalForceSeries: Array<{
//     time: number,
//     data: {
//       [eleId: number]: {
//         [key: string]: number
//       }
//     }
//   }>,

//   eleLocalForceSeries: same as above,
//   eleDeformationSeries: Array<{
//     time: number,
//     data: {
//       [eleId: number]: number
//     }
//   }>,

//   eleAxialForceSeries: same as above,

//   eleBasicDeformationSeries: Array<{
//     time: number,
//     data: {
//       [eleId: number]: {
//         [key: string]: number
//       }
//     }
//   }>,

//   eleBasicForceSeries: same as above,

//   eleStiffnessSeries: same as above
// } 

function parseSupports(modelSupports, ndf) {
  const grouped = {};
  modelSupports.forEach(sp => {
    const args = sp.args || [];
    if (args.length >= 3) {
      const nodeId = args[0];
      const dof = args[1];
      const value = args[2];
      if (!grouped[nodeId]) grouped[nodeId] = {};
      grouped[nodeId][dof] = value;
    }
  });
  const supports = [];
  Object.entries(grouped).forEach(([nodeId, dofMap]) => {
    const dofs = [];
    const values = [];
    for (let d = 1; d <= ndf; d++) {
      dofs.push(d);
      values.push(dofMap[d] !== undefined ? dofMap[d] : 0);
    }
    supports.push({ nodeId: Number(nodeId), dof: dofs, value: values });
  });
  return supports;
}

/**
 * Helper to parse nodal loads from modelLoads array.
 */
function parseLoads(modelLoads) {
  const loads = [];
  modelLoads.forEach(load => {
    const args = load.args || [];
    if (args.length >= 2) {
      const nodeId = args[0];
      const values = args.slice(1);
      loads.push({ nodeId, values });
    }
  });
  return loads;
}

/**
 * Helper to parse element loads from modelEleLoads array.
 */
function parseEleLoads(modelEleLoads) {
  const eleLoads = [];
  modelEleLoads.forEach(el => {
    const args = el.args || [];
    let eleIds = [];
    let type = null;
    const params = {};
    const eleIndex = args.indexOf('-ele');
    if (eleIndex !== -1) {
      let i = eleIndex + 1;
      while (i < args.length && (typeof args[i] !== 'string' || !args[i].startsWith('-'))) {
        eleIds.push(args[i]);
        i++;
      }
    }
    const typeIndex = args.indexOf('-type');
    if (typeIndex !== -1 && typeIndex + 1 < args.length) {
      type = args[typeIndex + 1];
      const rest = args.slice(typeIndex + 2);
      params.values = rest;
    }
    eleLoads.push({ eleIds, type, params });
  });
  return eleLoads;
}

/**
 * Parse recorder tables into separate series variables.
 * Each series is an array of { time, data } entries.
 * Keys are prefixed: nodeDispSeries, nodeReactionSeries, ..., eleAxialForceSeries, etc.
 */
function parseRecorderSeries(parsedTables) {
  const series = {};
  // Utility to parse node-based table
  function parseNodeTable(table, resp) {
    return table.rows.map((row, idx) => {
      const entry = { time: row[0], data: {} };
      table.columns.forEach((col, ci) => {
        if (ci === 0) return;
        const m = col.match(new RegExp(`node(\\d+)_${resp}_DOF(\\d+)`));
        if (m) {
          const [, nodeId, dof] = m;
          entry.data[nodeId] = entry.data[nodeId] || {};
          entry.data[nodeId][dof] = table.rows[idx][ci];
        }
      });
      return entry;
    });
  }
  // Utility to parse element-based table for single-value responses
  function parseElementSingle(table, pattern) {
    return table.rows.map((row, idx) => {
      const entry = { time: row[0], data: {} };
      table.columns.forEach((col, ci) => {
        if (ci === 0) return;
        const m = col.match(pattern);
        if (m) {
          const eleId = m[1];
          entry.data[eleId] = row[ci];
        }
      });
      return entry;
    });
  }
  // Utility to parse element-based table for multi-value responses
  function parseElementMulti(table) {
    return table.rows.map((row, idx) => {
      const entry = { time: row[0], data: {} };
      table.columns.forEach((col, ci) => {
        if (ci === 0) return;
        const m = col.match(/ele(\d+)_(.+)/);
        if (m) {
          const [, eleId, key] = m;
          entry.data[eleId] = entry.data[eleId] || {};
          entry.data[eleId][key] = row[ci];
        }
      });
      return entry;
    });
  }

  // Mapping with prefixed keys
  const mapping = [
    { key: 'nodeDispSeries', file: 'nodes_disp.txt', type: 'node', resp: 'disp' },
    { key: 'nodeReactionSeries', file: 'nodes_reaction.txt', type: 'node', resp: 'reaction' },
    { key: 'nodeVelSeries', file: 'node_vel.txt', type: 'node', resp: 'vel' },
    { key: 'nodeAccelSeries', file: 'node_accel.txt', type: 'node', resp: 'accel' },
    { key: 'eleGlobalForceSeries', file: 'elem_force_global.txt', type: 'element_multi' },
    { key: 'eleLocalForceSeries', file: 'elem_localForce.txt', type: 'element_multi' },
    { key: 'eleDeformationSeries', file: 'elem_deformation.txt', type: 'element_single', pattern: /ele(\d+)_deform/ },
    { key: 'eleAxialForceSeries', file: 'elem_axialForce.txt', type: 'element_single', pattern: /ele(\d+)_axial/ },
    { key: 'eleBasicDeformationSeries', file: 'elem_basicDeformation.txt', type: 'element_multi' },
    { key: 'eleBasicForceSeries', file: 'elem_basicForce.txt', type: 'element_multi' },
    { key: 'eleStiffnessSeries', file: 'elem_stiffness.txt', type: 'element_multi' }
  ];

  mapping.forEach(({ key, file, type, resp, pattern }) => {
    const table = parsedTables[file];
    if (!table) {
      series[key] = [];
    } else if (type === 'node') {
      series[key] = parseNodeTable(table, resp);
    } else if (type === 'element_single') {
      series[key] = parseElementSingle(table, pattern);
    } else if (type === 'element_multi') {
      series[key] = parseElementMulti(table);
    }
  });

  return series;
}

/**
 * Core parsing logic: given raw inputs, build unified data.
 */
function parseResults(modelNodes, modelElements, modelSupports, modelLoads, modelEleLoads, recorders, ndf) {
  const nodeCoordinates = {};
  modelNodes.forEach(n => {
    const [nodeId, x, y] = n.args;
    nodeCoordinates[nodeId] = { x, y };
  });

  const elementConnectivity = modelElements.map(el => {
    const [eleId, i, j] = el.args;
    return { id: eleId, i, j };
  });

  const supports = parseSupports(modelSupports, ndf);
  const loads = parseLoads(modelLoads);
  const eleLoads = parseEleLoads(modelEleLoads);

  const parsedTables = {};
  Object.entries(recorders || {}).forEach(([filename, rec]) => {
    const rows = rec.data.map(line =>
      line.trim().split(/\s+/).map(val => {
        const num = parseFloat(val);
        return isNaN(num) ? val : num;
      })
    );
    parsedTables[filename] = { columns: rec.columns, rows };
  });

  const series = parseRecorderSeries(parsedTables);

  return {
    nodeCoordinates,
    elementConnectivity,
    supports,
    loads,
    eleLoads,
    ...series
  };
}

/**
 * React hook: fetches model & results from stores, memoizes parsing.
 */
export function usePlotParser() {
  const modelNodes = useModelStore(state => state.node);
  const modelElements = useModelStore(state => state.element);
  const modelSupports = useModelStore(state => state.sps || state.boundaryConditions);
  const modelLoads = useModelStore(state => state.loads);
  const modelEleLoads = useModelStore(state => state.eleLoads);
  const recorders = useResultStore(state => state.recorders);
  const modelConfig = useModelStore(state => state.modelConfig);
  const ndf = modelConfig?.ndf || 2;

  return useMemo(() => {
    return parseResults(modelNodes, modelElements, modelSupports, modelLoads, modelEleLoads, recorders, ndf);
  }, [modelNodes, modelElements, modelSupports, modelLoads, modelEleLoads, recorders, ndf]);
}
