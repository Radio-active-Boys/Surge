import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { saveAs } from "file-saver"; 
import { usePlotParser } from "../../utils/plotParser";
import './DeflectedShape.css'
export default function DeflectedShape({ width = 1200, height = 430, margin = 40 }) {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const rootRef = useRef(null);
  const {
    nodeCoordinates,
    elementConnectivity,
    supports,
    nodeDispSeries,
    ndf,
    ndm,
  } = usePlotParser();

  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userScale, setUserScale] = useState(1);
  const nep = 17;

  // Query state: user can fill either nodeID or elementID + xLoc
  const [queryNodeId, setQueryNodeId] = useState('');
  const [queryElId, setQueryElId] = useState('');
  const [queryXLoc, setQueryXLoc] = useState(0);
  const [deflResult, setDeflResult] = useState(null);
  const [deflError, setDeflError] = useState('');

  // Compute base scale factor
  const baseSfac = useMemo(() =>
    defo_scale(
      nep,
      elementConnectivity,
      nodeCoordinates,
      nodeDispSeries?.[0]?.data || {},
      ndm,
      ndf
    ),
    [elementConnectivity, nodeCoordinates, nodeDispSeries, ndm, ndf]
  );
  const sfac = baseSfac * userScale;

const exportPNG = () => {
  const svgEl = svgRef.current;
  const bbox = svgEl.getBBox();
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svg64 = btoa(unescape(encodeURIComponent(xml))); // safer encoding
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${svg64}`;

  img.onload = () => {
    const scale = 2; // ← Increase for higher quality (e.g., 2x, 3x)
    const canvas = document.createElement("canvas");
    canvas.width = (bbox.width + margin * 2) * scale;
    canvas.height = (bbox.height + margin * 2) * scale;
    const ctx = canvas.getContext("2d");

    ctx.scale(scale, scale); // ← Scale drawing context
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
    ctx.drawImage(img, -bbox.x + margin, -bbox.y + margin);

    canvas.toBlob(blob => saveAs(blob, "deflected-shape.png"));
  };
};


  // Animation loop
  useEffect(() => {
    let timer;
    if (isPlaying && nodeDispSeries && nodeDispSeries.length) {
      timer = setInterval(() => {
        setTimeIndex(idx => (idx + 1) % nodeDispSeries.length);
      }, 200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, nodeDispSeries]);

  // Init SVG & zoom
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    defineArrowMarkers(svg);
    const root = svg.append("g").attr("class", "viewport");
    rootRef.current = root;
    const zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on("zoom", e => root.attr("transform", e.transform));
    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
  }, []);

  // Main draw
  useEffect(() => {
    if (!rootRef.current || !nodeCoordinates) return;
    const svg = d3.select(svgRef.current);
    const root = rootRef.current;
    root.selectAll(".original, .elements, .nodes, .supports").remove();

    const coords = nodeCoordinates;
    const dispMap = nodeDispSeries?.[0]?.data || {};

    // original extents
    const xs = Object.values(coords).map(d => d.x);
    const ys = Object.values(coords).map(d => d.y);
    let [xMin, xMax] = d3.extent(xs);
    let [yMin, yMax] = d3.extent(ys);
    // console.log("xMin before",xMin)
    // console.log("xMax before",xMax)
    // console.log("yMin before",yMin)
    // console.log("yMax before",yMax)
    if (xMin === xMax) { 
      const uXmax = d3.max(Object.values(dispMap), d => Math.abs(d?.['2']*sfac)) || 1;
      xMin -= uXmax; xMax += uXmax;
       }
    if (yMin === yMax) {
      const uYmax = d3.max(Object.values(dispMap), d => Math.abs(d?.['2']*sfac)) || 1;
      yMin -= uYmax; yMax += uYmax;
    }
    // console.log("xMin After",xMin)
    // console.log("xMax After",xMax)
    // console.log("yMin After",yMin)
    // console.log("yMax After",yMax)

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height - margin, margin]);

    // console.log("sfac",sfac)
    // console.log("baseSfac",baseSfac)
    // console.log("userScale",userScale)
    // console.log("xScale",xScale)
    // console.log("yScale",yScale)

    // draw original
    const g0 = root.append("g").attr("class", "original");

    DrawElements(g0, elementConnectivity, nodeCoordinates, xScale, yScale);
    // draw deflected
    DrawElementsDeflected(
      root.append("g").attr("class","elements"),
      elementConnectivity, coords, dispMap, xScale, yScale, sfac, ndm, ndf
    );
    DrawNodesDeflected(
      root.append("g").attr("class","nodes"), coords, dispMap, xScale, yScale, sfac
    );
    DrawSupportsDeflected(
      root.append("g").attr("class","supports"), supports, coords, dispMap, xScale, yScale, sfac
    );
  }, [nodeCoordinates, elementConnectivity, supports, nodeDispSeries, timeIndex, width, height, margin, sfac]);

  // Handle query: nodeId OR (elId + xLoc)
  function handleQuery() {
    const dispMap = nodeDispSeries?.[timeIndex]?.data || {};
    setDeflResult(null);
    setDeflError('');

    if (queryNodeId) {
      // node deflection
      const u = dispMap[String(queryNodeId)];
      if (!u) {
        setDeflError(`Node ${queryNodeId} not found`);
        return;
      }
      setDeflResult({ dx: u['1']||0, dy: u['2']||0 });
      return;
    }

    // element deflection
    const el = elementConnectivity.find(e => e.id.toString() === String(queryElId));
    if (!el) {
      setDeflError(`Element ${queryElId} not found`);
      return;
    }
    const p1 = nodeCoordinates[el.i], p2 = nodeCoordinates[el.j];
    const L  = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    if (queryXLoc < 0 || queryXLoc > L) {
      setDeflError(`x = ${queryXLoc.toFixed(2)} is greater than element length = ${L.toFixed(2)} m`);
      return;
    }

    // build local disp map
    const localDisp = {
      [String(el.i)]: [
        dispMap[el.i]?.['1']||0,
        dispMap[el.i]?.['2']||0,
        dispMap[el.i]?.['3']||0,
      ],
      [String(el.j)]: [
        dispMap[el.j]?.['1']||0,
        dispMap[el.j]?.['2']||0,
        dispMap[el.j]?.['3']||0,
      ],
    };

    const interp = beam_defo_interp_2d(nep, el, sfac, nodeCoordinates, localDisp, ndm, ndf);
    if (!interp) {
      setDeflError('Interpolation failed');
      return;
    }

    // original position
    const origX = p1.x + (p2.x - p1.x) * (queryXLoc / L);
    const origY = p1.y + (p2.y - p1.y) * (queryXLoc / L);

    // find nearest idx
    let best=0, bestD=Infinity;
    interp.crd_xc.forEach((x,i) => {
      const y = interp.crd_yc[i];
      const d = Math.hypot(x - origX, y - origY);
      if (d < bestD) { bestD = d; best = i; }
    });

    const defX = interp.crd_xc[best];
    const defY = interp.crd_yc[best];
    setDeflResult({ dx: (defX - origX)/sfac, dy: (defY - origY)/sfac });
  }

  return (
    <div className="deflected-container">
      <div className="controls">
        <button onClick={exportPNG}>Save PNG</button>
        {/* <button onClick={() => setIsPlaying(p=>!p)}>
          {isPlaying ? 'Stop' : 'Play'}
        </button> */}
        <label>
          Scale:
          <input
            type="range" min={0.1} max={5} step={0.1}
            value={userScale}
            onChange={e => setUserScale(parseFloat(e.target.value))}
          /> {userScale.toFixed(1)}x
        </label>
      </div>

      <div className="query-controls">
        <input
          type="text"
          placeholder="Node ID"
          value={queryNodeId}
          onChange={e => { setQueryNodeId(e.target.value); setQueryElId(''); }}
          disabled={queryElId}
        />
        <input
          type="text"
          placeholder="Element ID"
          value={queryElId}
          onChange={e => { setQueryElId(e.target.value); setQueryNodeId(''); }}
        />
        <input
          type="number"
          placeholder="x from start"
          value={queryXLoc}
          onChange={e => setQueryXLoc(parseFloat(e.target.value))}
          disabled={!queryElId}
        />
        <button onClick={handleQuery}>Get Δx, Δy</button>
      </div>
      {deflError && (
        <div className="query-error" style={{ borderLeft: "4px solid #dc2626" /* red */ }}>
          <strong>Error:</strong> {deflError}
        </div>
      )}

    {deflResult && !deflError && (
      <div className="query-result">
        {queryNodeId
          ? `At node ${queryNodeId}: Δx=${(deflResult.dx*1000).toFixed(4)} mm, Δy=${(deflResult.dy*1000).toFixed(4)} mm`
          : `At x=${queryXLoc.toFixed(2)} on element ${queryElId}: Δx=${(deflResult.dx*1000).toFixed(4)} mm, Δy=${(deflResult.dy*1000).toFixed(4)} mm`
        }
      </div>
    )}
      <svg ref={svgRef} width={width} height={height} className="deflected-svg" />
    </div>
  );
}

// ─── DRAW ELEMENTS ────────────────────────────────────────────────────────
function DrawElements(g, elements, coords, xScale, yScale) {
  g.selectAll("*").remove();

  elements.forEach(el => {
    const p1 = coords[el.i], p2 = coords[el.j];
    if (!p1 || !p2) return;

    const x1 = xScale(p1.x), y1 = yScale(p1.y);
    const x2 = xScale(p2.x), y2 = yScale(p2.y);

    g.append("line")
      .attr("class", "element")
      .attr("x1", x1).attr("y1", y1)
      .attr("x2", x2).attr("y2", y2)
      .attr("stroke", "#666")
      .attr("stroke-width", 2);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;

    const tinyFrac = 0.01;
    const testX = p1.x + ux * (tinyFrac * len);
    const testY = p1.y + uy * (tinyFrac * len);
    const sA = [xScale(p1.x), yScale(p1.y)];
    const sB = [xScale(testX), yScale(testY)];
    let dirX = sB[0] - sA[0], dirY = sB[1] - sA[1];
    const norm = Math.hypot(dirX, dirY) || 1;
    dirX /= norm; dirY /= norm;
    const perpX = -dirY, perpY = dirX;

    const arrowPx = 12;
    const tx = mx + dirX * arrowPx;
    const ty = my + dirY * arrowPx;

    const qx = mx + perpX * -arrowPx;
    const qy = my + perpY * -arrowPx;

    g.append("line")
      .attr("x1", mx).attr("y1", my)
      .attr("x2", tx).attr("y2", ty)
      .attr("stroke", "red")
      .style("color", "red")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead-axial)");

    g.append("line")
      .attr("x1", mx).attr("y1", my)
      .attr("x2", qx).attr("y2", qy)
      .attr("stroke", "green")
      .style("color", "green")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead-transverse)");

    g.append("text")
      .attr("x", tx + 3)
      .attr("y", ty - 3)
      .text("X")
      .attr("fill", "red")
      .attr("font-size", 5);

    g.append("text")
      .attr("x", qx - 6)
      .attr("y", qy - 3)
      .text("Y")
      .attr("fill", "green")
      .attr("font-size", 5);

    // Better-positioned element ID label
    g.append("text")
      .attr("x", (tx+qx)/2)
      .attr("y", (ty+qy)/2)
      .attr("text-anchor", "middle")
      .attr("font-size", 7)
      .attr("fill", "blue")
      .text(`E${el.id}`);
  });
}

// New implementation of DrawElementsDeflected using beam_defo_interp_2d
function DrawElementsDeflected(g, elements, coords, dispMap, xScale, yScale, sfac, ndm, ndf) {
  g.selectAll("*").remove();
  const nep = 17; // Number of evaluation points

  // Define element type groups
  const trussTypes = ['Truss', 'TrussSection', 'corotTruss'];
  const beamTypes = ['elasticBeamColumn', 'dispBeamColumn', 'forceBeamColumn'];

  elements.forEach(el => {
    const p1 = coords[el.i], p2 = coords[el.j];
    if (!p1 || !p2) return;

    // Convert node IDs to strings for dispMap access
    const nodeI = String(el.i);
    const nodeJ = String(el.j);

    // Get displacements (1-indexed DOFs: UX=1, UY=2, RZ=3)

    const ux1 = dispMap[nodeI]?.["1"] || 0;
    const uy1 = dispMap[nodeI]?.["2"] || 0;
    const ux2 = dispMap[nodeJ]?.["1"] || 0;
    const uy2 = dispMap[nodeJ]?.["2"] || 0;

    // Handle truss elements
    if (trussTypes.includes(el.type)) {
      const x1d = p1.x + ux1 * sfac;
      const y1d = p1.y + uy1 * sfac;
      const x2d = p2.x + ux2 * sfac;
      const y2d = p2.y + uy2 * sfac;
      
      g.append("line")
        .attr("x1", xScale(x1d))
        .attr("y1", yScale(y1d))
        .attr("x2", xScale(x2d))
        .attr("y2", yScale(y2d))
        .attr("stroke", "red")
        .attr("stroke-width", 2);
    }
    // Handle beam/column elements
    else if (beamTypes.includes(el.type)) {

      const rz1 = dispMap[nodeI]?.["3"] || 0;
      const rz2 = dispMap[nodeJ]?.["3"] || 0;
      
      const dispMapForInterp = {
        [nodeI]: [ux1, uy1, rz1],
        [nodeJ]: [ux2, uy2, rz2]
      };
      
      const result = beam_defo_interp_2d(nep, el, sfac, coords, dispMapForInterp, ndm, ndf);


      if (result && result.crd_xc && result.crd_yc) {
        // FIX 1: Account for D3's inverted y-axis in plotting
        const points = result.crd_xc.map((x, i) => ({
          x: xScale(x),
          y: yScale(result.crd_yc[i]) // Already includes deformation
        }));
        
        // FIX 2: Create path with correct orientation
        const line = d3.line()
          .x(d => d.x)
          .y(d => d.y);
        
        g.append("path")
          .datum(points)
          .attr("d", line)
          .attr("stroke", "blue")
          .attr("stroke-width", 2)
          .attr("fill", "none");
        
        // FIX 3: Add rigid offsets (Python equivalent)
        // Original node positions with deformation

        const x1d = p1.x + ux1 * sfac;
        const y1d = p1.y + uy1 * sfac;
        const x2d = p2.x + ux2 * sfac;
        const y2d = p2.y + uy2 * sfac;
        
    
        g.append("line")
          .attr("x1", xScale(x1d))
          .attr("y1", yScale(y1d))
          .attr("x2", xScale(result.crd_xc[0]))
          .attr("y2", yScale(result.crd_yc[0]))
          .attr("stroke", "black")
          .attr("stroke-width", 3);

        g.append("line")
          .attr("x1", xScale(x2d))
          .attr("y1", yScale(y2d))
          .attr("x2", xScale(result.crd_xc[result.crd_xc.length - 1]))
          .attr("y2", yScale(result.crd_yc[result.crd_yc.length - 1]))
          .attr("stroke", "black")
          .attr("stroke-width", 3);
      
        
        // FIX 4: Add end nodes (Python fmt_nodes equivalent)
        g.append("circle")
          .attr("cx", xScale(result.crd_xc[0]))
          .attr("cy", yScale(result.crd_yc[0]))
          .attr("r", 6)
          .attr("fill", "red");
        
        g.append("circle")
          .attr("cx", xScale(result.crd_xc[result.crd_xc.length - 1]))
          .attr("cy", yScale(result.crd_yc[result.crd_yc.length - 1]))
          .attr("r", 6)
          .attr("fill", "red");
      }
    }

    else {
      // Default to simple line connection
      const x1d = p1.x + ux1 * sfac;
      const y1d = p1.y + uy1 * sfac;
      const x2d = p2.x + ux2 * sfac;
      const y2d = p2.y + uy2 * sfac;
      
      g.append("line")
        .attr("x1", xScale(x1d))
        .attr("y1", yScale(y1d))
        .attr("x2", xScale(x2d))
        .attr("y2", yScale(y2d))
        .attr("stroke", "green")
        .attr("stroke-width", 2);
    }
  });
}

// Beam interpolation function for 2D elements
// Updated beam_defo_interp_2d function
function beam_defo_interp_2d(nep, el, sfac, coords, dispMap, ndm = 2, ndf = 3) {
  if (ndm !== 2 || ndf < 3) return null;

  const i = el.i, j = el.j;
  const p1 = coords[i], p2 = coords[j];
  if (!p1 || !p2) return null;

  // Get displacements
  const u1 = Array.isArray(dispMap[i]) 
    ? dispMap[i] 
    : Array.from({ length: ndf }, (_, k) => dispMap[i]?.[String(k+1)] ?? 0);
  
  const u2 = Array.isArray(dispMap[j]) 
    ? dispMap[j] 
    : Array.from({ length: ndf }, (_, k) => dispMap[j]?.[String(k+1)] ?? 0);

  const u = [...u1, ...u2]; // Flattened vector: [ux1, uy1, rz1, ux2, uy2, rz2]

  const { G, L, cosa, cosb } = rot_transf_2d(el, coords);
  const u_l = multiplyMatrixVector(G, u); // Local displacements

  // Longitudinal shape function interpolation
  const N_a = beam_axial_shape_functions(L, nep);
  const u_ac = N_a.map(row => row[0] * u_l[0] + row[1] * u_l[3]); // axial = [ux1_local, ux2_local]

  // Transverse shape function interpolation (REMOVED THE NEGATION)
  const N_t = beam_transverse_shape_functions(L, nep);
  const u_tc = N_t.map(row => 
    row[0] * u_l[1] + 
    row[1] * u_l[2] + 
    row[2] * u_l[4] + 
    row[3] * u_l[5]
  );

  // Combine axial and transverse into 2D local deformation
  const u_xyc = u_ac.map((ua, idx) => {
    const ut = u_tc[idx];
    // Local to global transform
    const ux = cosa * ua - cosb * ut;
    const uy = cosb * ua + cosa * ut;
    return [ux, uy];
  });

  // Interpolated element coordinates (undeformed)
  const crd = Array.from({ length: nep }, (_, k) => {
    const t = k / (nep - 1);
    const x = p1.x + t * (p2.x - p1.x);
    const y = p1.y + t * (p2.y - p1.y);
    return [x, y];
  });

  // Apply scaled deformation to original coords
  const crd_xc = crd.map((p, k) => p[0] + sfac * u_xyc[k][0]);
  const crd_yc = crd.map((p, k) => p[1] + sfac * u_xyc[k][1]);

  return { crd_xc, crd_yc };
}

// Scale factor calculation
function defo_scale(nep, elements, coords, dispMap, ndm, ndf) {
  const ratio = 0.1;
  let min_crds = [], max_crds = [], max_u = [];

  if (ndm === 1) {
    min_crds = [Infinity];
    max_crds = [-Infinity];
    max_u = [-Infinity];

    for (const id in coords) {
      const crds = [coords[id].x];
      const u = Array.from({ length: ndf }, (_, k) => dispMap[id]?.[String(k+1)] ?? 0);

      min_crds[0] = Math.min(min_crds[0], crds[0]);
      max_crds[0] = Math.max(max_crds[0], crds[0]);
      max_u[0] = Math.max(max_u[0], Math.abs(u[0]));
    }
  } else if (ndm === 2) {
    min_crds = [Infinity, Infinity];
    max_crds = [-Infinity, -Infinity];
    max_u = [-Infinity, -Infinity, -Infinity];

    for (const id in coords) {
      const crds = [coords[id].x, coords[id].y];
      const u = Array.from({ length: 3 }, (_, k) => dispMap[id]?.[String(k+1)] ?? 0);

      min_crds[0] = Math.min(min_crds[0], crds[0]);
      min_crds[1] = Math.min(min_crds[1], crds[1]);
      max_crds[0] = Math.max(max_crds[0], crds[0]);
      max_crds[1] = Math.max(max_crds[1], crds[1]);
      max_u[0] = Math.max(max_u[0], Math.abs(u[0]));
      max_u[1] = Math.max(max_u[1], Math.abs(u[1]));
    }

    // Include interpolated transverse deformation
    const max_u_interp = max_u_abs_from_beam_defo_interp_2d(
      Math.max(...max_u),
      nep,
      elements,
      coords,
      dispMap
    );
    max_u[2] = max_u_interp;
  } else if (ndm === 3) {
    min_crds = [Infinity, Infinity, Infinity];
    max_crds = [-Infinity, -Infinity, -Infinity];
    max_u = [-Infinity, -Infinity, -Infinity];

    for (const id in coords) {
      const crds = [coords[id].x, coords[id].y, coords[id].z];
      const u = Array.from({ length: 3 }, (_, k) => dispMap[id]?.[String(k+1)] ?? 0);

      min_crds[0] = Math.min(min_crds[0], crds[0]);
      min_crds[1] = Math.min(min_crds[1], crds[1]);
      min_crds[2] = Math.min(min_crds[2], crds[2]);
      max_crds[0] = Math.max(max_crds[0], crds[0]);
      max_crds[1] = Math.max(max_crds[1], crds[1]);
      max_crds[2] = Math.max(max_crds[2], crds[2]);
      max_u[0] = Math.max(max_u[0], Math.abs(u[0]));
      max_u[1] = Math.max(max_u[1], Math.abs(u[1]));
      max_u[2] = Math.max(max_u[2], Math.abs(u[2]));
    }

    const max_u_interp = max_u_abs_from_beam_defo_interp_3d(
      Math.max(...max_u),
      nep,
      elements,
      coords,
      dispMap
    );
    max_u[2] = max_u_interp;
  }

  const dmax = max_crds.map((max, i) => max - min_crds[i]);
  const dlmax = Math.max(...dmax);

  const max_u_abs = Math.max(...max_u) || 1e-10; // avoid divide by zero
  const sfac = (ratio * dlmax) / max_u_abs;

  return sfac;
}

// Helper to calculate max displacement from beam interpolation
function max_u_abs_from_beam_defo_interp_2d(max_u_abs, nep, elements, coords, dispMap) {
  elements.forEach(el => {
    if (
      el.type === 'elasticBeamColumn' ||
      el.type === 'dispBeamColumn' ||
      el.type === 'forceBeamColumn'
    ) {
      const i = el.i, j = el.j;

      const p1 = coords[i], p2 = coords[j];
      if (!p1 || !p2) return;

      const u1 = Array.from({ length: 3 }, (_, k) => dispMap[i]?.[String(k+1)] ?? 0);
      const u2 = Array.from({ length: 3 }, (_, k) => dispMap[j]?.[String(k+1)] ?? 0);

      const u = [...u1, ...u2]; // Flattened DOF vector

      const { G, L } = rot_transf_2d(el, coords);

      // Local displacements u_l = G @ u
      const u_l = multiplyMatrixVector(G, u); // 6x1 result

      // Get transverse shape functions (nep points)
      const N_t = beam_transverse_shape_functions(L, nep); // nep x 4 matrix

      // Extract local uy1, rz1, uy2, rz2 (DOFs 1,2,4,5)                                                
      const u_t_vector = [u_l[1], u_l[2], u_l[4], u_l[5]];

      // Interpolate transverse displacement at integration points
      const u_tc = N_t.map(row =>
        row.reduce((sum, val, idx) => sum + val * u_t_vector[idx], 0)
      );

      // Max absolute transverse displacement
      const max_u_tc = Math.max(...u_tc.map(Math.abs));

      // Update global max
      max_u_abs = Math.max(max_u_abs, max_u_tc);
    }
  });

  return max_u_abs;
}

// Matrix-vector multiplication helper
function multiplyMatrixVector(matrix, vector) {
  return matrix.map(row =>
    row.reduce((sum, val, idx) => sum + val * vector[idx], 0)
  );
}

// Shape functions for transverse displacement
function beam_transverse_shape_functions(L, nep) {
  const xl = Array.from({ length: nep }, (_, i) => (L * i) / (nep - 1));
  const N_t = xl.map(x => {
    const term1 = 1 - 3 * (x ** 2) / (L ** 2) + 2 * (x ** 3) / (L ** 3);
    const term2 = x - 2 * (x ** 2) / L + (x ** 3) / (L ** 2);
    const term3 = 3 * (x ** 2) / (L ** 2) - 2 * (x ** 3) / (L ** 3);
    const term4 = - (x ** 2) / L + (x ** 3) / (L ** 2);
    return [term1, term2, term3, term4];
  });
  return N_t;
}

// Shape functions for axial displacement
function beam_axial_shape_functions(L, nep) {
  const xl = Array.from({ length: nep }, (_, i) => (L * i) / (nep - 1));
  const N_a = xl.map(x => {
    const term1 = 1 - x / L;
    const term2 = x / L;
    return [term1, term2];
  });
  return N_a;
}

// Rotation transformation for 2D elements
function rot_transf_2d(el, coords) {
  const p1 = coords[el.i], p2 = coords[el.j];
  const dx = p2.x - p1.x, dy = p2.y - p1.y;

  const L = Math.hypot(dx, dy) || 1; 
  const cosa = dx / L;
  const cosb = dy / L;

  const G = [
    [cosa,  cosb, 0,     0,     0, 0],
    [-cosb, cosa, 0,     0,     0, 0],
    [0,     0,    1,     0,     0, 0],
    [0,     0,    0,  cosa,  cosb, 0],
    [0,     0,    0, -cosb,  cosa, 0],
    [0,     0,    0,     0,     0, 1]
  ];

  return { G, L, cosa, cosb };
}

// Draw deflected nodes with delta x and y labels
function DrawNodesDeflected(g, coords, dispMap, xScale, yScale, sfac) {
  g.selectAll("*").remove();

  const data = Object.entries(coords).map(([id, p]) => {
    const ux = dispMap[id]?.["1"] || 0;
    const uy = dispMap[id]?.["2"] || 0;
    return {
      id: +id,
      x: p.x + ux * sfac,
      y: p.y + uy * sfac,
      dx: ux,
      dy: uy,
    };
  });

  // Draw deflected node circles
  const sel = g.selectAll("circle.node").data(data, d => d.id);
  sel.exit().remove();
  sel.enter()
    .append("circle")
      .attr("class", "node")
      .attr("r", 4)
      .attr("fill", "orange")
    .merge(sel)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y));

  // Draw node ID labels
  const idLabels = g.selectAll("text.node-id").data(data, d => d.id);
  idLabels.exit().remove();
  idLabels.enter()
    .append("text")
      .attr("class", "node-id")
      .attr("font-size", 10)
      .attr("fill", "#007bff")
      .attr("text-anchor", "start")
    .merge(idLabels)
      .attr("x", d => xScale(d.x) + 5)
      .attr("y", d => yScale(d.y) - 5)
      .text(d => `N${d.id}`);

  // Draw Δx, Δy displacement values
  const dispLabels = g.selectAll("text.node-disp").data(data, d => d.id);
  dispLabels.exit().remove();
  dispLabels.enter()
    .append("text")
      .attr("class", "node-disp")
      .attr("font-size", 20)
      .attr("fill", "#ff6600")
      .attr("text-anchor", "start")
    .merge(dispLabels)
      .attr("x", d => xScale(d.x) + 5)
      .attr("y", d => yScale(d.y) + 8)
      .text(d => `Δx=${(d.dx*1000).toFixed(3)} mm, Δy=${(d.dy*1000).toFixed(3)} mm`);
}

// Draw deflected supports
function DrawSupportsDeflected(g, supports, coords, dispMap, xScale, yScale, sfac) {
  g.selectAll("*").remove();
  supports.forEach(d => {
    const nodeId = d.nodeId;
    const p = coords[nodeId];
    if (!p) return;

    const nodeIdStr = String(nodeId);
    const ux = dispMap[nodeIdStr]?.["1"] || 0;
    const uy = dispMap[nodeIdStr]?.["2"] || 0;

    const x = xScale(p.x + ux * sfac);
    const y = yScale(p.y + uy * sfac) + 6;

    const nodeG = g.append("g").attr("transform", `translate(${x},${y})`);
    const v = d.value;
    const ndf = v.length;

    const supportColor = "#FF5722";
    const triangleWidth = 16, triangleHeight = 12;
    const rollerCircleRadius = 4, rollerCircleGap = 2, rollerCircleXOffset = 6;

    function drawTriangle(selection) {
      const w = triangleWidth / 2;
      const halfH = triangleHeight / 2;
      const pathData = `M ${-w} ${halfH} L ${w} ${halfH} L 0 ${-halfH} Z`;
      selection.append("path").attr("d", pathData).attr("fill", supportColor);
    }

    function drawRollerCircles(selection) {
      const yPos = triangleHeight / 2 + rollerCircleGap + rollerCircleRadius;
      selection.append("circle").attr("cx", -rollerCircleXOffset).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
      selection.append("circle").attr("cx", rollerCircleXOffset).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
    }

    function drawYRollerGroup(selection) {
      const group = selection.append("g")
        .attr("transform", `translate(6, -6) rotate(-90)`);  // tweak if needed

      const yPos = triangleHeight / 2 + rollerCircleGap + rollerCircleRadius;
      drawTriangle(group);
      group.append("circle").attr("cx", -rollerCircleXOffset).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
      group.append("circle").attr("cx", rollerCircleXOffset).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
    }

    function drawFixedBox(selection) {
      const halfH = triangleHeight / 2;
      selection.append("rect")
        .attr("x", -triangleWidth/2)
        .attr("y", -halfH)
        .attr("width", triangleWidth)
        .attr("height", triangleHeight)
        .attr("fill", supportColor);
    }

    if (ndf === 2) {
      const [fx, fy] = v;
      if (fx === 1 && fy === 1) {
        drawTriangle(nodeG); // pinned
      } else if (fx === 1 && fy === 0) {
        drawYRollerGroup(nodeG); // Y roller
      } else if (fx === 0 && fy === 1) {
        drawTriangle(nodeG); drawRollerCircles(nodeG); // X roller
      }
    } else if (ndf === 3) {
      const [uxc, uyc, rz] = v;
      if (uxc === 1 && uyc === 1 && rz === 1) {
        drawFixedBox(nodeG); // fixed
      } else if (uxc === 1 && uyc === 1 && rz === 0) {
        drawTriangle(nodeG); // pinned
      } else if (uxc === 1 && uyc === 0) {
        drawYRollerGroup(nodeG); // Y roller
      } else if (uxc === 0 && uyc === 1) {
        drawTriangle(nodeG); drawRollerCircles(nodeG); // X roller
      }
    }
  });
}


// Arrow markers for visualization
function defineArrowMarkers(svg) {
  const defs = svg.append("defs");
  defs.selectAll("marker").remove();
  defs.append("marker")
    .attr("id", "arrowhead-axial")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "red");
  defs.append("marker")
    .attr("id", "arrowhead-transverse")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "green");
}