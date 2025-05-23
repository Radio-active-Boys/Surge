import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import sceneRef from './SceneRef.jsx';

const Trail = () => {
 
  const mountRef = useRef();
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
    camera.position.set(0, 0, 45);
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
    const size = 60, divisions = 50;
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


  return (
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      />
  );
};

export default Trail;
