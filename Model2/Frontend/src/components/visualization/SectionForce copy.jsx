import React, { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { usePlotParser } from "../../utils/plotParser";
import "./SectionForce.css"
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

  // 6) superimpose loads (exact Python loops)
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
        const a = aL * L, b = bL * L;
        const bma = b - a;
        xl.forEach((x, i) => {
          let indx = i;
          let xma = x - a;
          let wtx = wta + (wtb - wta) * (xma / bma);
          let xc = wtx === 0 
                 ? 0 
                 : xma * (wtx + 2*wta) / (3 * (wta + wtx));
          let Ax = 0.5 * (wtx + wta) * xma;

          if (x < a) {
            // pass
          } else if (x <= b) {
            N[indx] += -1 * ((wab - waa) * x);
            V[indx] += Ax;
            M[indx] += Ax * xc;
          } else {
            let xmb = x - b;
            let Ab = 0.5 * (wtb + wta) * bma;
            let xc_full = bma * (wtb + 2*wta) / (3 * (wta + wtb));
            let Abxc = Ab * (xc_full + xmb);
            N[indx] += -1 * ((wab - waa) * x);
            V[indx] += Ab;
            M[indx] += Abxc;
          }
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
      const [, Pt, aL, Pa] = load;
      const a = aL * L;
      xl.forEach((x, i) => {
        if (x > a) {
          N[i] += -1 * Pa;
          V[i] += Pt;
          M[i] += Pt * (x - a);
        }
      });
    }
  });

  // 7) assemble
  const isFrame = pl.length === 6;
  const s = xl.map((_, i) =>
    isFrame
      ? [N[i], V[i], M[i]]
      : [N[i]]
  );

  return { s, xl };
}

/**
 * Component to draw properly scaled section force diagrams
 */
export default function SectionForce({
 width = 1200, height = 400, margin = 10,
  nep = 20,
}) {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const rootRef = useRef(null);
  const { 
    nodeCoordinates, 
    elementConnectivity, 
    eleLocalForceSeries, 
    eleLoads,
    supports
  } = usePlotParser();
  
  const [sfType, setSfType] = useState('M');
  const [diagScale, setDiagScale] = useState(0.1);
  
  // Pull first time-step of local forces
  const forcesAtT0 = useMemo(() => (eleLocalForceSeries[0] || { data: {} }).data, [eleLocalForceSeries]);
  
  // Prepare element data for rendering
  const elementsData = useMemo(() => {
    if (!nodeCoordinates || !elementConnectivity) return [];
    
    return elementConnectivity.map(el => {
      const { id, i, j } = el;
      const p1 = nodeCoordinates[i], p2 = nodeCoordinates[j];
      if (!p1 || !p2) return null;
      
      const fl = forcesAtT0[id] || forcesAtT0[String(id)];
      if (!fl) return null;
      
      const isFrame = 'FX_j' in fl;
      const pl = isFrame
        ? [fl.FX_i, fl.FY_i, fl.MZ_i, fl.FX_j, fl.FY_j, fl.MZ_j]
        : [fl.FX_i];
      
      // Map eleLoads into distribution format
// inside elementsData = useMemo(...)
const thisLoads = eleLoads
  .filter(l => l.eleIds.includes(id))
  .map(l => {
    if (l.type === 'beamUniform') {
      // simple UDL or trapezoidal
      if (l.params.Wy_start != null && l.params.Wy_end != null && l.params.aL != null && l.params.bL != null) {
        // trapezoidal
        return [
          '-beamUniform',
          l.params.Wy_start,
          l.params.Wx_start || 0,
          l.params.aL,
          l.params.bL,
          l.params.Wy_end,
          l.params.Wx_end || 0
        ];
      } else {
        // simple UDL
        return [
          '-beamUniform',
          l.params.Wy || 0,
          l.params.Wx || 0
        ];
      }
    }
    if (l.type === 'beamPoint') {
      // [type, Py, xL, Px]
      return [
        '-beamPoint',
        l.params.Py || 0,
        l.params.xL || 0,
        l.params.Px || 0
      ];
    }
    // fallback
    return ['-beamUniform', 0, 0];
  });

// ensure at least one load entry
if (thisLoads.length === 0) thisLoads.push(['-beamUniform', 0, 0]);

// then pass into sectionForceDistribution2D:
const { s, xl } = sectionForceDistribution2D(
  [[p1.x, p1.y], [p2.x, p2.y]],
  pl,
  thisLoads,
  nep
);

      
      // Calculate element geometry
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.hypot(dx, dy) || 1;
      const cosa = dx / length;  // cos(theta)
      const cosb = dy / length;  // sin(theta)
      
      return {
        id,
        p1, p2,
        s, xl,
        length,
        cosa, cosb,
        isFrame
      };
    }).filter(Boolean);
  }, [nodeCoordinates, elementConnectivity, forcesAtT0, eleLoads, nep]);
  
  // Calculate optimal scale when data or force type changes
  useEffect(() => {
    if (elementsData.length > 0) {
      const optimalScale = calculateOptimalScale(elementsData, sfType);
      setDiagScale(optimalScale);
    }
  }, [elementsData, sfType]);

  // Initialize SVG and zoom
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Create root group for zoomable content
    const root = svg.append("g").attr("class", "viewport");
    rootRef.current = root;
    
    // Initialize zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
      });
    
    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
  }, []);

  // Draw supports function
  function DrawSupports(g, supports, coords, xScale, yScale) {
    if (!supports || !coords) return;
    
    supports.forEach(d => {
      const nodeId = d.nodeId;
      const p = coords[nodeId];
      if (!p) return;

      const x = xScale(p.x);
      const y = yScale(p.y) + 6; // Adjust for the support symbol to be below the node
      
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

  // Main drawing function
  useEffect(() => {
    if (!rootRef.current || elementsData.length === 0) return;
    
    const root = rootRef.current;
    root.selectAll("*").remove();

    // Get all node positions for scaling
    const nodePositions = Object.values(nodeCoordinates);
    const xs = nodePositions.map(p => p.x);
    const ys = nodePositions.map(p => p.y);
    
    // Create scales with padding
    const xScale = d3.scaleLinear()
      .domain([Math.min(...xs) - 1, Math.max(...xs) + 1])
      .range([margin, width - margin]);
    
    const yScale = d3.scaleLinear()
      .domain([Math.min(...ys) - 1, Math.max(...ys) + 1])
      .range([height - margin, margin]);

    // Draw original structure
    elementsData.forEach(element => {
      const { p1, p2, isFrame } = element;
      
      // Draw element line
      root.append("line")
        .attr("x1", xScale(p1.x))
        .attr("y1", yScale(p1.y))
        .attr("x2", xScale(p2.x))
        .attr("y2", yScale(p2.y))
        .attr("stroke", isFrame ? "#333" : "#666")
        .attr("stroke-width", isFrame ? 2 : 1.5)
        .attr("stroke-dasharray", isFrame ? "none" : "2,2");
    });

    // Draw nodes
    nodePositions.forEach(pos => {
      root.append("circle")
        .attr("cx", xScale(pos.x))
        .attr("cy", yScale(pos.y))
        .attr("r", 4)
        .attr("fill", "#333");
    });

    DrawSupports(root, supports, nodeCoordinates, xScale, yScale);

    // Track label positions to prevent duplicates
    const labelPositions = new Set();
    
    // Function to add label with position tracking
    const addLabel = (pt, value, isExtreme = false) => {
      if (!pt || value == null || isNaN(value)) return; // <== ✅ Prevent crash

      const posKey = `${xScale(pt.x).toFixed(1)},${yScale(pt.y).toFixed(1)}`;
      if (labelPositions.has(posKey)) return;
      labelPositions.add(posKey);

      const formattedValue = Math.abs(value) > 1000 
        ? `${(value / 1000).toFixed(1)}k`
        : value.toFixed(0);

      const text = root.append("text")
        .attr("x", xScale(pt.x))
        .attr("y", yScale(pt.y) - 8)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", isExtreme ? "10px" : "9px")
        .attr("font-weight", isExtreme ? "bold" : "normal")
        .text(formattedValue)
        .attr("fill", isExtreme ? "#5550" : "#444");
    };


    // Draw force diagrams
    elementsData.forEach(element => {
      const { p1, p2, s, xl, cosa, cosb, isFrame } = element;
      
      // Create base points along the element
      const basePoints = xl.map(x => ({
        x: p1.x + x * cosa,
        y: p1.y + x * cosb
      }));

      // Create diagram points - offset perpendicular to element
// Create diagram points - offset perpendicular to element
const diagramPoints = xl.map((x, i) => {
  if (!s[i]) return basePoints[i];  // guard against undefined section force

let forceVal = 0;
if (sfType === 'N') forceVal = s[i]?.[0] ?? 0;
else if (sfType === 'V') forceVal = s[i]?.[1] ?? 0;
else if (sfType === 'M') forceVal = -(s[i]?.[2] ?? 0);

if (!Number.isFinite(forceVal)) forceVal = 0;  // extra safety

  // For trusses, skip drawing shear or moment
  if (!isFrame && sfType !== 'N') {
    return basePoints[i];
  }

  const offset = forceVal * diagScale;
  return {
    x: basePoints[i].x - offset * cosb,
    y: basePoints[i].y + offset * cosa
  };
});


      // Skip empty diagrams (like moments in trusses)
      const isTrussWithoutN = !isFrame && sfType !== 'N';
      if (isTrussWithoutN) return;

      // Define diagram colors
      const colors = {
        'M': { fill: 'rgba(214, 39, 40, 0.2)', stroke: '#d62728' },
        'V': { fill: 'rgba(44, 160, 44, 0.2)', stroke: '#2ca02c' },
        'N': { fill: 'rgba(31, 119, 180, 0.2)', stroke: '#1f77b4' }
      };
      const { fill, stroke } = colors[sfType];

      // Create closed polygon for filled area
      const areaPoints = [
        ...basePoints, // Start with base points
        ...diagramPoints.slice().reverse() // Then diagram points in reverse order
      ];

      // Draw the filled area
      const areaGenerator = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveLinearClosed);
      
      root.append("path")
        .datum(areaPoints)
        .attr("d", areaGenerator)
        .attr("fill", fill)
        .attr("stroke", "none");

      // Draw the force diagram curve
      const line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));

      root.append("path")
        .datum(diagramPoints)
        .attr("d", line)
        .attr("stroke", stroke)
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      // Find min/max values for labeling
      let minVal = Infinity, maxVal = -Infinity;
      let minIdx = -1, maxIdx = -1;
      
      // Skip endpoints in min/max search since we'll label them separately
      for (let i = 1; i < s.length - 1; i++) {
        let val = 0;
        if (sfType === 'N') val = s[i]?.[0] ?? 0;
        else if (sfType === 'V') val = s[i]?.[1] ?? 0;
        else if (sfType === 'M') val = s[i]?.[2] ?? 0;

        if (val < minVal) {
          minVal = val;
          minIdx = i;
        }
        if (val > maxVal) {
          maxVal = val;
          maxIdx = i;
        }
      }


      // Add labels at endpoints
      if (s.length > 0) {
        const startVal = sfType === 'N' ? s[0]?.[0] ?? 0 :
                        sfType === 'V' ? s[0]?.[1] ?? 0 :
                        s[0]?.[2] ?? 0;

        const endVal = sfType === 'N' ? s[s.length - 1]?.[0] ?? 0 :
                      sfType === 'V' ? s[s.length - 1]?.[1] ?? 0 :
                      s[s.length - 1]?.[2] ?? 0;

        addLabel(diagramPoints[0], startVal);
        addLabel(diagramPoints[diagramPoints.length - 1], endVal);
      }


      // Add min value point if found
      if (minIdx !== -1) {
        const val = sfType === 'N' ? s[minIdx][0] : 
                   sfType === 'V' ? s[minIdx][1] : 
                   s[minIdx][2];
        addLabel(diagramPoints[minIdx], val, true);
      }
      
      // Add max value point if found and different from min
      if (maxIdx !== -1 && maxIdx !== minIdx) {
        const val = sfType === 'N' ? s[maxIdx][0] : 
                   sfType === 'V' ? s[maxIdx][1] : 
                   s[maxIdx][2];
        addLabel(diagramPoints[maxIdx], val, true);
      }
    });

  }, [elementsData, sfType, diagScale, width, height, margin, nodeCoordinates, supports]);

return (
  <div className="section-force-container">
    <div className="force-controls">
      <label>Force Type:</label>
      <select 
        value={sfType} 
        onChange={e => setSfType(e.target.value)}
      >
        <option value="N">Axial Force (N)</option>
        <option value="V">Shear Force (V)</option>
        <option value="M">Bending Moment (M)</option>
      </select>
    </div>

    <div className="section-force-container">
      <svg ref={svgRef} width={width} height={height} className="section-force-svg" />
    </div>
  </div>
);
}

/**
 * Calculate optimal scale factor based on force magnitudes and structure size
 */
function calculateOptimalScale(elementsData, sfType) {
  if (elementsData.length === 0) return 0.1;
  
  let maxForce = 0;
  let totalLength = 0;
  
  // Find maximum force value and total length of all elements
  elementsData.forEach(({ s, length }) => {
    s.forEach(point => {
      let forceVal = 0;
      if (sfType === 'N') forceVal = Math.abs(point[0]);
      else if (sfType === 'V') forceVal = Math.abs(point[1]);
      else if (sfType === 'M') forceVal = Math.abs(point[2]);
      
      if (forceVal > maxForce) maxForce = forceVal;
    });
    totalLength += length;
  });
  
  const avgLength = totalLength / elementsData.length;
  
  // Handle case where there are no forces
  if (maxForce === 0) return 0.1;
  
  // Calculate scale factor - ensures diagram is proportional to structure
  const targetMaxOffset = avgLength * 0.15; // Max diagram offset should be 15% of element length
  return targetMaxOffset / maxForce;
}

