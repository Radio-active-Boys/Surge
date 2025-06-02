// Model.jsx
import React, { useEffect, useRef, useState } from 'react';
import Trail from '../middleware/Trail';
import NodeAndElements from './truss2D/NodeAndElemnts';
const Model = () => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '500px 1fr',
        height: '100vh'
      }}
    >
      {/* Make this div fill the full height */}
      <div style={{ padding: '1rem', height: '100%', overflowY: 'hidden' }}>
        <h2>I am Working on 2D Truss</h2>
        <div style={{ height: 'calc(100% - 2rem)' }}>
          {/* subtract heading height to let NodeAndElements fill */}
          <NodeAndElements />
        </div>
      </div>
      <Trail />
    </div>
  );
};


export default Model;