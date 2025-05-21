import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';

const StructuralViewer2D = () => {
  const [nodes, setNodes] = useState([]);
  const [elements, setElements] = useState([]);
  const [newNode, setNewNode] = useState({ tag: '', x: 0, y: 0 });
  const [newElement, setNewElement] = useState({ tag: '', start: '', end: '' });

  const mountRef = useRef();
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef();
  const rendererRef = useRef();
  const labelRendererRef = useRef();
  const controlsRef = useRef();

  useEffect(() => {
    const mount = mountRef.current;
    const scene = sceneRef.current;
    const width = mount.clientWidth, height = mount.clientHeight;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0xf0f0f0);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CSS2D Renderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.style.zIndex = '1';
    mount.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lights
    scene.add(new THREE.AmbientLight(0x404040));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(0, 10, 5);
    scene.add(dirLight);

    // Grids
    const size = 20, divisions = 50;
    const xyGrid = new THREE.GridHelper(size, divisions);
    xyGrid.rotation.x = Math.PI / 2;
    scene.add(xyGrid);

    // Axes
    scene.add(new THREE.AxesHelper(25));

    // Label factory
    const makeLabel = (text, color, pos) => {
      const div = document.createElement('div');
      div.className = 'axis-label';
      div.textContent = text;
      div.style.color = color;
      div.style.fontSize = '16px';
      div.style.fontWeight = 'bold';
      const label = new CSS2DObject(div);
      label.position.copy(pos);
      return label;
    };

    // X, Y, Z labels
    scene.add(makeLabel('X', 'red',   new THREE.Vector3(26, 0, 0)));
    scene.add(makeLabel('Y', 'green', new THREE.Vector3(0, 26, 0)));
    scene.add(makeLabel('Z', 'blue',  new THREE.Vector3(0, 0, 26)));

    // Animate
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      mount.removeChild(renderer.domElement);
      mount.removeChild(labelRenderer.domElement);
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // Update structure
  useEffect(() => {
    const scene = sceneRef.current;
    while (scene.children.length > 7) {
      scene.remove(scene.children[7]);
    }
    nodes.forEach(n => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.2),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      sphere.position.set(n.x, n.y, 0);
      scene.add(sphere);
    });
    elements.forEach(el => {
      const s = nodes.find(n => n.tag === el.start);
      const e = nodes.find(n => n.tag === el.end);
      if (s && e) {
        const geom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(s.x, s.y, 0),
          new THREE.Vector3(e.x, e.y, 0),
        ]);
        scene.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x0000ff })));
      }
    });
  }, [nodes, elements]);

  const handleAddNode = () => {
    if (!newNode.tag) return;
    setNodes([...nodes, { tag: newNode.tag, x: newNode.x, y: newNode.y }]);
    setNewNode({ tag: '', x: 0, y: 0 });
  };
  const handleAddElement = () => {
    if (!newElement.tag) return;
    setElements([...elements, { ...newElement }]);
    setNewElement({ tag: '', start: '', end: '' });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: '100vh' }}>
      <div style={{ padding: '1rem', overflowY: 'auto' }}>
        <h3>Add Node</h3>
        <input
          type="text" placeholder="Tag"
          value={newNode.tag}
          onChange={e => setNewNode({ ...newNode, tag: e.target.value })}
        />
        <input
          type="number" placeholder="X"
          value={newNode.x}
          onChange={e => setNewNode({ ...newNode, x: parseFloat(e.target.value) })}
        />
        <input
          type="number" placeholder="Y"
          value={newNode.y}
          onChange={e => setNewNode({ ...newNode, y: parseFloat(e.target.value) })}
        />
        <button onClick={handleAddNode}>Add Node</button>

        <h3 style={{ marginTop: '2rem' }}>Add Element</h3>
        <input
          type="text" placeholder="Tag"
          value={newElement.tag}
          onChange={e => setNewElement({ ...newElement, tag: e.target.value })}
        />
        <input
          type="text" placeholder="Start"
          value={newElement.start}
          onChange={e => setNewElement({ ...newElement, start: e.target.value })}
        />
        <input
          type="text" placeholder="End"
          value={newElement.end}
          onChange={e => setNewElement({ ...newElement, end: e.target.value })}
        />
        <button onClick={handleAddElement}>Add Element</button>

        <pre style={{ marginTop: '1rem' }}>
          {JSON.stringify({ nodes, elements }, null, 2)}
        </pre>
      </div>

      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      />
    </div>
  );
};

export default StructuralViewer2D;
