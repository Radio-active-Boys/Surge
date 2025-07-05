import React, { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { saveAs } from "file-saver"; 
import { usePlotParser } from "../../utils/plotParser";
import "./SectionForce.css";

// Compute section forces N, V, M along the element
function sectionForceDistribution2D(ecrd, pl, eleLoadData = [['-beamUniform', 0, 0]], nep = 2) {
  const [p1, p2] = ecrd;
  const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;

  // 1) initial xl
  let xl = Array.from({ length: nep }, (_, i) => (L * i) / (nep - 1));

  // 2) insert a/b for trapezoid and point‑load eps
  eleLoadData.forEach(load => {
    const type = load[0];
    if (type === '-beamUniform' && load.length === 7) {
      const [ , wta, waa, aL, bL, wtb, wab ] = load;
      const a = aL * L, b = bL * L;
      if (!xl.includes(a)) { xl.splice(xl.findIndex(x => x > a) || xl.length, 0, a); nep++; }
      if (!xl.includes(b)) { xl.splice(xl.findIndex(x => x > b) || xl.length, 0, b); nep++; }
    }
    if (type === '-beamPoint') {
      const a = load[2] * L;
      if (!xl.includes(a)) {
        xl.splice(xl.findIndex(x => x > a) || xl.length, 0, a, a + 1e-3);
        nep += 2;
      }
    }
  });

  // 3) sort & reset nep
  xl.sort((x, y) => x - y);
  nep = xl.length;

  // 4) unpack pl
  let N1 = 0, V1 = 0, M1 = 0;
  if (pl.length === 1) [N1] = pl;
  else [N1, V1, M1] = pl;

  // 5) baseline arrays
  const N = Array(nep).fill(-N1);
  const V = Array(nep).fill(V1);
  const M = xl.map(x => -M1 + V1 * x);

  // 6) superimpose loads
  eleLoadData.forEach(load => {
    const type = load[0];
    if (type === '-beamUniform') {
      if (load.length === 3) {
        const [, Wy, Wx] = load;
        xl.forEach((x, i) => {
          N[i] -= Wx * x;
          V[i] += Wy * x;
          M[i] += 0.5 * Wy * x * x;
        });
      } else {
        const [, wta, waa, aL, bL, wtb, wab] = load;
        const a = aL * L, b = bL * L, bma = b - a;
        xl.forEach((x, i) => {
          let Ax = 0, xc = 0;
          if (x < a) {
            // nothing
          } else if (x <= b) {
            const wtx = wta + (wtb - wta) * ((x - a) / bma);
            Ax = 0.5 * (wta + wtx) * (x - a);
            xc = ((wtx + 2*wta) / (3*(wta + wtx))) * (x - a);
          } else {
            const Ab = 0.5 * (wtb + wta) * bma;
            const xc_full = bma * (wtb + 2*wta) / (3 * (wta + wtb));
            Ax = Ab;
            xc = xc_full + (x - b);
          }
          const signN = -1 * ((wab - waa) * x);
          N[i] += signN;
          V[i] += Ax;
          M[i] += Ax * xc;
        });
        if (aL === 0 && bL === 0) {
          xl.forEach((x, i) => {
            N[i] = -1 * (N1 + wta * x);
            V[i] = V1 + wta * x;
          });
        }
      }
    }
    if (type === '-beamPoint') {
      const [, Pt, , Pa] = load;
      const a = load[2] * L;
      xl.forEach((x, i) => {
        if (x > a) {
          N[i] += -1 * Pa;
          V[i] += Pt;
          M[i] += Pt * (x - a);
        }
      });
    }
  });

  const isFrame = pl.length === 6;
  const s = xl.map((_, i) =>
    isFrame ? [N[i], V[i], M[i]] : [N[i]]
  );
  return { s, xl };
}

// Compute a scale so diagrams fit the structure
function calculateOptimalScale(elementsData, sfType) {
  if (elementsData.length === 0) return 0.1;
  let maxForce = 0, totalLength = 0;
  elementsData.forEach(({ s, length }) => {
    s.forEach(pt => {
      const val =
        sfType === 'N' ? Math.abs(pt[0]) :
        sfType === 'V' ? Math.abs(pt[1]) :
        Math.abs(pt[2]);
      if (val > maxForce) maxForce = val;
    });
    totalLength += length;
  });
  const avgLength = totalLength / elementsData.length;
  if (maxForce === 0) return 0.1;
  const target = avgLength * 0.15;
  return target / maxForce;
}

// Draw supports at nodes
function DrawSupports(g, supports, coords, xScale, yScale) {
  if (!supports || !coords) return;
  supports.forEach(d => {
    const nodeId = d.nodeId, p = coords[nodeId];
    if (!p) return;
    const x = xScale(p.x), y = yScale(p.y) + 6;
    const nodeG = g.append("g").attr("transform", `translate(${x},${y})`);
    const v = d.value, ndf = v.length;
    const color = "#FF5722", triW = 16, triH = 12;
    const drawTri = sel => sel.append("path")
      .attr("d", `M ${-triW/2} ${triH/2} L ${triW/2} ${triH/2} L 0 ${-triH/2} Z`)
      .attr("fill", color);
    const drawRoll = sel => {
      const gap = 2, r = 4, off = 6;
      const y0 = triH/2 + gap + r;
      sel.append("circle").attr("cx", -off).attr("cy", y0).attr("r", r).attr("fill", color);
      sel.append("circle").attr("cx", off).attr("cy", y0).attr("r", r).attr("fill", color);
    };
    const drawBox = sel => sel.append("rect")
      .attr("x", -triW/2).attr("y", -triH/2)
      .attr("width", triW).attr("height", triH)
      .attr("fill", color);

    if (ndf === 2) {
      const [fx, fy] = v;
      if (fx && fy) drawTri(nodeG);
      else if (fx || fy) { drawTri(nodeG); drawRoll(nodeG); }
    } else {
      const [ux, uy, rz] = v;
      if (ux && uy && rz) drawBox(nodeG);
      else if (ux && uy) drawTri(nodeG);
      else if (ux || uy) { drawTri(nodeG); drawRoll(nodeG); }
    }
  });
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

// ─── DRAW NODES ───────────────────────────────────────────────────────────
function DrawNodes(g, coords, xScale, yScale) {
  g.selectAll("*").remove();
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


export default function SectionForce({
  width = 1200,
  height = 400,
  margin = 10,
  nep = 20,
}) {
  const svgRef = useRef(null),
        rootRef = useRef(null);
  const { nodeCoordinates, elementConnectivity, eleLocalForceSeries, eleLoads, supports } = usePlotParser();

  const [sfType, setSfType] = useState("M");
  const [diagScale, setDiagScale] = useState(0.1);
  const [queryEl, setQueryEl] = useState("");
  const [queryX, setQueryX] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [userScale, setUserScale] = useState(1);
  // Export SVG as PNG
  const exportPNG = () => {
    const svgEl = svgRef.current;
    const bbox = svgEl.getBBox();
    const xml = new XMLSerializer().serializeToString(svgEl);
    const svg64 = btoa(xml);
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${svg64}`;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = bbox.width + margin*2;
      canvas.height = bbox.height + margin*2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, -bbox.x + margin, -bbox.y + margin);
      canvas.toBlob(blob => saveAs(blob, "section-forces.png"));
    };
  };

  // Prepare forces at t=0
  const forcesAtT0 = useMemo(() => (eleLocalForceSeries[0] || { data: {} }).data, [eleLocalForceSeries]);

  // Build element data
  const elementsData = useMemo(() => {
    if (!nodeCoordinates || !elementConnectivity) return [];
    return elementConnectivity.map(el => {
      const { id, i, j } = el;
      const p1 = nodeCoordinates[i], p2 = nodeCoordinates[j];
      if (!p1 || !p2) return null;
      const fl = forcesAtT0[id] || forcesAtT0[String(id)];
      if (!fl) return null;
      const isFrame = "FX_j" in fl;
      const pl = isFrame
        ? [fl.FX_i, fl.FY_i, fl.MZ_i, fl.FX_j, fl.FY_j, fl.MZ_j]
        : [fl.FX_i];
      let loads = eleLoads.filter(l => l.eleIds.includes(id)).map(l => {
        if (l.type === "beamUniform") {
          if (l.params.Wy_start != null && l.params.Wy_end != null) {
            return ["-beamUniform", l.params.Wy_start, l.params.Wx_start||0, l.params.aL, l.params.bL, l.params.Wy_end, l.params.Wx_end||0];
          } else {
            return ["-beamUniform", l.params.Wy||0, l.params.Wx||0];
          }
        }
        if (l.type === "beamPoint") {
          return ["-beamPoint", l.params.Py||0, l.params.xL||0, l.params.Px||0];
        }
        return ["-beamUniform", 0, 0];
      });
      if (!loads.length) loads = [['-beamUniform',0,0]];
      const { s, xl } = sectionForceDistribution2D([[p1.x,p1.y],[p2.x,p2.y]], pl, loads, nep);
      const dx = p2.x-p1.x, dy = p2.y-p1.y, length = Math.hypot(dx,dy)||1;
      return { id, p1, p2, s, xl, length, cosa: dx/length, cosb: dy/length, isFrame };
    }).filter(Boolean);
  }, [nodeCoordinates, elementConnectivity, forcesAtT0, eleLoads, nep]);

  // Auto-scale diagrams
  useEffect(() => {
    if (elementsData.length) {
      setDiagScale(calculateOptimalScale(elementsData, sfType));
    }
  }, [elementsData, sfType]);

  // Init SVG & zoom
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const root = svg.append("g").attr("class","viewport");
    rootRef.current = root;
    defineArrowMarkers(svg); // <-- Add this here
    const zoom = d3.zoom().scaleExtent([0.2,5]).on("zoom", e => {
      root.attr("transform", e.transform);
    });
    svg.call(zoom).on("dblclick.zoom", null);
  }, []);


  // Draw everything
  useEffect(() => {
    if (!rootRef.current || !elementsData.length) return;
    const g = rootRef.current;
    g.selectAll("*").remove();

    const pts = Object.values(nodeCoordinates);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const xScale = d3.scaleLinear().domain([Math.min(...xs)-1,Math.max(...xs)+1]).range([margin,width-margin]);
    const yScale = d3.scaleLinear().domain([Math.min(...ys)-1,Math.max(...ys)+1]).range([height-margin,margin]);
    const gElements = g.append("g").attr("class", "elements");
    const gNodes = g.append("g").attr("class", "nodes");


    DrawElements(gElements, elementConnectivity, nodeCoordinates, xScale, yScale);
    DrawNodes(gNodes, nodeCoordinates, xScale, yScale);
    // supports
    DrawSupports(g, supports, nodeCoordinates, xScale, yScale);

    // for each element, draw diagram + labels
    elementsData.forEach(el => {
      const { p1, p2, s, xl, cosa, cosb, isFrame } = el;
      const base = xl.map(x => ({ x: p1.x + x*cosa, y: p1.y + x*cosb }));
      const diag = xl.map((_,i) => {
      let v = sfType==='N'?s[i][0]:sfType==='V'?s[i][1]:-s[i][2];
      const scale = diagScale * userScale;
      if (!isFrame && sfType!=='N') return base[i];
      return { x: base[i].x - v*scale*cosb, y: base[i].y + v*scale*cosa };

      });

      // filled area
      const areaPts = [...base, ...diag.slice().reverse()];
      const areaGen = d3.line().x(d=>xScale(d.x)).y(d=>yScale(d.y)).curve(d3.curveLinearClosed);
      g.append("path").datum(areaPts).attr("d",areaGen).attr("fill",{
        'M':'rgba(214,39,40,0.2)','V':'rgba(44,160,44,0.2)','N':'rgba(31,119,180,0.2)'
      }[sfType]).attr("stroke","none");

      // force line
      const lineGen = d3.line().x(d=>xScale(d.x)).y(d=>yScale(d.y));
      g.append("path").datum(diag)
        .attr("d", lineGen)
        .attr("stroke",{'M':'#d62728','V':'#2ca02c','N':'#1f77b4'}[sfType])
        .attr("stroke-width",2).attr("fill","none")
        .attr("stroke-linecap","round").attr("stroke-linejoin","round");

      // label function
      const placed = new Set();
      const addLabel = (pt,val,ext=false) => {
        if (!pt||val==null||isNaN(val)) return;
        const key = `${xScale(pt.x).toFixed(1)},${yScale(pt.y).toFixed(1)}`;
        if (placed.has(key)) return;
        placed.add(key);
        const data = Math.abs(val)
        const txt = Math.abs(data) > 1000 ? data.toExponential(1) : data.toFixed(0);
        g.append("text")
          .attr("x", xScale(pt.x)).attr("y", yScale(pt.y)-8)
          .attr("text-anchor","middle").attr("dominant-baseline","middle")
          .attr("font-size", ext?"10px":"9px").attr("font-weight", ext?"bold":"normal")
          .attr("fill", ext ? "#5550" : "#444")
          .text(txt);
      };

      // endpoints
      if (s.length>0) {
        addLabel(diag[0], sfType==='N'?s[0][0]:sfType==='V'?s[0][1]:s[0][2]);
        addLabel(diag[diag.length-1], sfType==='N'?s[s.length-1][0]:sfType==='V'?s[s.length-1][1]:s[s.length-1][2]);
      }

      // local extrema
      for (let i=1;i<s.length-1;i++){
        const prev = sfType==='M'?s[i-1][2]:sfType==='V'?s[i-1][1]:s[i-1][0];
        const cur  = sfType==='M'?s[i  ][2]:sfType==='V'?s[i  ][1]:s[i  ][0];
        const next = sfType==='M'?s[i+1][2]:sfType==='V'?s[i+1][1]:s[i+1][0];
        if ((cur-prev)*(next-cur)<0) {
          addLabel(diag[i], cur, true);
        }
      }
    });
  }, [elementsData, sfType, diagScale, userScale,width, height, margin, nodeCoordinates, supports]);

  // Query handler
// Query handler
  const handleQuery = () => {
    const el = elementsData.find(e => e.id.toString() === queryEl);
    if (!el) {
      setResult(null);
      setError("Element not found");
      return;
    }

    const L = el.length;
    if (queryX > L) {
      setResult(null);
      setError(`x = ${queryX.toFixed(2)} is greater than element length = ${L.toFixed(2)}`);
      return;
    }

    // clear any past error
    setError("");

    const idx = el.xl.findIndex(x => x >= queryX);
    const i = Math.min(Math.max(idx, 0), el.s.length - 1);
    const [N, V, M] = el.s[i];
    setResult({ N, V, M });
  };

  return (
    <div className="section-force-container">
      <div className="force-controls">
        <label>Force Type:</label>
        <select value={sfType} onChange={e => setSfType(e.target.value)}>
          <option value="N">Axial Force (N)</option>
          <option value="V">Shear Force (V)</option>
          <option value="M">Bending Moment (M)</option>
        </select>
        <button onClick={exportPNG}>Save Plot as PNG</button>
        <label>
          Scale:
          <input
            type="range" min={0.1} max={10} step={0.1}
            value={userScale}
            onChange={e => setUserScale(parseFloat(e.target.value))}
          /> {userScale.toFixed(1)}x
        </label>
      </div>

      <div className="query-controls">
          <input
            type="number"
            placeholder="Element ID"
            value={queryEl}
            onChange={e => {
              const val = parseInt(e.target.value);
              setQueryEl(isNaN(val) ? "" : val);
            }}
          />
        <input
          type="number"
          placeholder="x from start"
          value={queryX}
          onChange={e => setQueryX(Math.max(0, parseFloat(e.target.value) || 0))}
        />
        <button onClick={handleQuery}>Get N,V,M</button>
      </div>

      {error && (
        <div className="query-error" style={{ borderLeft: "4px solid #dc2626" /* red */ }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && !error && (
        <div className="query-result">
          <strong>At x={queryX.toFixed(2)} on Element {queryEl}:</strong>{" "}
          N = {result.N.toFixed(2)}, V = {result.V.toFixed(2)}, M = {result.M.toFixed(2)}
        </div>
      )}


      <svg ref={svgRef} width={width} height={height} className="section-force-svg" />
    </div>
  );
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