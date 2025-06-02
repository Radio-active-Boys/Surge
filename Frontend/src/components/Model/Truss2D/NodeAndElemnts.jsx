// NodeAndElements.jsx

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  useDataCentre,
  addNode,
  updateNode,
  addElement,
  updateElement,
  addForce,
  updateForce,
  addSupport,
  updateSupport,
  addMaterial,
  updateMaterial,
  addLoadPattern,
  updateLoadPattern,
  updateMetadata,
  addMetadata
} from '../../middleware/DataCentre';
import './NodeElements.css';
import sceneRef from '../../middleware/SceneRef.jsx';

const NodeAndElements = () => {
  const { data, setData } = useDataCentre();
  const {
    metadata = {},      // ← Now metadata is an object by default
    nodes = [],
    materials = [],
    elements = [],
    forces = [],
    supports = [],
    load_patterns = []
  } = data;

  // --- Local state for “adding new” entries ---
  const [newNode, setNewNode] = useState({ tag: 1, x: '', y: '' });
  const [newMaterial, setNewMaterial] = useState({ tag: 1, type: 'Elastic', E: '1', nu: '0.3' });
  const [newElement, setNewElement] = useState({ tag: 1, start: '', end: '', area: '', material: '' });
  const [newForce, setNewForce] = useState({ node: '', xf: '', yf: '' });
  const [newSupport, setNewSupport] = useState({ node: '', xd: 0, yd: 0 });
  const [newLoadPattern, setNewLoadPattern] = useState({
    tag: 1,
    type: 'static',
    time_series: { type: 'Constant', tag: 1 }
  });

  // Initialize newMetadata from metadata, or fallback to defaults
  const [newMetadata, setNewMetadata] = useState({
    title: metadata.title ?? '2D Truss Analysis Model',
    units: metadata.units ?? 'kN-m'
  });

  // --- Track which tab is visible: Nodes, Materials, Elements, Forces, Supports, LoadPatterns, Metadata ---
  const [activeTab, setActiveTab] = useState('Nodes');

  // --- Track which index is being edited (null if none) and the object under edit ---
  const [editingIndex, setEditingIndex] = useState(null);
  const [editItem, setEditItem] = useState({});

  const groupRef = useRef(new THREE.Group());

  // ------------ Three.js: draw current model every time data changes ------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Add group once
    if (!scene.getObjectById(groupRef.current.id)) {
      scene.add(groupRef.current);
    }

    // Clear previous objects
    groupRef.current.clear();

    // --- Draw nodes as red spheres ---
    nodes.forEach(n => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.2),
        new THREE.MeshPhongMaterial({ color: 0xff0000 })
      );
      sphere.position.set(n.x, n.y, 0);
      groupRef.current.add(sphere);
    });

    // --- Draw elements as blue lines ---
    elements.forEach(el => {
      const startNode = nodes.find(n => n.tag === el.start);
      const endNode = nodes.find(n => n.tag === el.end);
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

    // --- Draw forces as arrows ---
    forces.forEach(f => {
      const node = nodes.find(n => n.tag === f.node);
      if (!node) return;

      // X-direction arrow (red)
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
      // Y-direction arrow (green)
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

    // --- Draw supports as cones or rollers depending on xd/yd ---
    supports.forEach(s => {
      const node = nodes.find(n => n.tag === s.node);
      if (!node) return;

      const base = new THREE.Vector3(node.x, node.y - 0.3, 0);

      // Roller support: exactly one DOF fixed (xd=1 xor yd=1)
      if ((s.xd === 1 && s.yd === 0) || (s.xd === 0 && s.yd === 1)) {
        const wheelGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12);
        const wheelMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        [-0.15, 0.15].forEach(offsetX => {
          const wheel = new THREE.Mesh(wheelGeom, wheelMat);
          wheel.position.set(node.x + offsetX, node.y - 0.3, 0);
          wheel.rotation.x = Math.PI / 2;
          groupRef.current.add(wheel);
        });
      }
      // Pinned support: both DOFs fixed
      else if (s.xd === 1 && s.yd === 1) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.6, 0.6, 8),
          new THREE.MeshBasicMaterial({ color: 0xe00700 })
        );
        cone.position.copy(base);
        groupRef.current.add(cone);
      }
    });
  }, [nodes, elements, forces, supports]);

  // ------------ Helper to render a list + “Edit” buttons ------------
  const renderList = (type, items, keys) => (
    <ul className="item-list">
      {items.map((it, i) => (
        <li key={i} className="item">
          <span>
            {keys
              .map(k =>
                `${k.toUpperCase()}: ${typeof it[k] === 'object' ? JSON.stringify(it[k]) : it[k]}`
              )
              .join(', ')}
          </span>
          <button className="edit-button" onClick={() => startEdit(type, i)}>
            Edit
          </button>
        </li>
      ))}
    </ul>
  );

  // ------------ Add new item based on current tab ------------
  const addItem = type => {
    switch (type) {
      case 'Nodes':
        addNode(setData, {
          tag: parseInt(newNode.tag, 10),
          x: parseFloat(newNode.x),
          y: parseFloat(newNode.y)
        });
        setNewNode(prev => ({ tag: prev.tag + 1, x: '', y: '' }));
        break;

      case 'Materials':
        addMaterial(setData, {
          tag: parseInt(newMaterial.tag, 10),
          type: newMaterial.type,
          E: parseFloat(newMaterial.E),
          nu: parseFloat(newMaterial.nu)
        });
        setNewMaterial(prev => ({
          tag: prev.tag + 1,
          type: 'Elastic',
          E: '',
          nu: ''
        }));
        break;

      case 'Elements':
        addElement(setData, {
          tag: parseInt(newElement.tag, 10),
          start: parseInt(newElement.start, 10),
          end: parseInt(newElement.end, 10),
          area: parseFloat(newElement.area) || 0,
          material: parseInt(newElement.material, 10)
        });
        setNewElement(prev => ({
          tag: prev.tag + 1,
          start: '',
          end: '',
          area: '',
          material: ''
        }));
        break;

      case 'Forces':
        addForce(setData, {
          node: parseInt(newForce.node, 10),
          xf: parseFloat(newForce.xf) || 0,
          yf: parseFloat(newForce.yf) || 0
        });
        setNewForce({ node: '', xf: '', yf: '' });
        break;

      case 'Supports':
        addSupport(setData, {
          node: parseInt(newSupport.node, 10),
          xd: newSupport.xd,
          yd: newSupport.yd
        });
        setNewSupport({ node: '', xd: 0, yd: 0 });
        break;

      case 'LoadPatterns':
        addLoadPattern(setData, {
          tag: parseInt(newLoadPattern.tag, 10),
          type: newLoadPattern.type,
          time_series: { ...newLoadPattern.time_series }
        });
        setNewLoadPattern(prev => ({
          tag: prev.tag + 1,
          type: 'static',
          time_series: { type: 'Constant', tag: prev.time_series.tag + 1 }
        }));
        break;

      case 'Metadata':
        // If metadata already exists (i.e. metadata.title or metadata.units),
        // we call updateMetadata; otherwise addMetadata overwrites it.
        if (metadata && (metadata.title || metadata.units)) {
          updateMetadata(setData, 0, {
            title: newMetadata.title,
            units: newMetadata.units
          });
        } else {
          addMetadata(setData, {
            title: newMetadata.title,
            units: newMetadata.units
          });
        }
        break;

      default:
        break;
    }
  };

  // ------------ Start editing an item: populate fields ------------
  const startEdit = (type, idx) => {
    setActiveTab(type);
    setEditingIndex(idx);

    let item;
    switch (type) {
      case 'Nodes':
        item = nodes[idx];
        setEditItem({ tag: item.tag, x: String(item.x), y: String(item.y) });
        break;

      case 'Materials':
        item = materials[idx];
        setEditItem({
          tag: item.tag,
          type: item.type,
          E: String(item.E),
          nu: String(item.nu)
        });
        break;

      case 'Elements':
        item = elements[idx];
        setEditItem({
          tag: item.tag,
          start: String(item.start),
          end: String(item.end),
          area: String(item.area),
          material: String(item.material)
        });
        break;

      case 'Forces':
        item = forces[idx];
        setEditItem({
          node: String(item.node),
          xf: String(item.xf),
          yf: String(item.yf)
        });
        break;

      case 'Supports':
        item = supports[idx];
        setEditItem({
          node: String(item.node),
          xd: item.xd,
          yd: item.yd
        });
        break;

      case 'LoadPatterns':
        item = load_patterns[idx];
        setEditItem({
          tag: item.tag,
          type: item.type,
          time_series: { ...item.time_series }
        });
        break;

      case 'Metadata':
        // Populate editItem with existing metadata
        if (metadata) {
          setEditingIndex(0);
          setEditItem({
            title: metadata.title ?? '',
            units: metadata.units ?? ''
          });
        }
        break;

      default:
        break;
    }
  };

  // ------------ Save changes after editing ------------
  const saveEdit = () => {
    switch (activeTab) {
      case 'Nodes':
        updateNode(setData, editingIndex, {
          tag: parseInt(editItem.tag, 10),
          x: parseFloat(editItem.x),
          y: parseFloat(editItem.y)
        });
        break;

      case 'Materials':
        updateMaterial(setData, editingIndex, {
          tag: parseInt(editItem.tag, 10),
          type: editItem.type,
          E: parseFloat(editItem.E),
          nu: parseFloat(editItem.nu)
        });
        break;

      case 'Elements':
        updateElement(setData, editingIndex, {
          tag: parseInt(editItem.tag, 10),
          start: parseInt(editItem.start, 10),
          end: parseInt(editItem.end, 10),
          area: parseFloat(editItem.area),
          material: parseInt(editItem.material, 10)
        });
        break;

      case 'Forces':
        updateForce(setData, editingIndex, {
          node: parseInt(editItem.node, 10),
          xf: parseFloat(editItem.xf),
          yf: parseFloat(editItem.yf)
        });
        break;

      case 'Supports':
        updateSupport(setData, editingIndex, {
          node: parseInt(editItem.node, 10),
          xd: editItem.xd,
          yd: editItem.yd
        });
        break;

      case 'LoadPatterns':
        updateLoadPattern(setData, editingIndex, {
          tag: parseInt(editItem.tag, 10),
          type: editItem.type,
          time_series: { ...editItem.time_series }
        });
        break;

      case 'Metadata':
        // Overwrite the single metadata object
        updateMetadata(setData, 0, {
          title: editItem.title,
          units: editItem.units
        });
        break;

      default:
        break;
    }

    setEditingIndex(null);
    setEditItem({});
  };

  return (
    <div className="container">
      {/* ----------- Tab Buttons ----------- */}
      <div className="tabs">
        {[
          'Nodes',
          'Materials',
          'Elements',
          'Forces',
          'Supports',
          'LoadPatterns',
          'Metadata'
        ].map(tab => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              setEditingIndex(null);
              // If switching to Metadata, preload newMetadata from current data
              if (tab === 'Metadata') {
                setNewMetadata({
                  title: metadata.title ?? '2D Truss Analysis Model',
                  units: metadata.units ?? 'kN-m'
                });
              }
            }}
          >
            {tab === 'LoadPatterns' ? 'Load Patterns' : tab}
          </button>
        ))}
      </div>

      {/* ----------- Tab Content ----------- */}
      <div className="content">
        {/* ======== Nodes Tab ======== */}
        {activeTab === 'Nodes' && (
          <section>
            {renderList('Nodes', nodes, ['tag', 'x', 'y'])}

            {/* Edit Node Form */}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Node</h5>
                <input
                  type="number"
                  placeholder="Tag"
                  value={editItem.tag ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, tag: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="X"
                  value={editItem.x ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, x: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Y"
                  value={editItem.y ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, y: e.target.value })
                  }
                />
                <button className="save-button" onClick={saveEdit}>
                  Save
                </button>
              </div>
            )}

            {/* Add Node Form */}
            <div className="adder">
              <input
                type="number"
                placeholder="Tag"
                value={newNode.tag ?? ''}
                onChange={e =>
                  setNewNode({ ...newNode, tag: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="X"
                value={newNode.x ?? ''}
                onChange={e =>
                  setNewNode({ ...newNode, x: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Y"
                value={newNode.y ?? ''}
                onChange={e =>
                  setNewNode({ ...newNode, y: e.target.value })
                }
              />
              <button className="add-button" onClick={() => addItem('Nodes')}>
                Add Node
              </button>
            </div>
          </section>
        )}

        {/* ======== Materials Tab ======== */}
        {activeTab === 'Materials' && (
          <section>
            {renderList('Materials', materials, ['tag', 'type', 'E', 'nu'])}

            {/* Edit Material Form */}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Material</h5>
                <input
                  type="number"
                  placeholder="Tag"
                  value={editItem.tag ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, tag: e.target.value })
                  }
                />
                <select
                  value={editItem.type ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, type: e.target.value })
                  }
                >
                  <option value="Elastic">Elastic</option>
                  <option value="Plastic">Plastic</option>
                  {/* add other material types if needed */}
                </select>
                <input
                  type="number"
                  placeholder="E (Elasticity)"
                  value={editItem.E ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, E: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="ν (Poisson Ratio)"
                  value={editItem.nu ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, nu: e.target.value })
                  }
                />
                <button className="save-button" onClick={saveEdit}>
                  Save
                </button>
              </div>
            )}

            {/* Add Material Form */}
            <div className="adder">
              <input
                type="number"
                placeholder="Tag"
                value={newMaterial.tag ?? ''}
                onChange={e =>
                  setNewMaterial({ ...newMaterial, tag: e.target.value })
                }
              />
              <select
                value={newMaterial.type ?? ''}
                onChange={e =>
                  setNewMaterial({ ...newMaterial, type: e.target.value })
                }
              >
                <option value="Elastic">Elastic</option>
                <option value="Plastic">Plastic</option>
                {/* add other material types if needed */}
              </select>
              <input
                type="number"
                placeholder="E"
                value={newMaterial.E ?? ''}
                onChange={e =>
                  setNewMaterial({ ...newMaterial, E: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="ν"
                value={newMaterial.nu ?? ''}
                onChange={e =>
                  setNewMaterial({ ...newMaterial, nu: e.target.value })
                }
              />
              <button
                className="add-button"
                onClick={() => addItem('Materials')}
              >
                Add Material
              </button>
            </div>
          </section>
        )}

        {/* ======== Elements Tab ======== */}
        {activeTab === 'Elements' && (
          <section>
            {renderList('Elements', elements, [
              'tag',
              'start',
              'end',
              'area',
              'material'
            ])}

            {/* Edit Element Form */}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Element</h5>
                <input
                  type="number"
                  placeholder="Tag"
                  value={editItem.tag ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, tag: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Start Node"
                  value={editItem.start ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, start: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="End Node"
                  value={editItem.end ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, end: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Area"
                  value={editItem.area ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, area: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Material Tag"
                  value={editItem.material ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, material: e.target.value })
                  }
                />
                <button className="save-button" onClick={saveEdit}>
                  Save
                </button>
              </div>
            )}

            {/* Add Element Form */}
            <div className="adder">
              <input
                type="number"
                placeholder="Tag"
                value={newElement.tag ?? ''}
                onChange={e =>
                  setNewElement({ ...newElement, tag: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Start Node"
                value={newElement.start ?? ''}
                onChange={e =>
                  setNewElement({ ...newElement, start: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="End Node"
                value={newElement.end ?? ''}
                onChange={e =>
                  setNewElement({ ...newElement, end: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Area"
                value={newElement.area ?? ''}
                onChange={e =>
                  setNewElement({ ...newElement, area: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Material Tag"
                value={newElement.material ?? ''}
                onChange={e =>
                  setNewElement({ ...newElement, material: e.target.value })
                }
              />
              <button
                className="add-button"
                onClick={() => addItem('Elements')}
              >
                Add Element
              </button>
            </div>
          </section>
        )}

        {/* ======== Forces Tab ======== */}
        {activeTab === 'Forces' && (
          <section>
            {renderList('Forces', forces, ['node', 'xf', 'yf'])}

            {/* Edit Force Form */}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Force</h5>
                <input
                  type="number"
                  placeholder="Node"
                  value={editItem.node ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, node: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Xf"
                  value={editItem.xf ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, xf: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Yf"
                  value={editItem.yf ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, yf: e.target.value })
                  }
                />
                <button className="save-button" onClick={saveEdit}>
                  Save
                </button>
              </div>
            )}

            {/* Add Force Form */}
            <div className="adder">
              <input
                type="number"
                placeholder="Node"
                value={newForce.node ?? ''}
                onChange={e =>
                  setNewForce({ ...newForce, node: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Xf"
                value={newForce.xf ?? ''}
                onChange={e =>
                  setNewForce({ ...newForce, xf: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Yf"
                value={newForce.yf ?? ''}
                onChange={e =>
                  setNewForce({ ...newForce, yf: e.target.value })
                }
              />
              <button
                className="add-button"
                onClick={() => addItem('Forces')}
              >
                Add Force
              </button>
            </div>
          </section>
        )}

        {/* ======== Supports Tab ======== */}
        {activeTab === 'Supports' && (
          <section>
            {renderList('Supports', supports, ['node', 'xd', 'yd'])}

            {/* Edit Support Form */}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Support</h5>
                <input
                  type="number"
                  placeholder="Node"
                  value={editItem.node ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, node: e.target.value })
                  }
                />
                <select
                  value={editItem.xd ?? 0}
                  onChange={e =>
                    setEditItem({ ...editItem, xd: parseInt(e.target.value, 10) })
                  }
                >
                  <option value={0}>Free</option>
                  <option value={1}>Fixed</option>
                </select>
                <select
                  value={editItem.yd ?? 0}
                  onChange={e =>
                    setEditItem({ ...editItem, yd: parseInt(e.target.value, 10) })
                  }
                >
                  <option value={0}>Free</option>
                  <option value={1}>Fixed</option>
                </select>
                <button className="save-button" onClick={saveEdit}>
                  Save
                </button>
              </div>
            )}

            {/* Add Support Form */}
            <div className="adder">
              <input
                type="number"
                placeholder="Node"
                value={newSupport.node ?? ''}
                onChange={e =>
                  setNewSupport({ ...newSupport, node: e.target.value })
                }
              />
              <select
                value={newSupport.xd ?? 0}
                onChange={e =>
                  setNewSupport({
                    ...newSupport,
                    xd: parseInt(e.target.value, 10)
                  })
                }
              >
                <option value={0}>Free</option>
                <option value={1}>Fixed</option>
              </select>
              <select
                value={newSupport.yd ?? 0}
                onChange={e =>
                  setNewSupport({
                    ...newSupport,
                    yd: parseInt(e.target.value, 10)
                  })
                }
              >
                <option value={0}>Free</option>
                <option value={1}>Fixed</option>
              </select>
              <button
                className="add-button"
                onClick={() => addItem('Supports')}
              >
                Add Support
              </button>
            </div>
          </section>
        )}

        {/* ======== Load Patterns Tab ======== */}
        {activeTab === 'LoadPatterns' && (
          <section>
            {renderList('LoadPatterns', load_patterns, [
              'tag',
              'type',
              'time_series'
            ])}

            {/* Edit Load Pattern Form */}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Load Pattern</h5>
                <input
                  type="number"
                  placeholder="Tag"
                  value={editItem.tag ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, tag: e.target.value })
                  }
                />
                <select
                  value={editItem.type ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, type: e.target.value })
                  }
                >
                  <option value="static">static</option>
                  <option value="dynamic">dynamic</option>
                  {/* add other load pattern types if needed */}
                </select>

                {/* time_series: an object; for simplicity, allow editing type & tag */}
                <div className="time-series-editor">
                  <h6>Time Series</h6>
                  <select
                    value={editItem.time_series?.type ?? ''}
                    onChange={e =>
                      setEditItem({
                        ...editItem,
                        time_series: {
                          ...editItem.time_series,
                          type: e.target.value
                        }
                      })
                    }
                  >
                    <option value="Constant">Constant</option>
                    <option value="Linear">Linear</option>
                    <option value="Sinusoidal">Sinusoidal</option>
                    {/* add other time-series types if needed */}
                  </select>
                  <input
                    type="number"
                    placeholder="TS Tag"
                    value={editItem.time_series?.tag ?? ''}
                    onChange={e =>
                      setEditItem({
                        ...editItem,
                        time_series: {
                          ...editItem.time_series,
                          tag: parseInt(e.target.value, 10)
                        }
                      })
                    }
                  />
                </div>

                <button className="save-button" onClick={saveEdit}>
                  Save
                </button>
              </div>
            )}

            {/* Add Load Pattern Form */}
            <div className="adder">
              <input
                type="number"
                placeholder="Tag"
                value={newLoadPattern.tag ?? ''}
                onChange={e =>
                  setNewLoadPattern({
                    ...newLoadPattern,
                    tag: e.target.value
                  })
                }
              />
              <select
                value={newLoadPattern.type ?? ''}
                onChange={e =>
                  setNewLoadPattern({
                    ...newLoadPattern,
                    type: e.target.value
                  })
                }
              >
                <option value="static">static</option>
                <option value="dynamic">dynamic</option>
                {/* add other load pattern types if needed */}
              </select>

              {/* Time series inputs */}
              <div className="time-series-adder">
                <h6>Time Series</h6>
                <select
                  value={newLoadPattern.time_series?.type ?? ''}
                  onChange={e =>
                    setNewLoadPattern({
                      ...newLoadPattern,
                      time_series: {
                        ...newLoadPattern.time_series,
                        type: e.target.value
                      }
                    })
                  }
                >
                  <option value="Constant">Constant</option>
                  <option value="Linear">Linear</option>
                  <option value="Sinusoidal">Sinusoidal</option>
                  {/* add other time-series types if needed */}
                </select>
                <input
                  type="number"
                  placeholder="TS Tag"
                  value={newLoadPattern.time_series?.tag ?? ''}
                  onChange={e =>
                    setNewLoadPattern({
                      ...newLoadPattern,
                      time_series: {
                        ...newLoadPattern.time_series,
                        tag: parseInt(e.target.value, 10)
                      }
                    })
                  }
                />
              </div>

              <button
                className="add-button"
                onClick={() => addItem('LoadPatterns')}
              >
                Add Load Pattern
              </button>
            </div>
          </section>
        )}

        {/* ======== Metadata Tab ======== */}
        {activeTab === 'Metadata' && (
          <section>
            {/* Show existing metadata */}
            <div className="item-list">
              <li className="item">
                <span>
                  TITLE: {metadata.title ?? '(not set)'}, UNITS:{' '}
                  {metadata.units ?? '(not set)'}
                </span>
                <button className="edit-button" onClick={() => startEdit('Metadata', 0)}>
                  Edit
                </button>
              </li>
            </div>

            {/* Edit Metadata Form */}
            {editingIndex !== null && (
              <div className="editor">
                <h5>Edit Metadata</h5>
                <input
                  type="text"
                  placeholder="Title"
                  value={editItem.title ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, title: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Units"
                  value={editItem.units ?? ''}
                  onChange={e =>
                    setEditItem({ ...editItem, units: e.target.value })
                  }
                />
                <button className="save-button" onClick={saveEdit}>
                  Save
                </button>
              </div>
            )}

            {/* Add Metadata Form (if none exists yet) */}
            {!metadata.title && !metadata.units && (
              <div className="adder">
                <input
                  type="text"
                  placeholder="Title"
                  value={newMetadata.title ?? ''}
                  onChange={e =>
                    setNewMetadata({ ...newMetadata, title: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Units"
                  value={newMetadata.units ?? ''}
                  onChange={e =>
                    setNewMetadata({ ...newMetadata, units: e.target.value })
                  }
                />
                <button
                  className="add-button"
                  onClick={() => addItem('Metadata')}
                >
                  Add Metadata
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default NodeAndElements;
