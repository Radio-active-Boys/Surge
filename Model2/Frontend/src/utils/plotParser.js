// src/utils/plotParser.js

import { useMemo } from 'react';
import { useModelStore } from '../stores/useModelStore';
import { useResultStore } from '../stores/useResultStore';

/**
 * Helper to parse support constraints (SP) from modelSupports array,
 * grouping by nodeId and filling DOFs up to ndf with default 0 if not specified.
 */
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
  const loads   = [];
  const eleLoads = [];
  const sps     = [];

  modelLoads.forEach(item => {
    const { command, args = [] } = item;

    // ——— Nodal loads ———
    if (command === "load") {
      // args: [nodeTag, F1, F2, …]
      if (args.length >= 2) {
        const nodeId = Number(args[0]);
        const values = args.slice(1).map(Number);
        loads.push({ nodeId, values });
      }

    // ——— Element loads ———
    } else if (command === "eleLoad") {
      let eleIds = [];
      let range  = null;
      let type   = null;
      const valuesArr = [];

      // Step 1: extract flags (-ele / -range / -type) and numeric values
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === "-ele") {
          const next = args[++i];
          if (typeof next === "number") eleIds.push(next);

        } else if (arg === "-range") {
          const start = args[++i];
          const end   = args[++i];
          if (typeof start === "number" && typeof end === "number") {
            range = { start, end };
          }

        } else if (arg === "-type") {
          type = args[++i];

        } else if (typeof arg === "number") {
          // any bare numbers go into our values array
          valuesArr.push(arg);
        }
      }

      // Step 2: interpret the numeric values based on type
      const params = {};

      if (type === "beamPoint") {
        // valuesArr: [Py, xL, (optional) Px]
        // Py = local-y point load, xL = fraction of length, Px = optional axial
        if (valuesArr.length >= 2) {
          params.Py = valuesArr[0];
          params.xL = valuesArr[1];
          if (valuesArr.length >= 3) {
            params.Px = valuesArr[2];
          }
        }

      } else if (type === "beamUniform") {
        // valuesArr variants:
        // 1 value → [Wy]
        // 2 values → [Wy, Wx]
        // 6 values → [Wy_start, Wx_start, aL, bL, Wy_end, Wx_end]
        if (valuesArr.length === 1) {
          params.Wy = valuesArr[0];

        } else if (valuesArr.length === 2) {
          params.Wy = valuesArr[0];
          params.Wx = valuesArr[1];

        } else if (valuesArr.length === 6) {
          [
            params.Wy_start,
            params.Wx_start,
            params.aL,
            params.bL,
            params.Wy_end,
            params.Wx_end
          ] = valuesArr;
        }

      } else {
        // fallback for any other or future eleLoad types
        params.values = valuesArr;
      }

      eleLoads.push({ eleIds, range, type, params });

    // ——— Single-point constraints ———
    } else if (command === "sp") {
      // args: [nodeTag, dof, value]
      if (args.length >= 3) {
        const nodeId = Number(args[0]);
        const dof    = Number(args[1]);
        const value  = Number(args[2]);
        sps.push({ nodeId, dof: [dof], value: [value] });
      }
    }
  });

  return { loads, eleLoads, sps };
}

function parseRecorderSeries(parsedTables) {
  const series = {};

  function parseNodeTable(table) {
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
          const [, eleId, key] = m;
          entry.data[eleId] = entry.data[eleId] || {};
          entry.data[eleId][key] = row[ci];
        }
      });
      return entry;
    });
  }

  const mapping = [
    { key: 'nodeDispSeries', file: 'node_disp.txt', type: 'node' },
    { key: 'nodeReactionSeries', file: 'node_reaction.txt', type: 'node' },
    { key: 'nodeVelSeries', file: 'node_vel.txt', type: 'node' },
    { key: 'nodeAccelSeries', file: 'node_accel.txt', type: 'node' },
    { key: 'eleGlobalForceSeries', file: 'elem_force_global.txt', type: 'element_multi' },
    { key: 'eleLocalForceSeries', file: 'elem_localForce.txt', type: 'element_multi' },
    { key: 'eleDeformationSeries', file: 'elem_deformation.txt', type: 'element_single', pattern: /ele(\d+)_deform/ },
    { key: 'eleAxialForceSeries', file: 'elem_axialForce.txt', type: 'element_single', pattern: /ele(\d+)_axial/ },
    { key: 'eleBasicDeformationSeries', file: 'elem_basicDeformation.txt', type: 'element_multi' },
    { key: 'eleBasicForceSeries', file: 'elem_basicForce.txt', type: 'element_multi' },
    { key: 'eleStiffnessSeries', file: 'elem_stiffness.txt', type: 'element_multi' }
  ];

  mapping.forEach(({ key, file, type, pattern }) => {
    const table = parsedTables[file];
    if (!table) {
      series[key] = [];
    } else if (type === 'node') {
      series[key] = parseNodeTable(table);
    } else if (type === 'element_single') {
      series[key] = parseElementSingle(table, pattern);
    } else if (type === 'element_multi') {
      series[key] = parseElementMulti(table);
    }
  });

  return series;
}

function parseResults(modelNodes, modelElements, modelSupports, modelLoads, recorders, ndf, ndm) {
  const nodeCoordinates = {};
  modelNodes.forEach(n => {
    const [nodeId, x, y] = n.args;
    nodeCoordinates[nodeId] = { x, y };
  });

  const elementConnectivity = modelElements.map(el => {
    const type = el.templateName;
    const [_, eleId, i, j] = el.args;
    return { id: eleId, i, j, type };
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
    ndf,
    ndm,
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
  const ndm = modelConfig?.ndm || 2;

  return useMemo(() => {
    return parseResults(
      modelNodes,
      modelElements,
      modelSupports,
      modelLoads,
      recorders,
      ndf,
      ndm
    );
  }, [modelNodes, modelElements, modelSupports, modelLoads, recorders, ndf, ndm]);
}
