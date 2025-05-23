// NodeAndElements.jsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useDataCentre, addNode, updateNode, addElement, updateElement, addForce, updateForce, addSupport, updateSupport } from '../../middleware/DataCentre'
import './NodeElements.css';
import sceneRef from '../../middleware/SceneRef.jsx';
const NodeAndElements = () => {
  const { data, setData } = useDataCentre();
  const { nodes, elements, forces, supports } = data;
  const [newNode, setNewNode] = useState({ tag: 1, x: '', y: '' });
  const [newElement, setNewElement] = useState({ tag: 1, start: '', end: '', area: '', E: '' });
  const [newForce, setNewForce] = useState({ node: '', xf: '', yf: '' });
  const [newSupport, setNewSupport] = useState({ node: '', xd: 0, yd: 0 });
  const [activeTab, setActiveTab] = useState('Nodes');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editItem, setEditItem] = useState({});
  const groupRef = useRef(new THREE.Group());


  useEffect(() => {
    const scene = sceneRef.current;
    // add group once
    if (!scene.getObjectById(groupRef.current.id)) {
      scene.add(groupRef.current);
    }

    // clear previous dynamic objects
    groupRef.current.clear();

    // draw nodes
    nodes.forEach(n => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.2),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      sphere.position.set(n.x, n.y, 0);
      groupRef.current.add(sphere);
    });

    // draw elements
    elements.forEach(el => {
      const startNode = nodes.find(n => n.tag === el.start);
      const endNode   = nodes.find(n => n.tag === el.end);
      if (!startNode || !endNode) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(startNode.x, startNode.y, 0),
        new THREE.Vector3(endNode.x, endNode.y, 0)
      ]);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x0000ff })
      );
      groupRef.current.add(line);
    });

    // draw forces
    forces.forEach(f => {
      const node = nodes.find(n => n.tag === f.node);
      if (!node) return;
      if (f.xf !== 0) {
        const dirX = new THREE.Vector3(Math.sign(f.xf), 0, 0);
        const arrowX = new THREE.ArrowHelper(
          dirX,
          new THREE.Vector3(node.x, node.y, 0),
          1,
          0xbd2b33,
          0.2,
          0.1
        );
        groupRef.current.add(arrowX);
      }
      if (f.yf !== 0) {
        const dirY = new THREE.Vector3(0, Math.sign(f.yf), 0);
        const arrowY = new THREE.ArrowHelper(
          dirY,
          new THREE.Vector3(node.x, node.y, 0),
          1,
          0x218838,
          0.2,
          0.1
        );
        groupRef.current.add(arrowY);
      }
    });

    // draw supports
    supports.forEach(s => {
      const node = nodes.find(n => n.tag === s.node);
      if (!node) return;
      const base = new THREE.Vector3(node.x, node.y - 0.3, 0);
      if ((s.xd === 1 && s.yd === 0) || (s.xd === 0 && s.yd === 1)) {
        // roller support
        const wheelGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12);
        const wheelMat  = new THREE.MeshBasicMaterial({ color: 0x000000 });
        [-0.15, 0.15].forEach(offsetX => {
          const wheel = new THREE.Mesh(wheelGeom, wheelMat);
          wheel.position.set(node.x + offsetX, node.y - 0.3, 0);
          wheel.rotation.x = Math.PI / 2;
          groupRef.current.add(wheel);
        });
      } else if (s.xd === 1 && s.yd === 1) {
        // pinned support
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.6, 0.6, 8),
          new THREE.MeshBasicMaterial({ color: 0xe00700 })
        );
        cone.position.copy(base);
        groupRef.current.add(cone);
      }
    });

  }, [nodes, elements, forces, supports, sceneRef]);

  // Add new item
  const addItem = type => {
    switch (type) {
      case 'Nodes':
        addNode(setData, {
          tag: parseInt(newNode.tag, 10),
          x:   parseFloat(newNode.x),
          y:   parseFloat(newNode.y)
        });
        setNewNode({ tag: newNode.tag + 1, x: '', y: '' });
        break;

      case 'Elements':
        addElement(setData, {
          tag:   parseInt(newElement.tag, 10),
          start: parseInt(newElement.start, 10),
          end:   parseInt(newElement.end, 10),
          area:  parseFloat(newElement.area) || 0,
          E:     parseFloat(newElement.E)    || 0
        });
        setNewElement({ tag: newElement.tag + 1, start: '', end: '', area: '', E: '' });
        break;

      case 'Forces':
        addForce(setData, {
          node: parseInt(newForce.node, 10),
          xf:   parseFloat(newForce.xf) || 0,
          yf:   parseFloat(newForce.yf) || 0
        });
        setNewForce({ node: '', xf: '', yf: '' });
        break;

      case 'Supports':
        addSupport(setData, {
          node: parseInt(newSupport.node, 10),
          xd:   newSupport.xd,
          yd:   newSupport.yd
        });
        setNewSupport({ node: '', xd: 0, yd: 0 });
        break;
      default:
        break;
    }
  };

  // Begin editing an item
  const startEdit = (type, idx) => {
    setActiveTab(type);
    setEditingIndex(idx);
    const item = { Nodes: nodes, Elements: elements, Forces: forces, Supports: supports }[type][idx];
    setEditItem(type==='Forces'
      ? { node: item.node, xf: String(item.xf), yf: String(item.yf) }
      : { ...item }
    );
  };

  // Save the edited item
  const saveEdit = () => {
    const item = { ...editItem };
    switch (activeTab) {
      case 'Nodes':
        updateNode(setData, editingIndex, {
          tag: parseInt(editItem.tag, 10),
          x:   parseFloat(editItem.x),
          y:   parseFloat(editItem.y),
        });
        break;

      case 'Elements':
        updateElement(setData, editingIndex, {
          tag:   parseInt(editItem.tag, 10),
          start: parseInt(editItem.start, 10),
          end:   parseInt(editItem.end,   10),
          area:  parseFloat(editItem.area) || 0,
          E:     parseFloat(editItem.E)    || 0,
        });
        break;
        case 'Forces':
          updateForce(setData, editingIndex, {
            node: parseInt(item.node, 10),
            xf:   parseFloat(item.xf) || 0,
            yf:   parseFloat(item.yf) || 0,
          });
          break;

        case 'Supports':
          updateSupport(setData, editingIndex, {
            node: parseInt(item.node, 10),
            xd:   item.xd,
            yd:   item.yd,
          });
          break;

        break;
      default:
        break;
    }
    setEditingIndex(null);
    setEditItem({});
  };

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
    </div>
  );
};

export default NodeAndElements;