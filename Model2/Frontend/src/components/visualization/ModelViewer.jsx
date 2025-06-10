// src/components/visualization/ModelViewer.jsx
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import { useModelStore } from '../../stores/useModelStore';
import './ModelViewer.css'; // ensure .model-viewer { height: 500px; }

const ModelViewer = () => {
  const nodes    = useModelStore(state => state.node);
  const elements = useModelStore(state => state.element);

  const NodeMesh = ({ node }) => {
    const [tag, x=0, y=0, z=0] = node.args;
    return (
      <mesh position={[x, y, z]}>        
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="red" />
        <Text position={[0, 0.3, 0]} fontSize={0.3} anchorX="center" anchorY="bottom">
          {tag}
        </Text>
      </mesh>
    );
  };

  const ElementLine = ({ element }) => {
    // args: [type, eleTag, iTag, jTag, ...]
    const [, , iTag, jTag] = element.args.map(val => Number(val));
    const iNode = nodes.find(n => Number(n.args[0]) === iTag);
    const jNode = nodes.find(n => Number(n.args[0]) === jTag);
    if (!iNode || !jNode) return null;

    const [, xi=0, yi=0, zi=0] = iNode.args.map(Number);
    const [, xj=0, yj=0, zj=0] = jNode.args.map(Number);
    const points = [ [xi, yi, zi], [xj, yj, zj] ];

    // Use Drei's Line helper for reliable rendering
    return (
      <Line
        points={points}
        color="blue"
        lineWidth={2}
        dashed={false}
      />
    );
  };

  return (
    <div className="model-viewer">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls />
        <gridHelper args={[20, 20]} />
        <axesHelper args={[5]} />

        {nodes.map(n => <NodeMesh key={n.id} node={n} />)}
        {elements.map(e => <ElementLine key={e.id} element={e} />)}
      </Canvas>
    </div>
  );
};

export default ModelViewer;
