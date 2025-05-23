// Model.jsx
import React, { useEffect, useRef, useState } from 'react';
import Trail from '../middleware/Trail';
import NodeAndElements from './truss2D/NodeAndElemnts';
const Model = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '500px 1fr', height: '100vh' }}>
      <div style={{ padding: '1rem', overflowY: 'auto' }}>
        <NodeAndElements />
      </div>
      <Trail />
    </div>
  );
};

export default Model;