// src/components/visualization/Model.jsx

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { saveAs } from "file-saver"; 
import { usePlotParser } from "../../utils/plotParser";
import './Model.css'
export default function Model({ width = 1200, height = 470, margin = 40 }) {
  const {
    nodeCoordinates,
    elementConnectivity,
    supports,
    loads,
    eleLoads,
  } = usePlotParser();


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
    DrawElements(gElements, elementConnectivity, nodeCoordinates, xScale, yScale);
    DrawEleLoads(gEleLoads, eleLoads, elementConnectivity, nodeCoordinates, xScale, yScale);
    DrawNodes(gNodes, nodeCoordinates, xScale, yScale);
    DrawSupports(gSupports, supports, nodeCoordinates, xScale, yScale);
    DrawLoads(gNodalLoads, loads, nodeCoordinates, xScale, yScale);

  }, [nodeCoordinates, elementConnectivity, supports, loads, eleLoads, width, height, margin]);

  return (
    <div className="model-container">
            <div className="force-controls">
      <button onClick={exportPNG}>Save PNG</button>
      </div>
      <svg ref={svgRef} width={width} height={height} className="model-svg" />
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
      .text("x")
      .attr("fill", "red")
      .attr("font-size", 10);

    g.append("text")
      .attr("x", qx - 6)
      .attr("y", qy - 3)
      .text("y")
      .attr("fill", "green")
      .attr("font-size", 10);

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
      .attr("font-size", 10)
      .attr("fill", "#007bff")
      .attr("text-anchor", "start")
    .merge(labels)
      .attr("x", d => xScale(d.x) + 5)
      .attr("y", d => yScale(d.y) - 5)
      .text(d => `N${d.id}`);
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

function DrawLoads(g, loads, coords, xScale, yScale) {
  const colorX = "#007bff";
  const colorY = "#28a745";
  const colorM = "red";
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
  enter.append("g").attr("class", "arrow-mz"); // for moment

  enter.merge(sel)
    .attr("transform", d => {
      const { x, y } = coords[d.nodeId];
      return `translate(${xScale(x)},${yScale(y)})`;
    })
    .each(function (d) {
      const nodeG = d3.select(this);
      const [fx = 0, fy = 0, mz = 0] = d.values;
      nodeG.select("g.arrow-x").selectAll("*").remove();
      nodeG.select("g.arrow-y").selectAll("*").remove();
      nodeG.select("g.arrow-mz").selectAll("*").remove();

      function drawArrow(subG, dx, dy, color, mag) {
        const ux = dx, uy = dy;
        const sx = ux * (arrowLength - headLength);
        const sy = uy * (arrowLength - headLength);

        // Shaft
        subG.append("line")
          .attr("x1", 0).attr("y1", 0)
          .attr("x2", sx).attr("y2", sy)
          .attr("stroke", color).attr("stroke-width", 2);

        // Head
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

        // Label
        const offset = 8;
        subG.append("text")
          .attr("x", tx + offset * ux)
          .attr("y", ty + offset * uy)
          .attr("fill", color)
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .style("font-size", "10px")
          .text(`${Math.abs(mag)} kN`);
      }

      if (fx !== 0) {
        const signX = fx > 0 ? 1 : -1;
        drawArrow(nodeG.select("g.arrow-x"), signX, 0, colorX, fx);
      }
      if (fy !== 0) {
        const signY = fy > 0 ? -1 : 1;
        drawArrow(nodeG.select("g.arrow-y"), 0, signY, colorY, fy);
      }

      // ─── Moment Arrow (Arc + Triangle) ─────────────────────
      // ─── MOMENT AS ARC WITH SYMBOL ─────────────────────────
      if (Math.abs(mz) > 1e-6) {
        const r = 12;
        const x = 0, y = 0; // centered arc at node
        const direction = mz > 0 ? Math.PI * 1.5 : -Math.PI * 1.5;
        const arcGen = d3.arc()
          .innerRadius(r - 1)
          .outerRadius(r)
          .startAngle(0)
          .endAngle(direction);

        nodeG.append("path")
          .attr("d", arcGen())
          .attr("transform", `translate(${x},${y})`)
          .attr("fill", colorM)
          .attr("stroke", "none");

        const endAngle = direction;
        const angleDeg = endAngle * 180 / Math.PI;

        let arrowX, arrowY;
        arrowX = x + r * Math.cos(endAngle);
        arrowY = y + r * Math.sin(endAngle);

        if (mz > 0) arrowY += r * 0.04;
        if (mz < 0) arrowY += r * 0.04 - 2 * r;

        nodeG.append("path")
          .attr("d", d3.symbol().type(d3.symbolTriangle).size(4))
          .attr("fill", colorM)
          .attr("transform", `translate(${arrowX},${arrowY + 0.5}) rotate(${angleDeg})`);

        // Moment Label
        nodeG.append("text")
          .attr("x", arrowX + 3 )
          .attr("y", arrowY )
          .text(`${Math.abs(mz.toFixed(2))} kN-m`)
          .attr("fill", colorM)
          .attr("font-size", 15)
          .attr("text-anchor", "start");
      }
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

  // ─── Compute Global Max Load Magnitude ─────────────
  let maxLoadMag = 1;
  eleLoads.forEach(load => {
    if (load.type === "beamPoint") {
      const { Py, Px } = load.params;
      maxLoadMag = Math.max(maxLoadMag, Math.abs(Py || 0), Math.abs(Px || 0));
    } else if (load.type === "beamUniform") {
      const { Wy, Wy_start, Wy_end } = load.params;
      const start = Wy_start ?? Wy ?? 0;
      const end = Wy_end ?? Wy ?? 0;
      maxLoadMag = Math.max(maxLoadMag, Math.abs(start), Math.abs(end));
    }
  });

  eleLoads.forEach(load => {
    const ids = (Array.isArray(load.eleIds) && load.eleIds.length)
      ? load.eleIds
      : (load.range ? expandRange(load.range) : []);

    ids.forEach(eleId => {
      const el = elements.find(e => e.id === eleId);
      if (!el) return;

      const p1 = coords[el.i], p2 = coords[el.j];
      if (!p1 || !p2) return;

      const x1_s = xScale(p1.x), y1_s = yScale(p1.y);
      const x2_s = xScale(p2.x), y2_s = yScale(p2.y);
      const dx_s = x2_s - x1_s, dy_s = y2_s - y1_s;
      const screenLen = Math.hypot(dx_s, dy_s);
      if (!screenLen) return;
      const ux_s = dx_s / screenLen, uy_s = dy_s / screenLen;
      const nx_s = -uy_s, ny_s = ux_s;

      const visualScale = 50; // same as ModelViewer
      const arrowBase = visualScale; // will be scaled per load magnitude

      if (load.type === "beamPoint") {
        const { Py, xL, Px } = load.params;
        if (xL == null) return;
        const baseX = x1_s + ux_s * (xL * screenLen);
        const baseY = y1_s + uy_s * (xL * screenLen);

        if (Py) {
          const dir = -(Math.sign(Py) || 1);
          const mag = Math.abs(Py);
          const scaleMag = mag / maxLoadMag;
          const len = arrowBase * scaleMag;
          const tipX = baseX + nx_s * len * dir;
          const tipY = baseY + ny_s * len * dir;

          g.append("line")
            .attr("x1", baseX).attr("y1", baseY)
            .attr("x2", tipX).attr("y2", tipY)
            .attr("stroke", "steelblue")
            .attr("marker-end", "url(#arrowhead-steelblue)");

          g.append("text")
            .attr("x", tipX + nx_s * 8 * dir)
            .attr("y", tipY + ny_s * 8 * dir)
            .attr("dy", "4")
            .attr("text-anchor", "middle")
            .attr("fill", "steelblue")
            .attr("font-size", "10px")
            .text(`${mag} kN`);
        }

        if (Px) {
          const dir = -(Math.sign(Px) || 1);
          const mag = Math.abs(Px);
          const scaleMag = mag / maxLoadMag;
          const len = arrowBase * scaleMag;
          const tipXA = baseX + ux_s * len * dir;
          const tipYA = baseY + uy_s * len * dir;

          g.append("line")
            .attr("x1", baseX).attr("y1", baseY)
            .attr("x2", tipXA).attr("y2", tipYA)
            .attr("stroke", "gray")
            .attr("marker-end", "url(#arrowhead-gray)");

          g.append("text")
            .attr("x", tipXA + ux_s * 8 * dir)
            .attr("y", tipYA + uy_s * 8 * dir)
            .attr("dy", "4")
            .attr("text-anchor", "middle")
            .attr("fill", "gray")
            .attr("font-size", "10px")
            .text(`${mag} kN`);
        }

      } else if (load.type === "beamUniform") {
        const p = load.params;
        if (p.Wy != null) {
          p.Wy_start = p.Wy;
          p.Wy_end = p.Wy;
          p.Wx_start = p.Wx ?? 0;
          p.Wx_end = p.Wx ?? 0;
          p.aL = 0; p.bL = 1;
        }
        if (
          p.Wy_start == null || p.Wy_end == null ||
          p.aL == null || p.bL == null
        ) return;

        const startX = x1_s + ux_s * (p.aL * screenLen);
        const startY = y1_s + uy_s * (p.aL * screenLen);
        const endX = x1_s + ux_s * (p.bL * screenLen);
        const endY = y1_s + uy_s * (p.bL * screenLen);

        g.append("line")
          .attr("x1", startX).attr("y1", startY)
          .attr("x2", endX).attr("y2", endY)
          .attr("stroke", "purple")
          .attr("stroke-dasharray", "4,2");

        const drawUniformArrow = (x, y, mag) => {
          const dir = -(Math.sign(mag) || 1);
          const scale = Math.abs(mag) / maxLoadMag;
          const len = arrowBase * scale;
          const tipX = x + nx_s * len * dir;
          const tipY = y + ny_s * len * dir;

          g.append("line")
            .attr("x1", x).attr("y1", y)
            .attr("x2", tipX).attr("y2", tipY)
            .attr("stroke", "purple")
            .attr("marker-end", "url(#arrowhead-purple)");
        };

        for (let k = 1; k < sampleCount; k++) {
          const tFrac = p.aL + (p.bL - p.aL) * (k / sampleCount);
          if (tFrac <= 0 || tFrac >= 1) continue;

          const baseX = x1_s + ux_s * (tFrac * screenLen);
          const baseY = y1_s + uy_s * (tFrac * screenLen);
          const mag = p.Wy_start + (p.Wy_end - p.Wy_start) * ((tFrac - p.aL) / (p.bL - p.aL));
          drawUniformArrow(baseX, baseY, mag);
        }

        drawUniformArrow(startX, startY, p.Wy_start);
        drawUniformArrow(endX, endY, p.Wy_end);

        // Labels
        const signS = -(Math.sign(p.Wy_start) || 1);
        const signE = -(Math.sign(p.Wy_end) || 1);
        const lenS = arrowBase * Math.abs(p.Wy_start) / maxLoadMag;
        const lenE = arrowBase * Math.abs(p.Wy_end) / maxLoadMag;

        const tipX_s = startX + nx_s * lenS * signS;
        const tipY_s = startY + ny_s * lenS * signS;
        const tipX_e = endX + nx_s * lenE * signE;
        const tipY_e = endY + ny_s * lenE * signE;

        g.append("text")
          .attr("x", tipX_s + nx_s * 8 * signS)
          .attr("y", tipY_s + ny_s * 8 * signS)
          .attr("dy", "4")
          .attr("text-anchor", "middle")
          .attr("fill", "purple")
          .attr("font-size", "10px")
          .text(`${Math.abs(p.Wy_start)} kN/m`);

        g.append("text")
          .attr("x", tipX_e + nx_s * 8 * signE)
          .attr("y", tipY_e + ny_s * 8 * signE)
          .attr("dy", "4")
          .attr("text-anchor", "middle")
          .attr("fill", "purple")
          .attr("font-size", "10px")
          .text(`${Math.abs(p.Wy_end)} kN/m`);
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

    const colors = ["steelblue", "gray", "purple"];

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
}