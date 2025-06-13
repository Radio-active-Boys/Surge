// src/components/visualization/TrussVisualizer.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { usePlotParser } from '../../utils/plotParser';
import './TrussVisualizer.module.css';

export default function TrussVisualizer() {
  // Get parsed data from plotParser; assumed to include series like nodeDispSeries, nodeReactionSeries, eleAxialForceSeries
  const parsed = usePlotParser();
  const {
    nodeCoordinates,
    elementConnectivity,
    nodeDispSeries,
    nodeReactionSeries,
    eleAxialForceSeries,
    // ...other series if available
  } = parsed;

  // Build unified timeSteps inside this component
  const timeSteps = useMemo(() => {
    if (!Array.isArray(nodeDispSeries) || nodeDispSeries.length === 0) {
      return [];
    }
    const dispSeries = nodeDispSeries;
    const reactSeries = Array.isArray(nodeReactionSeries) ? nodeReactionSeries : [];
    const axialSeries = Array.isArray(eleAxialForceSeries) ? eleAxialForceSeries : [];

    return dispSeries.map((dispEntry, i) => {
      const time = dispEntry.time;
      const displacements = dispEntry.data || {};
      const reactions = (reactSeries[i] && reactSeries[i].data) || {};
      const axialForces = (axialSeries[i] && axialSeries[i].data) || {};
      return { time, displacements, reactions, axialForces };
    });
  }, [nodeDispSeries, nodeReactionSeries, eleAxialForceSeries]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('deformed');
  const [displacementScale, setDisplacementScale] = useState(100);
  const [hoverInfo, setHoverInfo] = useState(null);

  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomTransform = useRef(d3.zoomIdentity);

  // --- 1) Animation timer ---
  useEffect(() => {
    if (!isPlaying || timeSteps.length === 0) return;
    const timer = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % timeSteps.length);
    }, 300);
    return () => clearInterval(timer);
  }, [isPlaying, timeSteps.length]);

  // --- 2) One-time zoom setup ---
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (e) => {
        zoomTransform.current = e.transform;
        if (containerRef.current) {
          d3.select(containerRef.current).attr('transform', e.transform);
        }
      });
    svg.call(zoomBehavior);
  }, []);

  // --- 3) Compute deformed coordinates ---
  const deformedNodeCoordinates = useMemo(() => {
    if (timeSteps.length === 0 || !nodeCoordinates) return {};
    const ts = timeSteps[currentStep];
    if (!ts || !ts.displacements) return {};
    return Object.fromEntries(
      Object.entries(nodeCoordinates).map(([id, { x, y }]) => {
        const disp = ts.displacements[id] || { '1': 0, '2': 0 };
        return [
          id,
          {
            x: x + disp['1'] * displacementScale,
            y: y + disp['2'] * displacementScale
          }
        ];
      })
    );
  }, [nodeCoordinates, timeSteps, currentStep, displacementScale]);

  // --- 4) Compute axial-force color mapping ---
  const elementColors = useMemo(() => {
    if (timeSteps.length === 0 || !elementConnectivity) return {};
    const ts = timeSteps[currentStep];
    if (!ts || !ts.axialForces) return {};
    const forces = elementConnectivity.map(el =>
      Math.abs(ts.axialForces[el.id] || 0)
    );
    const max = Math.max(...forces, 1);
    return Object.fromEntries(
      elementConnectivity.map(el => {
        const f = ts.axialForces[el.id] || 0;
        return [
          el.id,
          f >= 0
            ? d3.interpolateReds(f / max)      // tension = red
            : d3.interpolateBlues(-f / max)    // compression = blue
        ];
      })
    );
  }, [elementConnectivity, timeSteps, currentStep]);

  // --- 5) Main draw effect ---
  useEffect(() => {
    if (!nodeCoordinates || !elementConnectivity || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = 50;

    // Clear previous contents except zoom behavior binding
    svg.selectAll('defs, g#zoom-container').remove();

    // Scales based on original geometry
    const allNodes = Object.values(nodeCoordinates);
    if (allNodes.length === 0) return;
    const xExt = d3.extent(allNodes, d => d.x);
    const yExt = d3.extent(allNodes, d => d.y);
    const xScale = d3.scaleLinear()
      .domain([xExt[0] - margin, xExt[1] + margin])
      .range([margin, width - margin]);
    const yScale = d3.scaleLinear()
      .domain([yExt[0] - margin, yExt[1] + margin])
      .range([height - margin, margin]);

    // Arrowhead defs for reactions
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowx')
      .attr('viewBox', '0 0 100 100')
      .attr('refX', 10).attr('refY', 5)
      .attr('markerWidth', 4).attr('markerHeight', 4)
      .append('path')
      .attr('d', 'M0,0 L10,5 L0,10').attr('fill', 'steelblue');
    defs.append('marker')
      .attr('id', 'arrowy')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5).attr('refY', 0)
      .attr('markerWidth', 4).attr('markerHeight', 4)
      .append('path')
      .attr('d', 'M0,0 L5,10 L10,0').attr('fill', 'tomato');

    // Single zoom container
    const container = svg.append('g').attr('id', 'zoom-container');
    containerRef.current = container.node();
    container.attr('transform', zoomTransform.current);

    // If in 'deformed' tab, overlay original as dashed
    if (activeTab === 'deformed') {
      elementConnectivity.forEach(el => {
        const a = nodeCoordinates[el.i];
        const b = nodeCoordinates[el.j];
        if (a && b) {
          container.append('line')
            .attr('x1', xScale(a.x)).attr('y1', yScale(a.y))
            .attr('x2', xScale(b.x)).attr('y2', yScale(b.y))
            .attr('stroke', '#666')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4 4');
        }
      });
    }

    // Draw elements
    elementConnectivity.forEach(el => {
      const coordsMap = activeTab === 'deformed' ? deformedNodeCoordinates : nodeCoordinates;
      const p = coordsMap[el.i], q = coordsMap[el.j];
      if (!p || !q) return;
      const line = container.append('line')
        .attr('x1', xScale(p.x)).attr('y1', yScale(p.y))
        .attr('x2', xScale(q.x)).attr('y2', yScale(q.y))
        .attr('stroke',
          activeTab === 'axial' ? (elementColors[el.id] || '#999') : '#999'
        )
        .attr('stroke-width',
          activeTab === 'axial' ? 4 : 2
        )
        .on('mouseover', (event) => {
          if (timeSteps.length === 0) return;
          const [mx, my] = d3.pointer(event, svgRef.current);
          const force = timeSteps[currentStep]?.axialForces?.[el.id] || 0;
          setHoverInfo({
            type: 'element',
            id: el.id,
            force,
            x: mx + 10,
            y: my + 10
          });
        })
        .on('mouseout', () => setHoverInfo(null));
    });

    // Draw nodes
    const nodeSet = activeTab === 'deformed' ? deformedNodeCoordinates : nodeCoordinates;
    Object.entries(nodeSet).forEach(([id, { x, y }]) => {
      const circle = container.append('circle')
        .attr('cx', xScale(x)).attr('cy', yScale(y))
        .attr('r', 5)
        .attr('fill', '#333')
        .on('mouseover', (event) => {
          if (timeSteps.length === 0) return;
          const [mx, my] = d3.pointer(event, svgRef.current);
          const disp = timeSteps[currentStep]?.displacements?.[id] || null;
          const react = timeSteps[currentStep]?.reactions?.[id] || null;
          setHoverInfo({
            type: 'node',
            id,
            displacement: disp,
            reaction: react,
            x: mx + 10,
            y: my + 10
          });
        })
        .on('mouseout', () => setHoverInfo(null));
    });

    // Draw reactions if in 'reactions' tab
    if (activeTab === 'reactions' && timeSteps.length > 0) {
      const ts = timeSteps[currentStep];
      const arrowLength = 10;
      const EPSILON = 1e-6;
      Object.entries(ts.reactions || {}).forEach(([id, r]) => {
        if (!r) return;
        const orig = nodeCoordinates[id];
        if (!orig) return;
        const sx = xScale(orig.x);
        const sy = yScale(orig.y);
        [
          ['1', 'steelblue', 'arrowx', 1, 0],
          ['2', 'tomato', 'arrowy', 0, -1]
        ].forEach(([ax, color, marker, dx, dy]) => {
          const val = r[ax];
          if (Math.abs(val) < EPSILON) return;
          const direction = Math.sign(val);
          const sxArrow = sx + direction * dx * arrowLength;
          const syArrow = sy + direction * dy * arrowLength;
          container.append('line')
            .attr('x1', sxArrow).attr('y1', syArrow)
            .attr('x2', sx).attr('y2', sy)
            .attr('stroke', color)
            .attr('stroke-width', 1)
            .attr('marker-end', `url(#${marker})`);
        });
      });
    }

    // Draw legend in top-left
    const L = svg.append('g').attr('class','legend')
      .attr('transform','translate(10,10)');
    L.append('rect').attr('width',120).attr('height',50).attr('fill','#fff').attr('opacity',0.8);
    L.append('line').attr('x1',10).attr('y1',20).attr('x2',30).attr('y2',20).attr('stroke','red').attr('stroke-width',4);
    L.append('text').attr('x',35).attr('y',24).text('Tension').style('font-size','12px');
    L.append('line').attr('x1',10).attr('y1',40).attr('x2',30).attr('y2',40).attr('stroke','blue').attr('stroke-width',4);
    L.append('text').attr('x',35).attr('y',44).text('Compression').style('font-size','12px');

  }, [
    nodeCoordinates,
    elementConnectivity,
    deformedNodeCoordinates,
    currentStep,
    activeTab,
    elementColors,
    timeSteps
  ]);

  // If essential data missing or no timeSteps yet, show loading
  if (!nodeCoordinates || !elementConnectivity || timeSteps.length === 0) {
    return <div>Loading truss data…</div>;
  }

  return (
    <div className="truss-visualizer">
      {/* Controls (tabs, slider, play/pause, scale) */}
      <div className="controls">
        <div className="tabs">
          {['undeformed','deformed','axial','reactions'].map(tab => (
            <button
              key={tab}
              className={activeTab===tab?'active':''}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase()+tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="slider-container">
          <input
            type="range"
            min="0" max={timeSteps.length-1}
            value={currentStep}
            onChange={e => setCurrentStep(+e.target.value)}
          />
          <span>Time: {timeSteps[currentStep].time.toFixed(2)}</span>
        </div>
        <div className="playback">
          <button onClick={()=>setIsPlaying(!isPlaying)}>
            {isPlaying?'Pause':'Play'}
          </button>
          <button onClick={()=>setCurrentStep(0)}>Reset</button>
        </div>
        {activeTab==='deformed' && (
          <div className="scale-control">
            <label>Displacement Scale:</label>
            <input
              type="range" min="1" max="500"
              value={displacementScale}
              onChange={e=>setDisplacementScale(+e.target.value)}
            />
            <span>{displacementScale}×</span>
          </div>
        )}
      </div>

      {/* SVG viewport */}
      <div className="visualization" style={{ position: 'relative' }}>
        <svg ref={svgRef} width="100%" height="600px" />
        {hoverInfo && (
          <div
            className="tooltip"
            style={{
              position: 'absolute',
              left: hoverInfo.x,
              top: hoverInfo.y,
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #ccc',
              padding: '4px',
              pointerEvents: 'none'
            }}
          >
            {hoverInfo.type==='node' ? (
              <>
                <h4 style={{ margin: '2px 0' }}>Node {hoverInfo.id}</h4>
                {hoverInfo.displacement && (
                  <p style={{ margin: '2px 0' }}>
                    Displacement:<br/>
                    X: {hoverInfo.displacement['1'].toExponential(2)}<br/>
                    Y: {hoverInfo.displacement['2'].toExponential(2)}
                  </p>
                )}
                {hoverInfo.reaction && (
                  <p style={{ margin: '2px 0' }}>
                    Reaction:<br/>
                    X: {hoverInfo.reaction['1'].toFixed(2)}<br/>
                    Y: {hoverInfo.reaction['2'].toFixed(2)}
                  </p>
                )}
              </>
            ) : (
              <>
                <h4 style={{ margin: '2px 0' }}>Element {hoverInfo.id}</h4>
                <p style={{ margin: '2px 0' }}>Axial Force: {hoverInfo.force.toFixed(2)}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
