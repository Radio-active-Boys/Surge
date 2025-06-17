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
  } = usePlotParser();

  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userScale, setUserScale] = useState(1);

  // Compute base scale factor so max deflection ~10% model size
  const baseSfac = useMemo(() => {
    if (!nodeDispSeries || nodeDispSeries.length === 0) return 1;
    const xs = Object.values(nodeCoordinates).map(d => d.x);
    const ys = Object.values(nodeCoordinates).map(d => d.y);
    if (xs.length === 0) return 1;
    const dx = d3.max(xs) - d3.min(xs);
    const dy = d3.max(ys) - d3.min(ys);
    const modelSize = Math.max(dx, dy) || 1;
    let maxDisp = 0;
    nodeDispSeries.forEach(entry => {
      Object.entries(entry.data).forEach(([_, dofMap]) => {
        const ux = dofMap[1] || 0;
        const uy = dofMap[2] || 0;
        const mag = Math.hypot(ux, uy);
        if (mag > maxDisp) maxDisp = mag;
      });
    });
    if (maxDisp === 0) return 1;
    return 0.1 * modelSize / maxDisp;
  }, [nodeCoordinates, nodeDispSeries]);
  const sfac = baseSfac * userScale;

  // Animation loop
  useEffect(() => {
    let timer;
    if (isPlaying && nodeDispSeries && nodeDispSeries.length > 0) {
      timer = setInterval(() => {
        setTimeIndex(idx => (idx + 1) % nodeDispSeries.length);
      }, 200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, nodeDispSeries]);

  // Initialize SVG and zoom only once
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    // Define markers
    defineArrowMarkers(svg);
    // Create root group for pan/zoom
    const root = svg.append("g").attr("class", "viewport");
    rootRef.current = root;
    // Set up zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
      });
    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
  }, []);

  // Main drawing on data or timeIndex change
  useEffect(() => {
    if (!rootRef.current) return;
    if (!nodeCoordinates || Object.keys(nodeCoordinates).length === 0) return;
    const svg = d3.select(svgRef.current);
    const root = rootRef.current;
    // Clear dynamic and original layers
    root.selectAll(".original, .elements, .nodes, .supports").remove();

    // Scales
    const xs = Object.values(nodeCoordinates).map(d => d.x);
    const ys = Object.values(nodeCoordinates).map(d => d.y);
    const xScale = d3.scaleLinear()
                     .domain(d3.extent(xs))
                     .range([margin, width - margin]);
    const yScale = d3.scaleLinear()
                     .domain(d3.extent(ys))
                     .range([height - margin, margin]);

    // Draw static original mesh
    const gOriginal = root.append("g").attr("class", "original");
    DrawOriginalElements(gOriginal, elementConnectivity, nodeCoordinates, xScale, yScale);
    DrawOriginalNodes(gOriginal, nodeCoordinates, xScale, yScale);
    DrawOriginalSupports(gOriginal, supports, nodeCoordinates, xScale, yScale);

    // Dynamic layers
    const gElements = root.append("g").attr("class", "elements");
    const gNodes = root.append("g").attr("class", "nodes");
    const gSupports = root.append("g").attr("class", "supports");

    const dispMap = nodeDispSeries?.[timeIndex]?.data || {};
    // Draw deflected
    DrawElementsDeflected(
      gElements,
      elementConnectivity,
      nodeCoordinates,
      dispMap,
      xScale,
      yScale,
      sfac
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
  }, [nodeCoordinates, elementConnectivity, supports, timeIndex, width, height, margin, sfac]);

  return (
    <div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: "1px solid #ccc", background: "#fafafa" }}
      />
      {/* Controls moved below SVG */}
      {nodeDispSeries && nodeDispSeries.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setIsPlaying(p => !p)}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <input
            type="range"
            min={0}
            max={nodeDispSeries.length - 1}
            value={timeIndex}
            onChange={e => { setTimeIndex(+e.target.value); setIsPlaying(false); }}
          />
          <span>{nodeDispSeries[timeIndex]?.time?.toFixed(3) ?? ''}s</span>
          <label>
            Scale:
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={userScale}
              onChange={e => setUserScale(parseFloat(e.target.value))}
              style={{ marginLeft: '5px' }}
            /> {userScale.toFixed(1)}x
          </label>
        </div>
      )}
    </div>
  );
}

// Static original drawings
function DrawOriginalElements(g, elements, coords, xScale, yScale) {
  g.selectAll("*").remove();
  elements.forEach(el => {
    const p1 = coords[el.i], p2 = coords[el.j];
    if (!p1 || !p2) return;
    const x1 = xScale(p1.x), y1 = yScale(p1.y);
    const x2 = xScale(p2.x), y2 = yScale(p2.y);
    g.append("line")
      .attr("x1", x1).attr("y1", y1)
      .attr("x2", x2).attr("y2", y2)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");
  });
}

function DrawOriginalNodes(g, coords, xScale, yScale) {
  const data = Object.entries(coords).map(([id, p]) => ({ id: +id, x: p.x, y: p.y }));
  const sel = g.selectAll("circle.orig-node").data(data, d => d.id);
  sel.exit().remove();
  sel.enter()
    .append("circle")
      .attr("class", "orig-node")
      .attr("r", 3)
      .attr("fill", "#999")
    .merge(sel)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y));
}

function DrawOriginalSupports(g, supports, coords, xScale, yScale) {
  supports.forEach(d => {
    const nodeId = d.nodeId;
    const p = coords[nodeId];
    if (!p) return;
    const x = xScale(p.x);
    const y = yScale(p.y) + 6;
    const nodeG = g.append("g").attr("transform", `translate(${x},${y})`);
    const v = d.value;
    const ndf = v.length;
    const supportColor = "#ccc";
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
      selection.append("circle").attr("cx", -xOff).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
      selection.append("circle").attr("cx", xOff).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
    }
    function drawFixedBox(selection) {
      const w = triangleWidth;
      const halfH = triangleHeight / 2;
      selection.append("rect").attr("x", -w/2).attr("y", -halfH).attr("width", w).attr("height", triangleHeight).attr("fill", supportColor);
    }
    if (ndf === 2) {
      const [fx, fy] = v;
      if (fx === 1 && fy === 1) drawTriangle(nodeG);
      else if (fx === 1 || fy === 1) { drawTriangle(nodeG); drawRollerCircles(nodeG); }
    } else if (ndf === 3) {
      const [uxc, uyc, rz] = v;
      if (uxc === 1 && uyc === 1 && rz === 1) drawFixedBox(nodeG);
      else if (uxc === 1 && uyc === 1 && rz === 0) drawTriangle(nodeG);
      else if ((uxc === 1 && uyc === 0) || (uxc === 0 && uyc === 1)) { drawTriangle(nodeG); drawRollerCircles(nodeG); }
    }
  });
}

function DrawElementsDeflected(g, elements, coords, dispMap, xScale, yScale, sfac) {
  g.selectAll("*").remove();
  elements.forEach(el => {
    const p1 = coords[el.i], p2 = coords[el.j];
    if (!p1 || !p2) return;
    const ux1 = dispMap[el.i]?.[1] || 0;
    const uy1 = dispMap[el.i]?.[2] || 0;
    const rot1 = dispMap[el.i]?.[3] || 0;
    const ux2 = dispMap[el.j]?.[1] || 0;
    const uy2 = dispMap[el.j]?.[2] || 0;
    const rot2 = dispMap[el.j]?.[3] || 0;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const L = Math.hypot(dx, dy) || 1;
    const cos = dx / L, sin = dy / L;
    const u1_local_x = ux1 * sfac * cos + uy1 * sfac * sin;
    const u1_local_y = -ux1 * sfac * sin + uy1 * sfac * cos;
    const u2_local_x = ux2 * sfac * cos + uy2 * sfac * sin;
    const u2_local_y = -ux2 * sfac * sin + uy2 * sfac * cos;
    const r1 = rot1;
    const r2 = rot2;
    const nep = 17;
    const xs = [];
    const ys = [];
    for (let k = 0; k <= nep; k++) {
      const s = (k / nep) * L;
      const N1a = 1 - s / L;
      const N2a = s / L;
      const ua = N1a * u1_local_x + N2a * u2_local_x;
      const xi = s / L;
      const N1t = 1 - 3 * xi * xi + 2 * xi * xi * xi;
      const N2t = L * (xi - 2 * xi * xi + xi * xi * xi);
      const N3t = 3 * xi * xi - 2 * xi * xi * xi;
      const N4t = L * (-xi * xi + xi * xi * xi);
      const ut = N1t * u1_local_y + N2t * r1 + N3t * u2_local_y + N4t * r2;
      const xg = p1.x + (s + ua) * cos - ut * sin;
      const yg = p1.y + (s + ua) * sin + ut * cos;
      xs.push(xScale(xg));
      ys.push(yScale(yg));
    }
    const line = d3.line().x((d,i) => xs[i]).y((d,i) => ys[i]);
    g.append("path")
      .datum(xs)
      .attr("d", line)
      .attr("stroke", "blue")
      .attr("stroke-width", 2)
      .attr("fill", "none");
  });
}

function DrawNodesDeflected(g, coords, dispMap, xScale, yScale, sfac) {
  g.selectAll("*").remove();
  const data = Object.entries(coords).map(([id, p]) => {
    const ux = dispMap[id]?.[1] || 0;
    const uy = dispMap[id]?.[2] || 0;
    return { id: +id, x: p.x + ux * sfac, y: p.y + uy * sfac };
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

function DrawSupportsDeflected(g, supports, coords, dispMap, xScale, yScale, sfac) {
  g.selectAll("*").remove();
  supports.forEach(d => {
    const nodeId = d.nodeId;
    const p = coords[nodeId];
    if (!p) return;
    const ux = dispMap[nodeId]?.[1] || 0;
    const uy = dispMap[nodeId]?.[2] || 0;
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
      selection.append("circle").attr("cx", -xOff).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
      selection.append("circle").attr("cx", xOff).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
    }
    function drawFixedBox(selection) {
      const w = triangleWidth;
      const halfH = triangleHeight / 2;
      selection.append("rect").attr("x", -w/2).attr("y", -halfH).attr("width", w).attr("height", triangleHeight).attr("fill", supportColor);
    }
    if (ndf === 2) {
      const [fx, fy] = v;
      if (fx === 1 && fy === 1) drawTriangle(nodeG);
      else if (fx === 1 || fy === 1) { drawTriangle(nodeG); drawRollerCircles(nodeG); }
    } else if (ndf === 3) {
      const [uxc, uyc, rz] = v;
      if (uxc === 1 && uyc === 1 && rz === 1) drawFixedBox(nodeG);
      else if (uxc === 1 && uyc === 1 && rz === 0) drawTriangle(nodeG);
      else if ((uxc === 1 && uyc === 0) || (uxc === 0 && uyc === 1)) { drawTriangle(nodeG); drawRollerCircles(nodeG); }
    }
  });
}

function defineArrowMarkers(svg) {
  const defs = svg.append("defs");
  defs.selectAll("marker").remove();
  defs.append("marker").attr("id", "arrowhead-axial").attr("viewBox", "0 -5 10 10").attr("refX", 10).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "red");
  defs.append("marker").attr("id", "arrowhead-transverse").attr("viewBox", "0 -5 10 10").attr("refX", 10).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "green");
}
