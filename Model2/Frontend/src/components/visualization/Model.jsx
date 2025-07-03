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
  console.log("nodeCoordinates",nodeCoordinates)
  console.log("elementConnectivity",elementConnectivity)
  console.log("supports",supports)
  console.log("loads",loads)
  console.log("eleLoads",eleLoads)

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
// ─── DRAW ELEMENT LOADS ──────────────────────────────────────────────────
function DrawEleLoads(g, eleLoads, elements, coords, xScale, yScale) {
  // helper: turn a range into an array of element IDs
  function expandRange(range) {
    return elements
      .filter(el => el.id >= range.start && el.id <= range.end)
      .map(el => el.id);
  }

  g.selectAll("*").remove();
  const sampleCount = 30;

  eleLoads.forEach(load => {
    // determine which element IDs to draw
    const ids = (Array.isArray(load.eleIds) && load.eleIds.length)
      ? load.eleIds
      : (load.range ? expandRange(load.range) : []);

    ids.forEach(eleId => {
      const el = elements.find(e => e.id === eleId);
      if (!el) return;
      const p1 = coords[el.i], p2 = coords[el.j];
      if (!p1 || !p2) return;

      // SCREEN‑SPACE geometry
      const x1_s = xScale(p1.x), y1_s = yScale(p1.y);
      const x2_s = xScale(p2.x), y2_s = yScale(p2.y);
      const dx_s = x2_s - x1_s, dy_s = y2_s - y1_s;
      const screenLen = Math.hypot(dx_s, dy_s);
      if (!screenLen) return;
      const ux_s = dx_s / screenLen, uy_s = dy_s / screenLen;
      const nx_s = -uy_s, ny_s = ux_s;
      const arrowLenPx = Math.min(12, screenLen * 0.05);

      // ─── Point loads (beamPoint) ───────────────────────────────────────
      if (load.type === "beamPoint") {
        const { Py, xL, Px } = load.params;
        if (Py == null || xL == null) return;

        // base on the beam line
        const baseX = x1_s + ux_s * (xL * screenLen);
        const baseY = y1_s + uy_s * (xL * screenLen);

        // sign inversion: negative Py → arrow outward
        const sign = -(Math.sign(Py) || 1);
        const tipX = baseX + nx_s * (arrowLenPx * sign);
        const tipY = baseY + ny_s * (arrowLenPx * sign);

        // draw the transverse arrow
        g.append("line")
         .attr("x1", baseX).attr("y1", baseY)
         .attr("x2", tipX ).attr("y2", tipY )
         .attr("stroke", "steelblue")
         .attr("marker-end", "url(#arrowhead-transverse)");

        // magnitude label
        g.append("text")
         .attr("x", baseX).attr("y", baseY)
         .attr("dy", "-6").attr("text-anchor", "middle")
         .attr("fill", "steelblue")
         .text(Math.abs(Py));

        // optional axial arrow (Px)
        if (Px != null && Px !== 0) {
          const signA = -(Math.sign(Px) || 1);
          const tipXA = baseX + ux_s * (arrowLenPx * signA);
          const tipYA = baseY + uy_s * (arrowLenPx * signA);
          g.append("line")
           .attr("x1", baseX).attr("y1", baseY)
           .attr("x2", tipXA).attr("y2", tipYA)
           .attr("stroke", "gray")
           .attr("marker-end", "url(#arrowhead-axial)");
          g.append("text")
           .attr("x", (baseX + tipXA)/2).attr("y", (baseY + tipYA)/2)
           .attr("dy", "-6").attr("fill", "gray")
           .text(Math.abs(Px));
        }

      // ─── Uniform loads (beamUniform) ──────────────────────────────────
      } else if (load.type === "beamUniform") {
        const p = load.params;

        // normalize simple → trapezoidal form if needed
        if (p.Wy != null) {
          p.Wy_start = p.Wy;
          p.Wy_end   = p.Wy;
          p.Wx_start = p.Wx != null ? p.Wx : 0;
          p.Wx_end   = p.Wx != null ? p.Wx : 0;
          p.aL = 0; p.bL = 1;
        }
        // require trapezoidal fields now
        if (
          p.Wy_start == null ||
          p.Wy_end   == null ||
          p.aL       == null ||
          p.bL       == null
        ) return;

        // compute start/end screen points
        const startX = x1_s + ux_s * (p.aL * screenLen);
        const startY = y1_s + uy_s * (p.aL * screenLen);
        const endX   = x1_s + ux_s * (p.bL * screenLen);
        const endY   = y1_s + uy_s * (p.bL * screenLen);

        // draw dashed span
        g.append("line")
         .attr("x1", startX).attr("y1", startY)
         .attr("x2", endX  ).attr("y2", endY  )
         .attr("stroke", "purple")
         .attr("stroke-dasharray", "4,2");

        // end arrow
        const signEnd = -(Math.sign(p.Wy_end) || 1);
        const tipX_e = endX + nx_s * (arrowLenPx * signEnd);
        const tipY_e = endY + ny_s * (arrowLenPx * signEnd);
        g.append("line")
         .attr("x1", endX).attr("y1", endY)
         .attr("x2", tipX_e).attr("y2", tipY_e)
         .attr("stroke", "purple")
         .attr("marker-end", "url(#arrowhead-transverse)");

        // intermediate arrows (scaled by magnitude)
        const maxMag = Math.max(Math.abs(p.Wy_start), Math.abs(p.Wy_end), 1);
        for (let k = 1; k < sampleCount; k++) {
          const tFrac = p.aL + (p.bL - p.aL) * (k / sampleCount);
          if (tFrac <= 0 || tFrac >= 1) continue;
          const baseX_i = x1_s + ux_s * (tFrac * screenLen);
          const baseY_i = y1_s + uy_s * (tFrac * screenLen);
          const mag     = p.Wy_start + (p.Wy_end - p.Wy_start) * ((tFrac - p.aL) / (p.bL - p.aL));
          const signI   = -(Math.sign(mag) || 1);
          const lenI    = arrowLenPx * (Math.abs(mag) / maxMag);
          const tipX_i  = baseX_i + nx_s * (lenI * signI);
          const tipY_i  = baseY_i + ny_s * (lenI * signI);
          g.append("line")
           .attr("x1", baseX_i).attr("y1", baseY_i)
           .attr("x2", tipX_i).attr("y2", tipY_i)
           .attr("stroke", "purple")
           .attr("marker-end", "url(#arrowhead-transverse)");
        }

        // start & end magnitude labels
        g.append("text")
         .attr("x", startX).attr("y", startY)
         .attr("dy", "-6").attr("fill", "purple")
         .text(Math.abs(p.Wy_start));
        g.append("text")
         .attr("x", endX).attr("y", endY)
         .attr("dy", "-6").attr("text-anchor", "end")
         .attr("fill", "purple")
         .text(Math.abs(p.Wy_end));
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