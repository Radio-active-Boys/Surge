// src/components/visualization/ModelViewer.jsx
import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { usePlotParser } from "../../utils/plotParser";

export default function ModelViewer({ width = 850, height = 600, margin = 20 }) {
  const {
    nodeCoordinates = {},
    elementConnectivity = [],
    supports = [],
    loads = [],
    eleLoads = [],
  } = usePlotParser();

  const svgRef = useRef();

  useEffect(() => {
    const svg = d3.select(svgRef.current);

    const existingRoot = svg.select("g.viewport");
    const prevTransform = !existingRoot.empty()
      ? d3.zoomTransform(existingRoot.node())
      : d3.zoomIdentity;

    svg.select("defs").remove();
    existingRoot.remove();

    defineArrowMarkers(svg);

    const xs = Object.values(nodeCoordinates).map(d => d.x);
    const ys = Object.values(nodeCoordinates).map(d => d.y);
    const minX = xs.length ? Math.floor(d3.min(xs)) - 20 : -50;
    const maxX = xs.length ? Math.ceil(d3.max(xs)) + 20 : 50;
    const minY = ys.length ? Math.floor(d3.min(ys)) - 20 : -50;
    const maxY = ys.length ? Math.ceil(d3.max(ys)) + 20 : 50;

    const xScale = d3.scaleLinear().domain([minX, maxX]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([minY, maxY]).range([height - margin, margin]);

    const root = svg.append("g")
      .attr("class", "viewport")
      .attr("transform", prevTransform); 

    svg.call(
      d3.zoom()
        .scaleExtent([0.05, 50])
        .on("zoom", e => root.attr("transform", e.transform))
    ).on("dblclick.zoom", null);

    drawGrid(root, xScale, yScale, minX, maxX, minY, maxY);

    if (!Object.keys(nodeCoordinates).length) return;

    const gElements   = root.append("g").attr("class", "elements");
    const gNodes      = root.append("g").attr("class", "nodes");
    const gSupports   = root.append("g").attr("class", "supports");
    const gEleLoads   = root.append("g").attr("class", "element-loads");
    const gNodalLoads = root.append("g").attr("class", "nodal-loads");

    DrawEleLoads(gEleLoads, eleLoads, elementConnectivity, nodeCoordinates, xScale, yScale);
    DrawElements(gElements, elementConnectivity, nodeCoordinates, xScale, yScale);
    DrawNodes(gNodes, nodeCoordinates, xScale, yScale);
    DrawSupports(gSupports, supports, nodeCoordinates, xScale, yScale);
    DrawLoads(gNodalLoads, loads, nodeCoordinates, xScale, yScale);

  }, [nodeCoordinates, elementConnectivity, supports, loads, eleLoads, width, height, margin]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="model-viewer"
    />
  );
}

// ─── DRAW GRID ─────────────────────────────────────────────────────────
function drawGrid(g, xScale, yScale, xStart, xEnd, yStart, yEnd) {
  const gx = d3.range(xStart, xEnd + 0.5, 0.5);
  const gy = d3.range(yStart, yEnd + 0.5, 0.5);

  gx.forEach(x => {
    g.append("line")
      .attr("x1", xScale(x)).attr("y1", yScale(yStart))
      .attr("x2", xScale(x)).attr("y2", yScale(yEnd))
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.3)
      .attr("stroke-opacity", 0.6);
  });
  gy.forEach(y => {
    g.append("line")
      .attr("x1", xScale(xStart)).attr("y1", yScale(y))
      .attr("x2", xScale(xEnd)).attr("y2", yScale(y))
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.3)
      .attr("stroke-opacity", 0.6);
  });

  g.append("line")
    .attr("x1", xScale(xStart)).attr("y1", yScale(0))
    .attr("x2", xScale(xEnd)).attr("y2", yScale(0))
    .attr("stroke", "red")
    .attr("stroke-width", 0.5)
    .attr("stroke-opacity", 0.4)
    .attr("marker-end", "url(#axis-arrow)");

  g.append("line")
    .attr("x1", xScale(0)).attr("y1", yScale(yStart))
    .attr("x2", xScale(0)).attr("y2", yScale(yEnd))
    .attr("stroke", "green")
    .attr("stroke-width", 0.5)
    .attr("stroke-opacity", 0.4)
    .attr("marker-end", "url(#axis-arrow)");

  g.append("text")
    .attr("x", xScale(xEnd) - 10)
    .attr("y", yScale(0) - 6)
    .text("X")
    .attr("font-size", 11)
    .attr("fill", "red");

  g.append("text")
    .attr("x", xScale(0) + 6)
    .attr("y", yScale(yEnd) + 14)
    .text("Y")
    .attr("font-size", 11)
    .attr("fill", "green");
}


// ─── DRAW ELEMENTS ────────────────────────────────────────────────────────
function DrawElements(g, elements, coords, xScale, yScale) {
  g.selectAll("*").remove();

  elements.forEach(el => {
    const p1 = coords[el.i], p2 = coords[el.j];
    if (!p1 || !p2) return;

    const x1 = xScale(p1.x), y1 = yScale(p1.y);
    const x2 = xScale(p2.x), y2 = yScale(p2.y);

    // element line
    g.append("line")
      .attr("class", "element")
      .attr("x1", x1).attr("y1", y1)
      .attr("x2", x2).attr("y2", y2)
      .attr("stroke", "blue")
      .attr("stroke-width", 1.8);

    // midpoint
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    // element ID label at midpoint
    g.append("text")
      .attr("x", mx + 3)
      .attr("y", my - 3)
      .attr("text-anchor", "middle")
      .attr("font-size", 3)
      .attr("fill", "blue")
      .text(`E${el.id}`);

    // local axes (optional)
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (!len) return;
    const ux = dx / len, uy = dy / len;
    const sA = [xScale(p1.x), yScale(p1.y)];
    const sB = [xScale(p1.x + ux * 0.01 * len), yScale(p1.y + uy * 0.01 * len)];
    let dirX = sB[0] - sA[0], dirY = sB[1] - sA[1];
    const nm = Math.hypot(dirX, dirY) || 1;
    dirX /= nm; dirY /= nm;
    const perpX = -dirY, perpY = dirX;

    const arrowPx = 8;
    // local x-axis
    const tx = mx + dirX * arrowPx, ty = my + dirY * arrowPx;
    g.append("line")
      .attr("x1", mx).attr("y1", my)
      .attr("x2", tx).attr("y2", ty)
      .attr("stroke", "red")
      .attr("stroke-width", 0.5)
      .attr("marker-end", "url(#arrowhead-axial)");

    // local y-axis
    const qx = mx + perpX * -arrowPx, qy = my + perpY * -arrowPx;
    g.append("line")
      .attr("x1", mx).attr("y1", my)
      .attr("x2", qx).attr("y2", qy)
      .attr("stroke", "green")
      .attr("stroke-width", 0.5)
      .attr("marker-end", "url(#arrowhead-transverse)");
  });
}


// ─── DRAW NODES ───────────────────────────────────────────────────────────
function DrawNodes(g, coords, xScale, yScale) {
  const data = Object.entries(coords).map(([id, p]) => ({ id: +id, x: p.x, y: p.y }));

  // Draw node circles
  const sel = g.selectAll("circle.node").data(data, d => d.id);
  sel.exit().remove();
  sel.enter()
    .append("circle")
      .attr("class", "node")
      .attr("r", 1.5)
      .attr("fill", "#007bff")
    .merge(sel)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y));

  // Draw node labels
  const labels = g.selectAll("text.node-label").data(data, d => d.id);
  labels.exit().remove();
  labels.enter()
    .append("text")
      .attr("class", "node-label")
      .attr("font-size", 3)
      .attr("fill", "#007bff")
      .attr("text-anchor", "start")
    .merge(labels)
      .attr("x", d => xScale(d.x) + 3)
      .attr("y", d => yScale(d.y) - 3)
      .text(d => `N${d.id}`);
}

// ─── DRAW SUPPORTS ───────────────────────────────────────────────────────
function DrawSupports(g, supports, coords, xScale, yScale) {
  const supportColor        = "#FF5722";
  const triangleWidth       = 4;
  const triangleHeight      = 3;
  const rollerCircleRadius  = 1;
  const rollerCircleGap     = 0.5;
  const rollerCircleXOffset = 1.5;
  const verticalShift       = 1.5;

  const sel = g.selectAll("g.support").data(supports, d => d.nodeId);
  sel.exit().remove();
  const enter = sel.enter().append("g").attr("class", "support");
  enter.merge(sel)
    .attr("transform", d => {
      const { x, y } = coords[d.nodeId];
      return `translate(${xScale(x)},${yScale(y) + verticalShift})`;
    })
    .each(function(d) {
      const nodeG = d3.select(this);
      nodeG.selectAll("*").remove();
      const v = d.value, ndf = v.length;

      function drawTriangle(sel) {
        const w = triangleWidth / 2, h = triangleHeight / 2;
        sel.append("path")
           .attr("d", `M${-w} ${h} L${w} ${h} L0 ${-h} Z`)
           .attr("fill", supportColor);
      }
      function drawRollers(sel) {
        const yPos = triangleHeight/2 + rollerCircleGap + rollerCircleRadius;
        sel.append("circle").attr("cx", -rollerCircleXOffset).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
        sel.append("circle").attr("cx",  rollerCircleXOffset).attr("cy", yPos).attr("r", rollerCircleRadius).attr("fill", supportColor);
      }
      function drawBox(sel) {
        sel.append("rect")
           .attr("x", -triangleWidth/2).attr("y", -triangleHeight/2)
           .attr("width", triangleWidth)
           .attr("height", triangleHeight)
           .attr("fill", supportColor);
      }

      if (ndf === 2) {
        const [fx, fy] = v;
        if (fx && fy) drawTriangle(nodeG);
        else if (fx || fy) { drawTriangle(nodeG); drawRollers(nodeG); }
      } else {
        const [ux, uy, rz] = v;
        if (ux && uy && rz) drawBox(nodeG);
        else if (ux && uy) drawTriangle(nodeG);
        else if (ux || uy) { drawTriangle(nodeG); drawRollers(nodeG); }
      }
    });
}

// ─── DRAW NODAL LOADS ─────────────────────────────────────────────────────
function DrawLoads(g, loads, coords, xScale, yScale) {
  const colorX = "#007bff", colorY = "#28a745";
  const arrowLength = 6, headLength = 1.5, headWidth = 2.2;

  const sel = g.selectAll("g.load").data(loads, d => d.nodeId);
  sel.exit().remove();
  const enter = sel.enter().append("g").attr("class", "load");
  enter.append("g").attr("class", "arrow-x");
  enter.append("g").attr("class", "arrow-y");

  enter.merge(sel)
    .attr("transform", d => {
      const { x, y } = coords[d.nodeId];
      return `translate(${xScale(x)},${yScale(y)})`;
    })
    .each(function (d) {
      const nodeG = d3.select(this);
      const [fx = 0, fy = 0] = d.values;
      nodeG.select(".arrow-x").selectAll("*").remove();
      nodeG.select(".arrow-y").selectAll("*").remove();

      function drawArrow(subG, dx, dy, color, value) {
        const L = arrowLength;
        const tipX = dx * L, tipY = dy * L;
        const shaftX = dx * (L - headLength), shaftY = dy * (L - headLength);

        // Shaft
        subG.append("line")
          .attr("x1", 0).attr("y1", 0)
          .attr("x2", shaftX).attr("y2", shaftY)
          .attr("stroke", color)
          .attr("stroke-width", 0.8);

        // Arrowhead (wide triangle)
        const baseLeftX = tipX - dx * headLength - dy * headWidth / 2;
        const baseLeftY = tipY - dy * headLength + dx * headWidth / 2;
        const baseRightX = tipX - dx * headLength + dy * headWidth / 2;
        const baseRightY = tipY - dy * headLength - dx * headWidth / 2;

        subG.append("path")
          .attr("d", d3.line()([
            [tipX, tipY],
            [baseLeftX, baseLeftY],
            [baseRightX, baseRightY],
            [tipX, tipY]
          ]))
          .attr("fill", color);

        // Label
        const offset = 5;
        subG.append("text")
          .attr("x", tipX + dx * offset)
          .attr("y", tipY + dy * offset - 1.5)
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "baseline")
          .attr("font-size", 2.5)
          .attr("fill", color)
          .text(Math.abs(value))
      }

      if (fx) drawArrow(nodeG.select(".arrow-x"), fx > 0 ? 1 : -1, 0, colorX, fx);
      if (fy) drawArrow(nodeG.select(".arrow-y"), 0, fy > 0 ? -1 : 1, colorY, fy);
    });
}

// ─── DRAW ELEMENT LOADS ──────────────────────────────────────────────────
function DrawEleLoads(g, eleLoads, elements, coords, xScale, yScale) {
  function expandRange(range) {
    return elements
      .filter(el => el.id >= range.start && el.id <= range.end)
      .map(el => el.id);
  }

  g.selectAll("*").remove();
  const sampleCount = 30;
  const headLength = 1.5, headWidth = 2.2;

  eleLoads.forEach(load => {
    const ids = Array.isArray(load.eleIds) ? load.eleIds : (load.range ? expandRange(load.range) : []);
    ids.forEach(eleId => {
      const el = elements.find(e => e.id === eleId);
      if (!el) return;

      const p1 = coords[el.i], p2 = coords[el.j];
      if (!p1 || !p2) return;

      const x1 = xScale(p1.x), y1 = yScale(p1.y);
      const x2 = xScale(p2.x), y2 = yScale(p2.y);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      const arrowLen = Math.min(4, len * 0.08);

      function drawArrow(baseX, baseY, dirX, dirY, color, label) {
        const tipX = baseX + dirX * arrowLen;
        const tipY = baseY + dirY * arrowLen;

        // Shaft
        g.append("line")
         .attr("x1", baseX).attr("y1", baseY)
         .attr("x2", tipX - dirX * headLength).attr("y2", tipY - dirY * headLength)
         .attr("stroke", color).attr("stroke-width", 0.5);

        // Arrowhead
        const baseLeftX = tipX - dirX * headLength - dirY * headWidth / 2;
        const baseLeftY = tipY - dirY * headLength + dirX * headWidth / 2;
        const baseRightX = tipX - dirX * headLength + dirY * headWidth / 2;
        const baseRightY = tipY - dirY * headLength - dirX * headWidth / 2;

        g.append("path")
         .attr("d", d3.line()([
           [tipX, tipY],
           [baseLeftX, baseLeftY],
           [baseRightX, baseRightY],
           [tipX, tipY]
         ])).attr("fill", color);

        // Label
        const offset = 2.5;
        g.append("text")
         .attr("x", tipX + dirX * offset)
         .attr("y", tipY + dirY * offset)
         .attr("text-anchor", "middle")
         .attr("alignment-baseline", "middle")
         .attr("font-size", 2.5)
         .attr("fill", color)
         .text(label);
      }

      if (load.type === "beamPoint") {
        const { Py, Px, xL } = load.params;
        if (xL == null) return;
        const baseX = x1 + ux * (xL * len);
        const baseY = y1 + uy * (xL * len);

        if (Py) {
          const dir = -(Math.sign(Py) || 1);
          drawArrow(baseX, baseY, nx * dir, ny * dir, "steelblue", Math.abs(Py));
        }
        if (Px) {
          const dir = -(Math.sign(Px) || 1);
          drawArrow(baseX, baseY, ux * dir, uy * dir, "gray", Math.abs(Px));
        }

      } else if (load.type === "beamUniform") {
        const p = load.params;
        if (p.Wy != null) {
          p.Wy_start = p.Wy;
          p.Wy_end = p.Wy;
          p.aL = 0;
          p.bL = 1;
        }
        if ([p.Wy_start, p.Wy_end, p.aL, p.bL].some(v => v == null)) return;

        const maxM = Math.max(Math.abs(p.Wy_start), Math.abs(p.Wy_end), 1);
        for (let i = 0; i <= sampleCount; i++) {
          const t = p.aL + (p.bL - p.aL) * (i / sampleCount);
          const bx = x1 + ux * (t * len);
          const by = y1 + uy * (t * len);
          const mag = p.Wy_start + (p.Wy_end - p.Wy_start) * ((t - p.aL) / (p.bL - p.aL));
          const dir = -(Math.sign(mag) || 1);
          const scale = Math.abs(mag) / maxM;
          drawArrow(bx, by, nx * dir * scale, ny * dir * scale, "purple", (i === 0 || i === sampleCount) ? Math.abs(mag) : "");
        }
      }
    });
  });
}

// ─── SVG MARKER DEFINITIONS ───────────────────────────────────────────────
function defineArrowMarkers(svg) {
  const defs = svg.append("defs");

  // tiny axis arrow (2×2px)
  defs.append("marker")
    .attr("id", "axis-arrow")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", 2)
    .attr("markerHeight", 2)
    .attr("refX", 0)
    .attr("refY", 1)
    .attr("orient", "auto")
    .append("path")
      .attr("d", "M0,0 L0,2 L2,1 Z")
      .attr("fill", "#888")
      .attr("fill-opacity", 0.8);

  // tiny transverse arrowhead (2×2px)
  defs.append("marker")
    .attr("id", "arrowhead-transverse")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", 2)
    .attr("markerHeight", 2)
    .attr("refX", 0)
    .attr("refY", 1)
    .attr("orient", "auto")
    .append("path")
      .attr("d", "M0,0 L0,2 L2,1 Z")
      .attr("fill", "currentColor");

  // tiny axial arrowhead (2×2px)
  defs.append("marker")
    .attr("id", "arrowhead-axial")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", 2)
    .attr("markerHeight", 2)
    .attr("refX", 0)
    .attr("refY", 1)
    .attr("orient", "auto")
    .append("path")
      .attr("d", "M0,0 L0,2 L2,1 Z")
      .attr("fill", "currentColor");
}
