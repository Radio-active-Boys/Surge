import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { usePlotParser } from "../../utils/plotParser";

export default function DeflectedShape({ width = 1000, height = 600, margin = 40 }) {
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

  // Compute base scale factor
  const baseSfac = useMemo(
    () =>
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

  // Animation loop
  useEffect(() => {
    let timer;
    if (isPlaying && nodeDispSeries && nodeDispSeries.length > 0) {
      timer = setInterval(() => {
        setTimeIndex((idx) => (idx + 1) % nodeDispSeries.length);
      }, 200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, nodeDispSeries]);

  // Initialize SVG and zoom
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    defineArrowMarkers(svg);

    const root = svg.append("g").attr("class", "viewport");
    rootRef.current = root;

    const zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
  }, []);

  // Main drawing
  useEffect(() => {
    if (!rootRef.current) return;
    if (!nodeCoordinates || Object.keys(nodeCoordinates).length === 0) return;

    const svg = d3.select(svgRef.current);
    const root = rootRef.current;
    root.selectAll(".original, .elements, .nodes, .supports").remove();

    // Gather original coordinates
    const xs0 = Object.values(nodeCoordinates).map((d) => d.x);
    const ys0 = Object.values(nodeCoordinates).map((d) => d.y);

    // Build displacement map for current time
    const dispMap = nodeDispSeries?.[timeIndex]?.data || {};

    // Compute domains
    let [xMin, xMax] = d3.extent(xs0);
    let [yMin, yMax] = d3.extent(ys0);

    // Handle degenerate X domain
    if (xMin === xMax) {
      xMin -= 1;
      xMax += 1;
    }

    // Handle degenerate Y domain by padding with max deflection
    if (yMin === yMax) {
      const maxUy =
        d3.max(Object.values(dispMap), (d) => Math.abs(d?.["2"]) * sfac) || 1;
      yMin -= maxUy;
      yMax += maxUy;
    }

    const xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([margin, width - margin]);
    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height - margin, margin]);

    // Layers: draw original
    const gOriginal = root.append("g").attr("class", "original");
    elementConnectivity.forEach((el) => {
      const p1 = nodeCoordinates[el.i];
      const p2 = nodeCoordinates[el.j];
      if (!p1 || !p2) return;
      gOriginal
        .append("line")
        .attr("x1", xScale(p1.x))
        .attr("y1", yScale(p1.y))
        .attr("x2", xScale(p2.x))
        .attr("y2", yScale(p2.y))
        .attr("stroke", "grey")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 2")
        .attr("opacity", 0.6);
    });

    // Layers
    const gElements = root.append("g").attr("class", "elements");
    const gNodes = root.append("g").attr("class", "nodes");
    const gSupports = root.append("g").attr("class", "supports");

    DrawElementsDeflected(
      gElements,
      elementConnectivity,
      nodeCoordinates,
      dispMap,
      xScale,
      yScale,
      sfac,
      ndm,
      ndf
    );
    DrawNodesDeflected(
      gNodes,
      nodeCoordinates,
      dispMap,
      xScale,
      yScale,
      sfac
    );
    DrawSupportsDeflected(
      gSupports,
      supports,
      nodeCoordinates,
      dispMap,
      xScale,
      yScale,
      sfac
    );
  }, [
    nodeCoordinates,
    elementConnectivity,
    supports,
    timeIndex,
    width,
    height,
    margin,
    sfac,
  ]);

  return (
    <div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: "1px solid #ccc", background: "#fafafa" }}
      />
      {nodeDispSeries && nodeDispSeries.length > 0 && (
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button onClick={() => setIsPlaying((p) => !p)}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={nodeDispSeries.length - 1}
            value={timeIndex}
            onChange={(e) => {
              setTimeIndex(+e.target.value);
              setIsPlaying(false);
            }}
          />
          <span>{nodeDispSeries[timeIndex]?.time?.toFixed(3) ?? ""}s</span>
          <label>
            Scale:
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={userScale}
              onChange={(e) => setUserScale(parseFloat(e.target.value))}
              style={{ marginLeft: "5px" }}
            />
            {userScale.toFixed(1)}x
          </label>
        </div>
      )}
    </div>
  );
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
    console.log("Disp map",dispMap)
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
      console.log("el.type",el.type)
      const rz1 = dispMap[nodeI]?.["3"] || 0;
      const rz2 = dispMap[nodeJ]?.["3"] || 0;
      
      const dispMapForInterp = {
        [nodeI]: [ux1, uy1, rz1],
        [nodeJ]: [ux2, uy2, rz2]
      };
      
      const result = beam_defo_interp_2d(nep, el, sfac, coords, dispMapForInterp, ndm, ndf);
      console.log("result",result)

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
        console.log("Deformation node 1 ",ux1," ", uy1," ",rz1)
        console.log("Deformation node 2 ",ux2," ", uy2," ",rz2)
        const x1d = p1.x + ux1 * sfac;
        const y1d = p1.y + uy1 * sfac;
        const x2d = p2.x + ux2 * sfac;
        const y2d = p2.y + uy2 * sfac;
        
        // Add this after beam_defo_interp_2d call
        console.log("Original points:",{ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
        console.log("Deformed endpoints:",{ x1d: x1d, y1d: y1d, x2d: x2d, y2d: y2d });
        console.log("Interpolated start:",{ x0: result.crd_xc[0], y0: result.crd_yc[0] });
        console.log("Interpolated end:",{ xn: result.crd_xc.slice(-1)[0], yn: result.crd_yc.slice(-1)[0] });
        
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

// Draw deflected nodes
function DrawNodesDeflected(g, coords, dispMap, xScale, yScale, sfac) {
  g.selectAll("*").remove();
  const data = Object.entries(coords).map(([id, p]) => {
    // Use string keys for DOF access
    const ux = dispMap[id]?.["1"] || 0;
    const uy = dispMap[id]?.["2"] || 0;
    return { 
      id: +id, 
      x: p.x + ux * sfac, 
      y: p.y + uy * sfac 
    };
  });
  
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
      const halfH = triangleHeight / 2;
      const yPos = halfH + rollerCircleGap + rollerCircleRadius;
      const xOff = rollerCircleXOffset;
      selection.append("circle")
        .attr("cx", -xOff)
        .attr("cy", yPos)
        .attr("r", rollerCircleRadius)
        .attr("fill", supportColor);
      selection.append("circle")
        .attr("cx", xOff)
        .attr("cy", yPos)
        .attr("r", rollerCircleRadius)
        .attr("fill", supportColor);
    }
    
    function drawFixedBox(selection) {
      const w = triangleWidth;
      const halfH = triangleHeight / 2;
      selection.append("rect")
        .attr("x", -w/2)
        .attr("y", -halfH)
        .attr("width", w)
        .attr("height", triangleHeight)
        .attr("fill", supportColor);
    }
    
    if (ndf === 2) {
      const [fx, fy] = v;
      if (fx === 1 && fy === 1) drawTriangle(nodeG);
      else if (fx === 1 || fy === 1) { 
        drawTriangle(nodeG); 
        drawRollerCircles(nodeG); 
      }
    } else if (ndf === 3) {
      const [uxc, uyc, rz] = v;
      if (uxc === 1 && uyc === 1 && rz === 1) drawFixedBox(nodeG);
      else if (uxc === 1 && uyc === 1 && rz === 0) drawTriangle(nodeG);
      else if ((uxc === 1 && uyc === 0) || (uxc === 0 && uyc === 1)) { 
        drawTriangle(nodeG); 
        drawRollerCircles(nodeG); 
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