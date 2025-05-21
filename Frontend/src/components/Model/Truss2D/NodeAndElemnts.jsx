// NodeElements.jsx

import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import './NodeElements.css';

const NodeElements = ({ sceneRef }) => {
  const [nodes, setNodes]       = useState([]);
  const [elements, setElements] = useState([]);
  const [forces, setForces]     = useState([]);
  const [supports, setSupports] = useState([]);

  const [newNode, setNewNode]       = useState({ tag: '', x: '', y: ''});
  const [newElement, setNewElement] = useState({ tag: '', start: '', end: '',area: '',E: ''  });
  const [newForce, setNewForce]     = useState({ node: '', xf: '', yf: '' });
  const [newSupport, setNewSupport] = useState({ node: '', xd: 0, yd: 0 });

  const [activeTab, setActiveTab]       = useState('Nodes');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editItem, setEditItem]         = useState({});
  const [showModal, setShowModal]       = useState(false);

  // Draw scene
  useEffect(() => {
    const scene = sceneRef.current;
    while (scene.children.length > 7) scene.remove(scene.children[7]);

    // Nodes
    nodes.forEach(n => {
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(0.2),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      sph.position.set(n.x, n.y, 0);
      scene.add(sph);
    });

    // Elements
    elements.forEach(el => {
      const A = nodes.find(n => n.tag === el.start);
      const B = nodes.find(n => n.tag === el.end);
      if (A && B) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(A.x, A.y, 0),
          new THREE.Vector3(B.x, B.y, 0),
        ]);
        scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x0000ff })));
      }
    });

    // Forces (X and Y separately, each length = 1)
    forces.forEach(f => {
      const n = nodes.find(n => n.tag === f.node);
      if (!n) return;
      if (f.xf !== 0) {
        const dirX = new THREE.Vector3(Math.sign(f.xf), 0, 0);
        const arrowX = new THREE.ArrowHelper(
          dirX, new THREE.Vector3(n.x, n.y, 0),
          1, 0x00ff00, 0.2, 0.1
        );
        scene.add(arrowX);
      }
      if (f.yf !== 0) {
        const dirY = new THREE.Vector3(0, Math.sign(f.yf), 0);
        const arrowY = new THREE.ArrowHelper(
          dirY, new THREE.Vector3(n.x, n.y, 0),
          1, 0x00ff00, 0.2, 0.1
        );
        scene.add(arrowY);
      }
    });

    // Supports (cone for pinned, wheels for roller)
    supports.forEach(su => {
      const n = nodes.find(n => n.tag === su.node);
      if (!n) return;
      const offsetY = 0.3;
      const basePos = new THREE.Vector3(n.x, n.y - offsetY, 0);

      if (su.xd === 0 && su.yd === 0) {
        // roller: two wheels
        const wheelGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12);
        const wheelMat  = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const left  = new THREE.Mesh(wheelGeom, wheelMat);
        const right = left.clone();
        left.position.set(n.x - 0.15, n.y - offsetY, 0);
        right.position.set(n.x + 0.15, n.y - offsetY, 0);
        left.rotation.x = Math.PI / 2;
        right.rotation.x = Math.PI / 2;
        scene.add(left, right);
      } else {
        // pinned: cone pointing down
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.6, 0.6, 8),
          new THREE.MeshBasicMaterial({ color: 0x0000ff })
        );
        // cone.rotation.x = Math.PI;
        cone.position.copy(basePos);
        scene.add(cone);
      }
    });
  }, [nodes, elements, forces, supports, sceneRef]);

  // Add item
  const addItem = type => {
    switch (type) {
      case 'Nodes':
        if (!newNode.tag || nodes.some(n => n.tag === newNode.tag)) return;
        setNodes([...nodes, newNode]);
        setNewNode({ tag: '', x: 0, y: 0 });
        break;
      case 'Elements':
        if (!newElement.tag || elements.some(e => e.tag === newElement.tag)) return;
        setElements([...elements, newElement]);
        setNewElement({ tag: '', start: '', end: '',area: '',E: ''   });
        break;
      case 'Forces':
        if (!newForce.node) return;
        setForces([
          ...forces,
          {
            node: newForce.node,
            xf: parseFloat(newForce.xf) || 0,
            yf: parseFloat(newForce.yf) || 0
          }
        ]);
        setNewForce({ node: '', xf: '', yf: '' });
        break;
      case 'Supports':
        if (!newSupport.node) return;
        setSupports([...supports, newSupport]);
        setNewSupport({ node: '', xd: 0, yd: 0 });
        break;
      default:
        break;
    }
  };

  // Start editing
  const startEdit = (type, idx) => {
    setActiveTab(type);
    setEditingIndex(idx);
    const arrs = { Nodes: nodes, Elements: elements, Forces: forces, Supports: supports };
    const raw = arrs[type][idx];
    if (type === 'Forces') {
      setEditItem({
        node: raw.node,
        xf: String(raw.xf),
        yf: String(raw.yf)
      });
    } else {
      setEditItem({ ...raw });
    }
  };

  // Save edited
  const saveEdit = () => {
    const map = {
      Nodes:    [nodes, setNodes],
      Elements: [elements, setElements],
      Forces:   [forces, setForces],
      Supports: [supports, setSupports],
    };
    const [arr, setter] = map[activeTab];
    const upd = [...arr];
    if (activeTab === 'Forces') {
      upd[editingIndex] = {
        node: editItem.node,
        xf: parseFloat(editItem.xf) || 0,
        yf: parseFloat(editItem.yf) || 0
      };
    } else {
      upd[editingIndex] = editItem;
    }
    setter(upd);
    setEditingIndex(null);
    setEditItem({});
  };

  // Render list
  const renderList = (type, items, keys) => (
    <ul className="item-list">
      {items.map((it, i) => (
        <li key={i} className="item">
          <span>{keys.map(k => `${k.toUpperCase()}: ${it[k]}`).join(', ')}</span>
          <button className="edit-button" onClick={() => startEdit(type, i)}>Edit</button>
        </li>
      ))}
    </ul>
  );

  const jsonData = { nodes, elements, forces, supports };

  return (
    <div className="container">
      <div className="tabs">
        {['Nodes','Elements','Forces','Supports'].map(tab => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab); setEditingIndex(null); }}
          >{tab}</button>
        ))}
        <button className="preview-button" onClick={() => setShowModal(true)}>JSON</button>
      </div>

      <div className="content">
        {/* Nodes Tab */}
        {activeTab === 'Nodes' && (
          <section>
            {renderList('Nodes', nodes, ['tag','x','y'])}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Node</h5>
                <input value={editItem.tag} onChange={e => setEditItem({ ...editItem, tag: e.target.value })}/>
                <input type="number" value={editItem.x} onChange={e => setEditItem({ ...editItem, x: parseFloat(e.target.value) })}/>
                <input type="number" value={editItem.y} onChange={e => setEditItem({ ...editItem, y: parseFloat(e.target.value) })}/>
                <button className="save-button" onClick={saveEdit}>Save</button>
              </div>
            )}
            <div className="adder">
              <input placeholder="Tag" value={newNode.tag} onChange={e => setNewNode({ ...newNode, tag: e.target.value })}/>
              <input type="number" placeholder="X" value={newNode.x} onChange={e => setNewNode({ ...newNode, x: parseFloat(e.target.value) })}/>
              <input type="number" placeholder="Y" value={newNode.y} onChange={e => setNewNode({ ...newNode, y: parseFloat(e.target.value) })}/>
              <button className="add-button" onClick={() => addItem('Nodes')}>Add Node</button>
            </div>
          </section>
        )}

        {/* Elements Tab */}
        {activeTab === 'Elements' && (
          <section>
            {renderList('Elements', elements, ['tag','start','end'])}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Element</h5>
                <input value={editItem.tag} onChange={e => setEditItem({ ...editItem, tag: e.target.value })}/>
                <input placeholder="Start" value={editItem.start} onChange={e => setEditItem({ ...editItem, start: e.target.value })}/>
                <input placeholder="End" value={editItem.end} onChange={e => setEditItem({ ...editItem, end: e.target.value })}/>
                <input placeholder="area" value={editItem.area} onChange={e => setEditItem({ ...editItem, area: e.target.value })}/>
                <input placeholder="Elasticity" value={editItem.E} onChange={e => setEditItem({ ...editItem, E: e.target.value })}/>
                <button className="save-button" onClick={saveEdit}>Save</button>
              </div>
            )}
            <div className="adder">
              <input placeholder="Tag" value={newElement.tag} onChange={e => setNewElement({ ...newElement, tag: e.target.value })}/>
              <input placeholder="Start" value={newElement.start} onChange={e => setNewElement({ ...newElement, start: e.target.value })}/>
              <input placeholder="End" value={newElement.end} onChange={e => setNewElement({ ...newElement, end: e.target.value })}/>
              <input placeholder="Area" value={newElement.area} onChange={e => setNewElement({ ...newElement, area: e.target.value })}/>
              <input placeholder="Elastcity" value={newElement.E} onChange={e => setNewElement({ ...newElement, E: e.target.value })}/>
              <button className="add-button" onClick={() => addItem('Elements')}>Add Element</button>
            </div>
          </section>
        )}

        {/* Forces Tab */}
        {activeTab === 'Forces' && (
          <section>
            {renderList('Forces', forces, ['node','xf','yf'])}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Force</h5>
                <input placeholder="Node" value={editItem.node} onChange={e => setEditItem({ ...editItem, node: e.target.value })}/>
                <input placeholder="Xf" value={editItem.xf} onChange={e => setEditItem({ ...editItem, xf: e.target.value })}/>
                <input placeholder="Yf" value={editItem.yf} onChange={e => setEditItem({ ...editItem, yf: e.target.value })}/>
                <button className="save-button" onClick={saveEdit}>Save</button>
              </div>
            )}
            <div className="adder">
              <input placeholder="Node" value={newForce.node} onChange={e => setNewForce({ ...newForce, node: e.target.value })}/>
              <input placeholder="Xf" value={newForce.xf} onChange={e => setNewForce({ ...newForce, xf: e.target.value })}/>
              <input placeholder="Yf" value={newForce.yf} onChange={e => setNewForce({ ...newForce, yf: e.target.value })}/>
              <button className="add-button" onClick={() => addItem('Forces')}>Add Force</button>
            </div>
          </section>
        )}

        {/* Supports Tab */}
        {activeTab === 'Supports' && (
          <section>
            {renderList('Supports', supports, ['node','xd','yd'])}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Support</h5>
                <input placeholder="Node" value={editItem.node} onChange={e => setEditItem({ ...editItem, node: e.target.value })}/>
                <select value={editItem.xd} onChange={e => setEditItem({ ...editItem, xd: parseInt(e.target.value) })}>
                  <option value={0}>Free</option>
                  <option value={1}>Fixed</option>
                </select>
                <select value={editItem.yd} onChange={e => setEditItem({ ...editItem, yd: parseInt(e.target.value) })}>
                  <option value={0}>Free</option>
                  <option value={1}>Fixed</option>
                </select>
                <button className="save-button" onClick={saveEdit}>Save</button>
              </div>
            )}
            <div className="adder">
              <input placeholder="Node" value={newSupport.node} onChange={e => setNewSupport({ ...newSupport, node: e.target.value })}/>
              <select value={newSupport.xd} onChange={e => setNewSupport({ ...newSupport, xd: parseInt(e.target.value) })}>
                <option value={0}>Free</option>
                <option value={1}>Fixed</option>
              </select>
              <select value={newSupport.yd} onChange={e => setNewSupport({ ...newSupport, yd: parseInt(e.target.value) })}>
                <option value={0}>Free</option>
                <option value={1}>Fixed</option>
              </select>
              <button className="add-button" onClick={() => addItem('Supports')}>Add Support</button>
            </div>
          </section>
        )}
      </div>

      {/* JSON Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>JSON Data</h3>
            <pre className="modal-content">{JSON.stringify(jsonData, null, 2)}</pre>
            <button className="close-button" onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeElements;
