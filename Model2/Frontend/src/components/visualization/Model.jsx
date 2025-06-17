// src/components/visualization/Model.jsx

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { usePlotParser } from "../../utils/plotParser";

export default function Model({ width = 1000, height = 600, margin = 40 }) {
  const {
    nodeCoordinates,
    elementConnectivity,
    supports,
    loads,
    eleLoads,
  } = usePlotParser();

  const svgRef = useRef();

  useEffect(() => {
    if (!nodeCoordinates || Object.keys(nodeCoordinates).length === 0) return;

    // 1) Prepare SVG and defs
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    defineArrowMarkers(svg);

    // 2) Compute scales
    const xs = Object.values(nodeCoordinates).map(d => d.x);
    const ys = Object.values(nodeCoordinates).map(d => d.y);
    const xScale = d3.scaleLinear()
                     .domain(d3.extent(xs))
                     .range([margin, width - margin]);
    const yScale = d3.scaleLinear()
                     .domain(d3.extent(ys))
                     .range([height - margin, margin]);

    // 3) Setup zoomable group
    const root = svg.append("g").attr("class", "viewport");
    svg.call(d3.zoom()
            .scaleExtent([0.2, 5])
            .on("zoom", e => root.attr("transform", e.transform)))
       .on("dblclick.zoom", null);

    // 4) Layers
    const gEleLoads   = root.append("g").attr("class", "element-loads");
    const gElements   = root.append("g").attr("class", "elements");
    const gNodes      = root.append("g").attr("class", "nodes");
    const gSupports   = root.append("g").attr("class", "supports");
    const gNodalLoads = root.append("g").attr("class", "nodal-loads");

    // 5) Draw
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
      style={{ border: "1px solid #ccc", background: "#fafafa" }}
    />
  );
}

// ─── DRAW ELEMENTS ────────────────────────────────────────────────────────
function DrawElements(g, elements, coords, xScale, yScale) {
  g.selectAll("*").remove();

  elements.forEach(el => {
    const p1 = coords[el.i], p2 = coords[el.j];
    if (!p1 || !p2) return;

    // Global endpoints in screen coords
    const x1 = xScale(p1.x), y1 = yScale(p1.y);
    const x2 = xScale(p2.x), y2 = yScale(p2.y);

    // Draw element line
    g.append("line")
      .attr("class", "element")
      .attr("x1", x1).attr("y1", y1)
      .attr("x2", x2).attr("y2", y2)
      .attr("stroke", "#666")
      .attr("stroke-width", 2);

    // Compute midpoint in screen space
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    // Compute element orientation in model space
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;

    // Screen-space unit along element: sample a tiny step
    const tinyFrac = 0.01;
    const testX = p1.x + ux * (tinyFrac * len);
    const testY = p1.y + uy * (tinyFrac * len);
    const sA = [xScale(p1.x), yScale(p1.y)];
    const sB = [xScale(testX), yScale(testY)];
    let dirX = sB[0] - sA[0], dirY = sB[1] - sA[1];
    const norm = Math.hypot(dirX, dirY) || 1;
    dirX /= norm; dirY /= norm;
    // Perp in screen
    const perpX = -dirY, perpY = dirX;

    // Draw local x-axis arrow (along element) at midpoint
    const arrowPx = 12; // pixel length of arrow
    const tx = mx + dirX * arrowPx;
    const ty = my + dirY * arrowPx;
    g.append("line")
      .attr("x1", mx).attr("y1", my)
      .attr("x2", tx).attr("y2", ty)
      .attr("stroke", "red")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead-axial)");

    // Draw local y-axis arrow (perp) at midpoint
    const qx = mx + perpX * -arrowPx;
    const qy = my + perpY * -arrowPx;
    g.append("line")
      .attr("x1", mx).attr("y1", my)
      .attr("x2", qx).attr("y2", qy)
      .attr("stroke", "green")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead-transverse)");

    g.append("text")
      .attr("x", tx + 3)
      .attr("y", ty - 3)
      .text("x")
      .attr("fill", "red")
      .attr("font-size", 12);

    g.append("text")
      .attr("x", qx + 3)
      .attr("y", qy - 3)
      .text("y")
      .attr("fill", "green")
      .attr("font-size", 12);
  });
}

// ─── DRAW NODES ───────────────────────────────────────────────────────────
function DrawNodes(g, coords, xScale, yScale) {
  const data = Object.entries(coords).map(([id, p]) => ({
    id: +id, x: p.x, y: p.y
  }));
  const sel = g.selectAll("circle.node").data(data, d => d.id);
  sel.exit().remove();
  sel.enter()
    .append("circle")
      .attr("class", "node")
      .attr("r", 4)
      .attr("fill", "#007bff")
    .merge(sel)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y));
}

// ─── DRAW SUPPORTS ───────────────────────────────────────────────────────
function DrawSupports(g, supports, coords, xScale, yScale) {
  const supportColor = "#FF5722";
  const triangleWidth = 16;
  const triangleHeight = 12;
  const rollerCircleRadius = 4;
  const rollerCircleGap = 2;
  const rollerCircleXOffset = 6;
  const verticalShift = 6;

  const sel = g.selectAll("g.support").data(supports, d => d.nodeId);
  sel.exit().remove();
  const enter = sel.enter()
    .append("g")
      .attr("class", "support");
  enter.merge(sel)
    .attr("transform", d => {
      const { x, y } = coords[d.nodeId];
      return `translate(${xScale(x)},${yScale(y) + verticalShift})`;
    })
    .each(function(d) {
      const nodeG = d3.select(this);
      nodeG.selectAll("*").remove();
      const v = d.value;
      const ndf = v.length;
      function drawTriangle(selection) {
        const w = triangleWidth / 2;
        const halfH = triangleHeight / 2;
        const pathData = `M ${-w} ${halfH} L ${w} ${halfH} L 0 ${-halfH} Z`;
        selection.append("path")
          .attr("d", pathData)
          .attr("fill", supportColor);
      }
      function drawRollerCircles(selection) {
        const halfH = triangleHeight / 2;
        const yPos = halfH + rollerCircleGap + rollerCircleRadius;
        const xOff = rollerCircleXOffset;
        selection.append("circle")
          .attr("cx", -xOff).attr("cy", yPos).attr("r", rollerCircleRadius)
          .attr("fill", supportColor);
        selection.append("circle")
          .attr("cx", xOff).attr("cy", yPos).attr("r", rollerCircleRadius)
          .attr("fill", supportColor);
      }
      function drawFixedBox(selection) {
        const w = triangleWidth;
        const halfH = triangleHeight / 2;
        selection.append("rect")
          .attr("x", -w/2).attr("y", -halfH)
          .attr("width", w).attr("height", triangleHeight)
          .attr("fill", supportColor);
      }
      if (ndf === 2) {
        const [fx, fy] = v;
        if (fx === 1 && fy === 1) {
          drawTriangle(nodeG);
        } else if (fx === 1 || fy === 1) {
          drawTriangle(nodeG);
          drawRollerCircles(nodeG);
        }
      } else if (ndf === 3) {
        const [ux, uy, rz] = v;
        if (ux === 1 && uy === 1 && rz === 1) {
          drawFixedBox(nodeG);
        } else if (ux === 1 && uy === 1 && rz === 0) {
          drawTriangle(nodeG);
        } else if ((ux === 1 && uy === 0) || (ux === 0 && uy === 1)) {
          drawTriangle(nodeG);
          drawRollerCircles(nodeG);
        }
      }
    });
}

// ─── DRAW NODAL LOADS ─────────────────────────────────────────────────────
function DrawLoads(g, loads, coords, xScale, yScale) {
  const colorX = "#007bff";
  const colorY = "#28a745";
  const arrowLength = 24;
  const headLength = 6;
  const headWidth = 6;

  const sel = g.selectAll("g.load").data(loads, d => d.nodeId);
  sel.exit().remove();
  const enter = sel.enter()
    .append("g")
      .attr("class", "load");
  enter.append("g").attr("class", "arrow-x");
  enter.append("g").attr("class", "arrow-y");
  enter.merge(sel)
    .attr("transform", d => {
      const { x, y } = coords[d.nodeId];
      return `translate(${xScale(x)},${yScale(y)})`;
    })
    .each(function(d) {
      const nodeG = d3.select(this);
      const [fx = 0, fy = 0] = d.values;
      nodeG.select("g.arrow-x").selectAll("*").remove();
      nodeG.select("g.arrow-y").selectAll("*").remove();
      function drawArrow(subG, dx, dy, color) {
        const ux = dx, uy = dy;
        const sx = ux * (arrowLength - headLength);
        const sy = uy * (arrowLength - headLength);
        subG.append("line")
          .attr("x1", 0).attr("y1", 0)
          .attr("x2", sx).attr("y2", sy)
          .attr("stroke", color).attr("stroke-width", 2);
        const tx = ux * arrowLength;
        const ty = uy * arrowLength;
        const px = -uy * headWidth;
        const py = ux * headWidth;
        const pathData = [
          [tx, ty],
          [sx + px, sy + py],
          [sx - px, sy - py],
          [tx, ty]
        ];
        subG.append("path")
          .attr("d", d3.line()(pathData))
          .attr("fill", color);
      }
      if (fx !== 0) {
        const signX = fx > 0 ? 1 : -1;
        drawArrow(nodeG.select("g.arrow-x"), signX, 0, colorX);
      }
      if (fy !== 0) {
        const signY = fy > 0 ? -1 : 1;
        drawArrow(nodeG.select("g.arrow-y"), 0, signY, colorY);
      }
    });
}

// ─── DRAW ELEMENT LOADS ──────────────────────────────────────────────────
function DrawEleLoads(g, eleLoads, elements, coords, xScale, yScale) {
  function expandRange(range) {
    const ids = [];
    elements.forEach(el => {
      if (el.id >= range.start && el.id <= range.end) {
        ids.push(el.id);
      }
    });
    return ids;
  }
  g.selectAll("*").remove();
  const sampleCount = 30;
  eleLoads.forEach(load => {
    let ids = [];
    if (Array.isArray(load.eleIds) && load.eleIds.length > 0) {
      ids = load.eleIds;
    } else if (load.range) {
      ids = expandRange(load.range);
    }
    ids.forEach(eleId => {
      const el = elements.find(e => e.id === eleId);
      if (!el) return;
      const p1 = coords[el.i], p2 = coords[el.j];
      if (!p1 || !p2) return;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      const baseArrowLen = len * 0.1;

      if (load.type === "beamPoint") {
        const { Pz, xL } = load.params;
        if (Pz == null || xL == null) return;
        const sx = p1.x + ux * (xL * len);
        const sy = p1.y + uy * (xL * len);
        const sign = Math.sign(Pz) || 1;
        const tx = sx + nx * (baseArrowLen * sign);
        const ty = sy + ny * (baseArrowLen * sign);
        g.append("line")
          .attr("x1", xScale(sx)).attr("y1", yScale(sy))
          .attr("x2", xScale(tx)).attr("y2", yScale(ty))
          .attr("stroke", "steelblue").attr("stroke-width", 1)
          .attr("marker-end",   "url(#arrowhead-transverse)");
        g.append("text")
          .attr("x", xScale(sx)).attr("y", yScale(sy))
          .attr("dy", "-6").attr("text-anchor", "middle")
          .attr("fill", "steelblue")
          .text(Math.abs(Pz));
      }
      else if (load.type === "beamUniform") {
        const p = load.params;
        if (p.aL != null && p.bL != null && p.Wz_start != null && p.Wz_end != null) {
          const aL = p.aL, bL = p.bL;
          const startX = p1.x + ux * (aL * len);
          const startY = p1.y + uy * (aL * len);
          const endX = p1.x + ux * (bL * len);
          const endY = p1.y + uy * (bL * len);
          g.append("line")
            .attr("x1", xScale(startX)).attr("y1", yScale(startY))
            .attr("x2", xScale(endX)).attr("y2", yScale(endY))
            .attr("stroke", "purple").attr("stroke-width", 1)
            .attr("stroke-dasharray", "4,2");
          const signEnd = Math.sign(p.Wz_end) || 1;
          const tx1 = endX + nx * (baseArrowLen * signEnd);
          const ty1 = endY + ny * (baseArrowLen * signEnd);
          g.append("line")
            .attr("x1", xScale(endX)).attr("y1", yScale(endY))
            .attr("x2", xScale(tx1)).attr("y2", yScale(ty1))
            .attr("stroke", "purple").attr("stroke-width", 1)
            .attr("marker-end", "url(#arrowhead-transverse)");
          const maxMag = Math.max(Math.abs(p.Wz_start), Math.abs(p.Wz_end), 1);
          for (let k = 1; k < sampleCount; k++) {
            const tFrac = aL + (bL - aL) * (k / sampleCount);
            if (tFrac <= 0 || tFrac >= 1) continue;
            const sxI = p1.x + ux * (tFrac * len);
            const syI = p1.y + uy * (tFrac * len);
            const mag = p.Wz_start + (p.Wz_end - p.Wz_start) * ((tFrac - aL) / (bL - aL));
            const signI = Math.sign(mag) || 1;
            const arrowLen = baseArrowLen * (Math.abs(mag) / maxMag);
            const txI = sxI + nx * (arrowLen * signI);
            const tyI = syI + ny * (arrowLen * signI);
            g.append("line")
              .attr("x1", xScale(sxI)).attr("y1", yScale(syI))
              .attr("x2", xScale(txI)).attr("y2", yScale(tyI))
              .attr("stroke", "purple").attr("stroke-width", 1)
              .attr("marker-end", "url(#arrowhead-transverse)");
          }
          g.append("text")
            .attr("x", xScale(startX)).attr("y", yScale(startY))
            .attr("dy", "-6").attr("text-anchor", "start")
            .attr("fill", "purple")
            .text(Math.abs(p.Wz_start));
          g.append("text")
            .attr("x", xScale(endX)).attr("y", yScale(endY))
            .attr("dy", "-6").attr("text-anchor", "end")
            .attr("fill", "purple")
            .text(Math.abs(p.Wz_end));
        }
        else if (p.Wz != null) {
          const sign = Math.sign(p.Wz) || 1;
          const sx0 = p1.x, sy0 = p1.y;
          const tx0 = sx0 + nx * (baseArrowLen * sign);
          const ty0 = sy0 + ny * (baseArrowLen * sign);
          g.append("line")
            .attr("x1", xScale(sx0)).attr("y1", yScale(sy0))
            .attr("x2", xScale(tx0)).attr("y2", yScale(ty0))
            .attr("stroke", "tomato").attr("stroke-width", 1)
            .attr("marker-end", "url(#arrowhead-transverse)");
          const sx1 = p2.x, sy1 = p2.y;
          const tx1 = sx1 + nx * (baseArrowLen * sign);
          const ty1 = sy1 + ny * (baseArrowLen * sign);
          g.append("line")
            .attr("x1", xScale(sx1)).attr("y1", yScale(sy1))
            .attr("x2", xScale(tx1)).attr("y2", yScale(ty1))
            .attr("stroke", "tomato").attr("stroke-width", 1)
            .attr("marker-end", "url(#arrowhead-transverse)");
          for (let k = 1; k < sampleCount; k++) {
            const tFrac = k / sampleCount;
            const sxI = p1.x + ux * (tFrac * len);
            const syI = p1.y + uy * (tFrac * len);
            const txI = sxI + nx * (baseArrowLen * sign);
            const tyI = syI + ny * (baseArrowLen * sign);
            g.append("line")
              .attr("x1", xScale(sxI)).attr("y1", yScale(syI))
              .attr("x2", xScale(txI)).attr("y2", yScale(tyI))
              .attr("stroke", "tomato").attr("stroke-width", 1)
              .attr("marker-end", "url(#arrowhead-transverse)");
          }
          const midX = p1.x + ux * (0.5 * len);
          const midY = p1.y + uy * (0.5 * len);
          g.append("text")
            .attr("x", xScale(midX)).attr("y", yScale(midY))
            .attr("dy", "-6").attr("text-anchor", "middle")
            .attr("fill", "tomato")
            .text(Math.abs(p.Wz));
        }
        if (p.Wx != null && p.Wx !== 0) {
          const signAx = Math.sign(p.Wx) || 1;
          const asx0 = p1.x, asy0 = p1.y;
          const atx0 = asx0 + ux * (baseArrowLen * 0.5 * signAx);
          const aty0 = asy0 + uy * (baseArrowLen * 0.5 * signAx);
          g.append("line")
            .attr("x1", xScale(asx0)).attr("y1", yScale(asy0))
            .attr("x2", xScale(atx0)).attr("y2", yScale(aty0))
            .attr("stroke", "gray").attr("stroke-width", 1)
            .attr("marker-end", "url(#arrowhead-axial)");
          const asx1 = p2.x, asy1 = p2.y;
          const atx1 = asx1 + ux * (baseArrowLen * 0.5 * signAx);
          const aty1 = asy1 + uy * (baseArrowLen * 0.5 * signAx);
          g.append("line")
            .attr("x1", xScale(asx1)).attr("y1", yScale(asy1))
            .attr("x2", xScale(atx1)).attr("y2", yScale(aty1))
            .attr("stroke", "gray").attr("stroke-width", 1)
            .attr("marker-end", "url(#arrowhead-axial)");
          for (let k = 1; k < sampleCount; k++) {
            const tFrac = k / sampleCount;
            const asxI = p1.x + ux * (tFrac * len);
            const asyI = p1.y + uy * (tFrac * len);
            const atxI = asxI + ux * (baseArrowLen * 0.5 * signAx);
            const atyI = asyI + uy * (baseArrowLen * 0.5 * signAx);
            g.append("line")
              .attr("x1", xScale(asxI)).attr("y1", yScale(asyI))
              .attr("x2", xScale(atxI)).attr("y2", yScale(atyI))
              .attr("stroke", "gray").attr("stroke-width", 1)
              .attr("marker-end", "url(#arrowhead-axial)");
          }
          const amidX = p1.x + ux * (0.5 * len);
          const amidY = p1.y + uy * (0.5 * len);
          g.append("text")
            .attr("x", xScale(amidX)).attr("y", yScale(amidY))
            .attr("dy", "12").attr("text-anchor", "middle")
            .attr("fill", "gray")
            .text(Math.abs(p.Wx));
        }
      }
    });
  });
}

// ─── SVG marker definitions ───────────────────────────────────────────────
function defineArrowMarkers(svg) {
  const defs = svg.append("defs");

  defs.append("marker")
    .attr("id", "arrowhead-transverse")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("refX", 0)
    .attr("refY", 3)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,0 L0,6 L6,3 Z")
    .attr("fill", "currentColor");

  defs.append("marker")
    .attr("id", "arrowhead-axial")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("refX", 0)
    .attr("refY", 3)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,0 L0,6 L6,3 Z")
    .attr("fill", "currentColor");
}