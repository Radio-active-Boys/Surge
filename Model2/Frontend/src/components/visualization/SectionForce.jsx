import React, { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { usePlotParser } from "../../utils/plotParser";

function sectionForceDistribution2D(ecrd, pl, eleLoadData = [['-beamUniform', 0, 0]], nep = 2) {
  const [p1, p2] = ecrd;
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const L = Math.hypot(dx, dy) || 1;
  const isFrame = pl.length === 6;

  // 1) initial evaluation points
  let xl = Array.from({ length: nep }, (_, i) => (L * i) / (nep - 1));

  // 2) add UDL/trap breakpoints & point load offsets
  const EPS = 1e-6 * L;
  eleLoadData.forEach(load => {
    if (load[0] === '-beamUniform' && load.length === 7) {
      const a = load[3] * L, b = load[4] * L;
      [a, b].forEach(x => {
        if (!xl.some(xx => Math.abs(xx - x) < EPS)) xl.push(x);
      });
    }
    if (load[0] === '-beamPoint') {
      const a = load[2] * L;
      if (!xl.some(xx => Math.abs(xx - a) < EPS)) {
        xl.push(a);
        xl.push(a + EPS);
      }
    }
  });

  // 3) sort & reset nep
  xl.sort((a, b) => a - b);
  nep = xl.length;

  // 4) unpack nodal forces: always capture axial, shear, moment
  //    parser must return local FX_i, FY_i, MZ_i
  let N1 = 0, V1 = 0, M1 = 0;
  if (isFrame) {
    [N1, V1, M1] = pl;
  } else {
    // for beams, pl = [FX_i], but we still need shear & moment:
    N1 = pl[0];
    // assume plExtended contains [FX_i, FY_i, MZ_i]
    // adjust here to pull from eleLoadData or separate source:
    V1 = pl[1] || 0;    // local shear at start
    M1 = pl[2] || 0;    // local moment at start
  }

  // 5) initialize baseline arrays for all elements
  const N = Array(nep).fill(-N1);
  const V = Array(nep).fill(V1);
  const M = xl.map(x => -M1 + V1 * x);

  // 6) superimpose each load
  eleLoadData.forEach(load => {
    if (load[0] === '-beamUniform') {
      if (load.length === 3) {
        const Wy = load[1], Wx = load[2];
        xl.forEach((x, i) => {
          N[i] -= Wx * x;
          V[i] += Wy * x;
          M[i] += 0.5 * Wy * x * x;
        });
      } else {
        const Wy0 = load[1], Wx0 = load[2];
        const a = load[3] * L, b = load[4] * L;
        const Wy1 = load[5], Wx1 = load[6];
        const span = b - a;
        const A_full = 0.5 * (Wy0 + Wy1) * span;
        const c_full = span === 0 ? span / 2 : span * (2 * Wy0 + Wy1) / (3 * (Wy0 + Wy1));

        xl.forEach((x, i) => {
          // axial
          N[i] -= (Wx0 + ((Wx1 - Wx0) * Math.min(Math.max((x - a) / span, 0), 1))) * x;
          // shear & moment
          if (x < a) return;
          if (x <= b) {
            const xa = x - a;
            const Wy_x = Wy0 + (Wy1 - Wy0) * (xa / span);
            const A = 0.5 * (Wy0 + Wy_x) * xa;
            const c = span === 0 ? xa / 2 : xa * (2 * Wy0 + Wy_x) / (3 * (Wy0 + Wy_x));
            V[i] += A;
            M[i] += A * (a + c);
          } else {
            V[i] += A_full;
            M[i] += A_full * (a + c_full);
          }
        });
      }
    }
    if (load[0] === '-beamPoint') {
      const Py = load[1], a = load[2] * L, Px = load[3] || 0;
      xl.forEach((x, i) => {
        if (x > a) {
          N[i] -= Px;
          V[i] += Py;
          M[i] += Py * (x - a);
        }
      });
    }
  });

  // 7) assemble section forces matrix
  const s = isFrame
    ? xl.map((_, i) => [N[i], V[i], M[i]])
    : xl.map((_, i) => [N[i]]);

  return { s, xl };
}

/**
 * Component to draw properly scaled section force diagrams
 */
export default function SectionForce({
 width = 1000, height = 600, margin = 40,
  nep = 17,
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
      // Create a unique key for this position
      const posKey = `${xScale(pt.x).toFixed(1)},${yScale(pt.y).toFixed(1)}`;
      
      // Skip if we've already labeled this position
      if (labelPositions.has(posKey)) return;
      labelPositions.add(posKey);
      
      const formattedValue = Math.abs(value) > 1000 
        ? `${(value/1000).toFixed(1)}k` 
        : value.toFixed(0);
      
      const text = root.append("text")
        .attr("x", xScale(pt.x))
        .attr("y", yScale(pt.y) - 8)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", isExtreme ? "10px" : "9px")
        .attr("font-weight", isExtreme ? "bold" : "normal")
        .text(formattedValue);
      
      if (isExtreme) {
        text.attr("fill", "#5550");
      } else {
        text.attr("fill", "#444");
      }
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
      const diagramPoints = xl.map((x, i) => {
        // Get force magnitude with proper sign
        let forceVal = 0;
        if (s[i] && s[i].length > 0) {
          if (sfType === 'N') forceVal = s[i][0];
          else if (sfType === 'V') forceVal = s[i][1];
          else if (sfType === 'M') forceVal = -s[i][2]; // Invert sign for moments
        }
        
        // Skip bending moment and shear for trusses
        if (!isFrame && sfType !== 'N') return {
          x: basePoints[i].x,
          y: basePoints[i].y
        };
        
        // Calculate offset perpendicular to element
        // Calculate offset
        const offset = forceVal * diagScale;
        
        // Apply offset based on direction mode

          return {
            x: basePoints[i].x - offset * cosb,
            y: basePoints[i].y + offset * cosa
          };
        }
      );

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
        if (sfType === 'N') val = s[i][0];
        else if (sfType === 'V') val = s[i][1];
        else if (sfType === 'M') val = s[i][2];
        
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
        // Start point
        addLabel(diagramPoints[0], 
          sfType === 'N' ? s[0][0] : 
          sfType === 'V' ? s[0][1] : 
          s[0][2]
        );
        
        // End point
        addLabel(diagramPoints[diagramPoints.length - 1], 
          sfType === 'N' ? s[s.length - 1][0] : 
          sfType === 'V' ? s[s.length - 1][1] : 
          s[s.length - 1][2]
        );
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

    <svg 
      ref={svgRef} 
      className="section-force-svg"
      width={width} 
      height={height} 
    />
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
