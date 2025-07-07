// src/components/visualization/Model.jsx

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { saveAs } from "file-saver"; 
import { usePlotParser } from "../../utils/plotParser";
import './Model.css'
export default function Model({ width = 1200, height = 600, margin = 40 }) {
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
    const gElements   = root.append("g").attr("class", "elements");
    const gNodes      = root.append("g").attr("class", "nodes");
    const gSupports   = root.append("g").attr("class", "supports");
    const gEleLoads   = root.append("g").attr("class", "element-loads");
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
          .text(`${Math.abs(mag)} `);
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
          .text(`${Math.abs(mz.toFixed(2))} `)
          .attr("fill", colorM)
          .attr("font-size", 7)
          .attr("text-anchor", "start");
      }
    });
}

// ─── DRAW ELEMENT LOADS ──────────────────────────────────────────────────
function DrawEleLoads(g, eleLoads, elements, coords, xScale, yScale) {
  // ─── Configurable constants ─────────────────────────
  const headLen         = 2;
  const headW           = 3;
  const pointVisScale   = 20;   // base length (px) for point loads
  const uniformVisScale = 20;   // base length (px) for uniform loads
  const minVisFrac      = 0.05; // minimum fraction of full arrow length
  const minUniformArws  = 15;    // minimum arrows on each uniform load
  const maxUniformArws  = 50;   // maximum arrows on each uniform load
  const spacingPx       = 10;   // target px spacing between uniform arrows

  // ─── helper: expand a range to element IDs ──────────
  function expandRange(r) {
    return elements
      .filter(e => e.id >= r.start && e.id <= r.end)
      .map(e => e.id);
  }

  // ─── prep canvas ────────────────────────────────────
  g.selectAll('*').remove();

  // ─── find global maxima for scaling fractions ────────
  let maxPt = 1, maxUni = 1;
  eleLoads.forEach(ld => {
    if (ld.type === 'beamPoint') {
      const { Py=0, Px=0 } = ld.params;
      maxPt  = Math.max(maxPt, Math.abs(Py), Math.abs(Px));
    } else {
      const { Wy=0, Wy_start=Wy, Wy_end=Wy, Wx=0 } = ld.params;
      maxUni = Math.max(maxUni,
                         Math.abs(Wy_start), Math.abs(Wy_end),
                         Math.abs(Wx));
    }
  });

  // ─── arrow‐drawing primitive ─────────────────────────
  function drawArrow(x0, y0, dx, dy, color, label, frac, unit, baseScale) {
    const length = baseScale * Math.max(frac, minVisFrac);
    const x1 = x0 + dx * length;
    const y1 = y0 + dy * length;

    g.append('line')
      .attr('x1', x0).attr('y1', y0)
      .attr('x2', x1 - dx*headLen).attr('y2', y1 - dy*headLen)
      .attr('stroke', color)
      .attr('stroke-width', 0.7)
      .attr('marker-end', `url(#arrow-${color})`);

    const [ox, oy] = [dx, dy].map(c => c * (headLen + 4));
    if (label) {
      g.append('text')
        .attr('x', x1 + ox)
        .attr('y', y1 + oy)
        .attr('text-anchor','middle')
        .attr('font-size','7px')
        .attr('fill', color)
        .text(`${label}${unit}`);
    }
  }

  // ─── ensure arrow‐markers defined once ───────────────
  function ensureMarkers() {
    const defs = g.select('defs') .empty()
               ? g.append('defs')
               : g.select('defs');
    ['steelblue','gray','purple'].forEach(col => {
      if (defs.select(`#arrow-${col}`).empty()){
        defs.append('marker')
          .attr('id', `arrow-${col}`)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('refX', 0)
          .attr('refY', 3)
          .attr('orient','auto')
          .append('path')
            .attr('d','M0,0 L0,6 L6,3 Z')
            .attr('fill', col);
      }
    });
  }
  ensureMarkers();

  // ─── loop through every load ────────────────────────
  eleLoads.forEach(load => {
    // resolve element IDs
    const ids = Array.isArray(load.eleIds) && load.eleIds.length
              ? load.eleIds
              : load.range ? expandRange(load.range) : [];

    ids.forEach(id => {
      const el = elements.find(e => e.id===id);
      if (!el) return;
      const [p1,p2] = [coords[el.i], coords[el.j]];
      if (!p1||!p2) return;

      // screen coords & direction unit‐vectors
      const x1 = xScale(p1.x), y1 = yScale(p1.y);
      const x2 = xScale(p2.x), y2 = yScale(p2.y);
      const dx = x2-x1, dy = y2-y1;
      const L  = Math.hypot(dx,dy);
      if (L<1e-3) return;
      const ux = dx/L, uy = dy/L;
      const nx = -uy, ny = ux;

      if (load.type === 'beamPoint') {
        const { Py=0, Px=0, xL } = load.params;
        if (xL==null) return;
        const bx = x1 + ux*(xL*L),
              by = y1 + uy*(xL*L);

        if (Py) {
          const sign = -Math.sign(Py);
          drawArrow(bx, by, nx*sign, ny*sign,
                    'steelblue', Math.abs(Py), Math.abs(Py)/maxPt, ' ', pointVisScale);
        }
        if (Px) {
          const sign = -Math.sign(Px);
          drawArrow(bx, by, ux*sign, uy*sign,
                    'gray', Math.abs(Px), Math.abs(Px)/maxPt, ' ', pointVisScale);
        }

      } else {  // uniform
        const p = { ...load.params };
        // normalize start/end fractions
        if (p.Wy!=null) { p.Wy_start=p.Wy; p.Wy_end=p.Wy; p.aL=0; p.bL=1; }
        if ([p.Wy_start,p.Wy_end,p.aL,p.bL].some(v=>v==null)) return;

        // compute how many arrows along this element
        const rawCount = Math.floor(L/spacingPx);
        const nArrows = Math.max(minUniformArws, Math.min(maxUniformArws, rawCount));
        // sample at ends + intermediate
        for (let i=0; i<=nArrows; i++){
          const t = p.aL + (p.bL-p.aL)*(i/nArrows);
          const px = x1 + ux*(t*L),
                py = y1 + uy*(t*L);
          const mag = p.Wy_start + (p.Wy_end-p.Wy_start)*( (t-p.aL)/(p.bL-p.aL) );
          const sign = -Math.sign(mag);
          drawArrow(px,py, nx*sign, ny*sign,
                    'purple', (i===0||i===nArrows)?Math.abs(mag):'', Math.abs(mag)/maxUni, ' ', uniformVisScale);
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