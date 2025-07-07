// src/components/visualization/Reaction.jsx

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { saveAs } from "file-saver"; 
import { usePlotParser } from "../../utils/plotParser";
import './Reaction.css'
export default function Reaction({width = 1200, height = 470, margin = 40 }) {
  const { nodeCoordinates, elementConnectivity, supports, nodeReactionSeries, ndf, ndm } = usePlotParser();
  const svgRef = useRef();
  // Export SVG as PNG
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

    canvas.toBlob(blob => saveAs(blob, "reaction-force.png"));
  };
};

  useEffect(() => {
    if (!nodeCoordinates || Object.keys(nodeCoordinates).length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    defineArrowMarkers(svg);

    const xs = Object.values(nodeCoordinates).map(d => d.x);
    const ys = Object.values(nodeCoordinates).map(d => d.y);
    const xScale = d3.scaleLinear().domain(d3.extent(xs)).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain(d3.extent(ys)).range([height - margin, margin]);

    const root = svg.append("g").attr("class", "viewport");
    svg.call(d3.zoom().scaleExtent([0.2, 5]).on("zoom", e => root.attr("transform", e.transform))).on("dblclick.zoom", null);

    const gElements = root.append("g").attr("class", "elements");
    const gNodes = root.append("g").attr("class", "nodes");
    const gSupports = root.append("g").attr("class", "supports");
    const gReactions = root.append("g").attr("class", "nodal-reactions");

    DrawElements(gElements, elementConnectivity, nodeCoordinates, xScale, yScale);
    DrawNodes(gNodes, nodeCoordinates, xScale, yScale);
    DrawSupports(gSupports, supports, nodeCoordinates, xScale, yScale);
    DrawReactions(gReactions, nodeReactionSeries, nodeCoordinates, xScale, yScale, ndf, ndm);
  }, [nodeCoordinates, elementConnectivity, supports, nodeReactionSeries, ndf, ndm, width, height, margin]);

  return (
    <div className="reaction-container">
      <div className="force-controls">
      <button onClick={exportPNG}>Save PNG</button>
      </div>
      <svg ref={svgRef} width={width} height={height} className="reaction-svg" />
    </div>
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
  // Draw node labels
  const labels = g.selectAll("text.node-label").data(data, d => d.id);
  labels.exit().remove();
  labels.enter()
    .append("text")
      .attr("class", "node-label")
      .attr("font-size", 7)
      .attr("fill", "#007bff")
      .attr("text-anchor", "start")
    .merge(labels)
      .attr("x", d => xScale(d.x) + 5)
      .attr("y", d => yScale(d.y) - 5)
      .text(d => `N${d.id}`);
}

// ─── DRAW SUPPORTS ───────────────────────────────────────────────────────
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
  const enter = sel.enter().append("g").attr("class", "support");
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

      function drawYRollerGroup(selection) {
        const group = selection.append("g")
          .attr("transform", `translate(6, -6) rotate(-90)`);  // Tweak offsets as needed

        const halfH = triangleHeight / 2;
        const yPos = halfH + rollerCircleGap + rollerCircleRadius;

        drawTriangle(group);
        group.append("circle")
          .attr("cx", -rollerCircleXOffset)
          .attr("cy", yPos)
          .attr("r", rollerCircleRadius)
          .attr("fill", supportColor);
        group.append("circle")
          .attr("cx", rollerCircleXOffset)
          .attr("cy", yPos)
          .attr("r", rollerCircleRadius)
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
          drawTriangle(nodeG); // pinned
        } else if (fx === 1 && fy === 0) {
          drawYRollerGroup(nodeG); // Y roller
        } else if (fx === 0 && fy === 1) {
          drawTriangle(nodeG);
          drawRollerCircles(nodeG); // X roller
        }
      } else if (ndf === 3) {
        const [ux, uy, rz] = v;
        if (ux === 1 && uy === 1 && rz === 1) {
          drawFixedBox(nodeG); // fixed
        } else if (ux === 1 && uy === 1 && rz === 0) {
          drawTriangle(nodeG); // pinned
        } else if (ux === 1 && uy === 0) {
          drawYRollerGroup(nodeG); // Y roller
        } else if (ux === 0 && uy === 1) {
          drawTriangle(nodeG);
          drawRollerCircles(nodeG); // X roller
        }
      }
    });
}

// ─── DRAW Reactions ─────────────────────────────────────────────────────
function DrawReactions(g, series, coords, xScale, yScale, ndf, ndm) {
  const last = series.length > 0 ? series[series.length - 1] : { data: {} };
  const data = last.data;
  g.selectAll("*").remove();

  Object.entries(data).forEach(([nodeId, vecRaw]) => {
    let rx = 0, ry = 0, mz = 0;
    if (Array.isArray(vecRaw)) {
      [rx = 0, ry = 0, mz = 0] = vecRaw;
    } else if (typeof vecRaw === 'object' && vecRaw !== null) {
      rx = '1' in vecRaw ? vecRaw['1'] : 0;
      ry = '2' in vecRaw ? vecRaw['2'] : 0;
      mz = '3' in vecRaw ? vecRaw['3'] : 0;
    } else return;

    const p = coords[nodeId];
    if (!p) return;

    const x = xScale(p.x);
    const y = yScale(p.y);
    const len = 20;

    // RX
    if (ndf >= 1 && Math.abs(rx) > 1e-6) {
      const sign = rx > 0 ? 1 : -1;
      const color = "blue";
      g.append("line")
        .attr("x1", x).attr("y1", y)
        .attr("x2", x + sign * len).attr("y2", y)
        .attr("stroke", color).attr("stroke-width", 2)
        .attr("marker-end", `url(#arrowhead-${color})`);

      g.append("text")
        .attr("x", x + sign * len * 2.5)
        .attr("y", y - 5)
        .text(`${Math.abs(rx.toFixed(2))} `)
        .attr("fill", color)
        .attr("font-size", 10);
    }

    // RY
    if (ndf >= 2 && Math.abs(ry) > 1e-6) {
      const sign = ry > 0 ? -1 : 1;
      const color = "magenta";
      g.append("line")
        .attr("x1", x).attr("y1", y)
        .attr("x2", x).attr("y2", y + sign * len)
        .attr("stroke", color).attr("stroke-width", 2)
        .attr("marker-end", `url(#arrowhead-${color})`);

      g.append("text")
        .attr("x", x + 5)
        .attr("y", y + sign * len * 2)
        .text(`${Math.abs(ry.toFixed(2))}`)
        .attr("fill", color)
        .attr("font-size", 10);
    }

    // MZ (flipped logic)
    if (ndf === 3 && Math.abs(mz) > 1e-6) {
      const r = len;
      const color = "red";
      const direction = mz > 0 ? Math.PI * 1.5 : -Math.PI * 1.5; // <-- flipped here

      const arcGen = d3.arc()
        .innerRadius(r - 1)
        .outerRadius(r)
        .startAngle(0)
        .endAngle(direction);

      g.append("path")
        .attr("d", arcGen())
        .attr("transform", `translate(${x},${y})`)
        .attr("fill", color)
        .attr("stroke", "none");

      const endAngle = direction;
      const angleDeg = endAngle * 180 / Math.PI;

      let arrowX = x + r * Math.cos(endAngle);
      let arrowY = y + r * Math.sin(endAngle);
      if (mz >= 0) arrowY += r * 0.05 ; // adjust for CCW side
      if (mz < 0) arrowY += r * 0.05 - 2*r ; // adjust for CCW side

      g.append("path")
        .attr("d", d3.symbol().type(d3.symbolTriangle).size(25))
        .attr("fill", color)
        .attr("transform", `translate(${arrowX},${arrowY}) rotate(${angleDeg})`);

      g.append("text")
        .attr("x", x + 5)
        .attr("y", y - r + 4)
        .text(`${Math.abs(mz.toFixed(2))}`)
        .attr("fill", color)
        .attr("font-size", 10);
    }
  });
}

// ─── DEFINE MARKERS ─────────────────────────────────────────────────────
function defineArrowMarkers(svg) {
  const defs = svg.append("defs");

  // Utility to define colored arrowheads
  const colors = ["yellow", "green", "red", "blue", "magenta"]; 
  colors.forEach(color => {
    defs.append("marker")
      .attr("id", `arrowhead-${color}`)
      .attr("markerUnits", "strokeWidth")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("refX", 0)
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L0,6 L6,3 Z")
      .attr("fill", color);
  });

  // Existing element axes if needed
  defs.append("marker").attr("id", "arrowhead-axial").attr("markerUnits", "strokeWidth").attr("markerWidth", 6)
    .attr("markerHeight", 6).attr("refX", 0).attr("refY", 3).attr("orient", "auto")
    .append("path").attr("d", "M0,0 L0,6 L6,3 Z").attr("fill", "currentColor");

  defs.append("marker").attr("id", "arrowhead-transverse").attr("markerUnits", "strokeWidth")
    .attr("markerWidth", 6).attr("markerHeight", 6).attr("refX", 0).attr("refY", 3).attr("orient", "auto")
    .append("path").attr("d", "M0,0 L0,6 L6,3 Z").attr("fill", "currentColor");
}
