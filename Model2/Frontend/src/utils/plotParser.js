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
    if (sp.category !== "boundaryConditions" || sp.command !== "fix") return;
    const args = sp.args || [];
    if (args.length === ndf + 1) {
      const nodeId = Number(args[0]);
      if (!grouped[nodeId]) grouped[nodeId] = {};
      for (let d = 1; d <= ndf; d++) {
        grouped[nodeId][d] = Number(args[d]);
      }
    } else if (args.length >= 3) {
      const nodeId = Number(args[0]);
      const dof = Number(args[1]);
      const val = Number(args[2]);
      if (!grouped[nodeId]) grouped[nodeId] = {};
      grouped[nodeId][dof] = val;
    }
  });

  const supports = [];
  Object.entries(grouped).forEach(([nodeIdStr, dofMap]) => {
    const nodeId = Number(nodeIdStr);
    const dofs = [], values = [];
    for (let d = 1; d <= ndf; d++) {
      dofs.push(d);
      values.push(dofMap[d] !== undefined ? dofMap[d] : 0);
    }
    supports.push({ nodeId, dof: dofs, value: values });
  });

  return supports;
}

/**
 * Parse loads, eleLoads, and sps from unified modelLoads
 */
function parsePatternLoads(modelLoads) {
  const loads = [], eleLoads = [], sps = [];

  modelLoads.forEach(load => {
    const { command, args = [] } = load;

    if (command === "load") {
      if (args.length >= 2) {
        const nodeId = Number(args[0]);
        const values = args.slice(1).map(Number);
        loads.push({ nodeId, values });
      }
    }
    else if (command === "eleLoad") {
      // Prepare defaults
      let eleIds = [];
      let range = null;
      let type = null;
      let values = [];

      // Scan args sequentially
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "-ele") {
          // single element: next entry is element tag
          const next = args[i+1];
          if (typeof next === "number") {
            eleIds.push(Number(next));
            i += 1;
          }
        }
        else if (arg === "-range") {
          // range: next two entries are start and end tags
          const start = args[i+1], end = args[i+2];
          if (typeof start === "number" && typeof end === "number") {
            range = { start: Number(start), end: Number(end) };
            // optionally store eleIds as array of ints, e.g. all tags in [start..end],
            // but often we can keep range and expand later if needed.
            i += 2;
          }
        }
        else if (arg === "-type") {
          // next is type string
          const next = args[i+1];
          if (typeof next === "string") {
            type = next;
            // Collect all subsequent numeric args as values until next flag or end
            let j = i+2;
            while (j < args.length && typeof args[j] === "number") {
              values.push(Number(args[j]));
              j++;
            }
            i = j - 1;
          }
        }
        // else: skip other flags if any (e.g., future flags)
      }

      // Build structured params depending on type
      const params = {};
      if (type === "beamPoint") {
        // In 2D: values = [Pz, xL] or [Pz, xL, Px]
        // In 3D: [Py, Pz, xL] or [Py, Pz, xL, Px]
        if (values.length >= 2) {
          // assume last is xL, first(s) are magnitudes
          const xL = values[values.length - 1];
          if (values.length === 2) {
            // 2D: [Pz, xL]
            params.Pz = values[0];
            params.xL = xL;
          }
          else if (values.length === 3) {
            // Could be 2D with Px or 3D without Px?
            // Decide by ndm context elsewhere; here assume 2D+[Px]: [Pz, xL, Px]
            params.Pz = values[0];
            params.xL = values[1];
            params.Px = values[2];
          }
          else if (values.length === 3 || values.length === 4) {
            // 3D: [Py, Pz, xL] or [Py, Pz, xL, Px]
            params.Py = values[0];
            params.Pz = values[1];
            params.xL = values[2];
            if (values.length === 4) {
              params.Px = values[3];
            }
          }
        }
      }
      else if (type === "beamUniform") {
        // In 2D: values = [Wz] or [Wz, Wx]
        // In 3D: [Wy, Wz] or [Wy, Wz, Wx]
        // Or trapezoidal 2D: [Wz_start, Wx_start, aL, bL, Wz_end, Wx_end]
        // Or trapezoidal 3D: [Wy_start, Wz_start, Wx_start, aL, bL, Wy_end, Wz_end, Wx_end]
        if (values.length === 1) {
          params.Wz = values[0];
        }
        else if (values.length === 2) {
          // ambiguous: 2D [Wz, Wx] or 3D [Wy, Wz]? Use ndm context elsewhere.
          params.W1 = values[0];
          params.W2 = values[1];
        }
        else if (values.length === 3) {
          // likely 3D simple: [Wy, Wz, Wx]
          params.Wy = values[0];
          params.Wz = values[1];
          params.Wx = values[2];
        }
        else if (values.length === 6) {
          // 2D trapezoidal: [Wz_start, Wx_start, aL, bL, Wz_end, Wx_end]
          params.Wz_start = values[0];
          params.Wx_start = values[1];
          params.aL = values[2];
          params.bL = values[3];
          params.Wz_end = values[4];
          params.Wx_end = values[5];
        }
        else if (values.length === 8) {
          // 3D trapezoidal: [Wy_start, Wz_start, Wx_start, aL, bL, Wy_end, Wz_end, Wx_end]
          params.Wy_start = values[0];
          params.Wz_start = values[1];
          params.Wx_start = values[2];
          params.aL = values[3];
          params.bL = values[4];
          params.Wy_end = values[5];
          params.Wz_end = values[6];
          params.Wx_end = values[7];
        }
      }
      else {
        // handle other types if needed, e.g., beamThermal
        params.values = values;
      }

      // Determine eleIds: if range is given, optionally expand or keep range
      if (range) {
        // Option A: keep range object
        // eleLoads.push({ range, type, params });
        // Option B: expand into array of IDs if you know all element tags in model
        // For now, store both
      }
      if (eleIds.length === 0 && range) {
        // Optionally record that this uses a range
      }

      eleLoads.push({ eleIds, range, type, params });
    }
    else if (command === "sp") {
      const nodeId = Number(args[0]);
      const dof = Number(args[1]);
      const value = Number(args[2]);
      sps.push({ nodeId, dof: [dof], value: [value] });
    }
  });

  return { loads, eleLoads, sps };
}

function parseRecorderSeries(parsedTables) {
  const series = {};

  function parseNodeTable(table, resp) {
    return table.rows.map(row => {
      const entry = { time: row[0], data: {} };
      table.columns.forEach((col, ci) => {
        if (ci === 0) return;
        const m = col.match(/node(\d+)_([a-zA-Z]+)_DOF(\d+)/);
        if (m) {
          const [, nodeId, , dof] = m;
          entry.data[nodeId] = entry.data[nodeId] || {};
          entry.data[nodeId][dof] = row[ci];
        }
      });
      return entry;
    });
  }

  function parseElementSingle(table, pattern) {
    return table.rows.map(row => {
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

  function parseElementMulti(table) {
    return table.rows.map(row => {
      const entry = { time: row[0], data: {} };
      table.columns.forEach((col, ci) => {
        if (ci === 0) return;
        const m = col.match(/ele(\d+)_([\w]+)/);
        if (m) {
          const [ , eleId, key ] = m;
          entry.data[eleId] = entry.data[eleId] || {};
          entry.data[eleId][key] = row[ci];
        }
      });
      return entry;
    });
  }

  const mapping = [
    { key: 'nodeDispSeries', file: 'node_disp.txt', type: 'node', resp: 'disp' },
    { key: 'nodeReactionSeries', file: 'node_reaction.txt', type: 'node', resp: 'reaction' },
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

function parseResults(modelNodes, modelElements, modelSupports, modelLoads, recorders, ndf) {
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
  const { loads, eleLoads, sps } = parsePatternLoads(modelLoads);

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
    sps,
    ...series
  };
}

export function usePlotParser() {
  const modelNodes = useModelStore(state => state.node);
  const modelElements = useModelStore(state => state.element);
  const modelSupports = useModelStore(state => state.boundaryConditions);
  const modelLoads = useModelStore(state => state.loads);
  const recorders = useResultStore(state => state.recorders);
  const modelConfig = useModelStore(state => state.modelConfig);
  const ndf = modelConfig?.ndf || 2;

  return useMemo(() => {
    return parseResults(modelNodes, modelElements, modelSupports, modelLoads, recorders, ndf);
  }, [modelNodes, modelElements, modelSupports, modelLoads, recorders, ndf]);
}
