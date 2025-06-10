# Auto-generated OpenSeesPy model script
# Title: 3-Bar Truss Example
# Units: kip-inch
from openseespy.opensees import *
import numpy as np
import pandas as pd

wipe()
model('basic', '-ndm', 2, '-ndf', 2)

# --- Create Nodes ---
node(1, 0.0, 0.0)
node(2, 144.0, 0.0)
node(3, 168.0, 0.0)
node(4, 72.0, 96.0)

# --- Define Materials ---
uniaxialMaterial('Elastic', 1, 3000)

# --- Create Elements ---
element('Truss', 1, 1, 4, 10, 1)
element('Truss', 2, 2, 4, 5, 1)
element('Truss', 3, 3, 4, 5, 1)

# --- Apply Supports (BCs) ---
fix(1, 1, 1)
fix(2, 1, 1)
fix(3, 1, 1)

# --- Define Load Patterns & Nodal Loads ---
timeSeries('Linear', 1)
pattern('Plain', 1, 1)
load(4, 100.0, -50.0)

# --- Analysis Settings ---
constraints('Plain')
system('BandSPD')
numberer('RCM')
integrator('LoadControl', 1)
algorithm('Linear')
analysis('Static')

# --- Run Analysis ---
ok = analyze(1)
if ok != 0:
    print('WARNING: Analysis did not converge or failed')

# --- Retrieve Displacements & Reactions ---
disp = {}
disp[1] = nodeDisp(1)
disp[2] = nodeDisp(2)
disp[3] = nodeDisp(3)
disp[4] = nodeDisp(4)

react = {}
react[1] = nodeReaction(1)
react[2] = nodeReaction(2)
react[3] = nodeReaction(3)
react[4] = nodeReaction(4)

# --- Print NODAL DISPLACEMENTS ---
print('=== NODAL DISPLACEMENTS ===')
for nid, d in disp.items():
    print(f'Node {nid}: ux = {d[0]:.6f}, uy = {d[1]:.6f}')

# --- Print NODAL REACTIONS ---
print('=== NODAL REACTIONS ===')
for nid, r in react.items():
    print(f'Node {nid}: rx = {r[0]:.6f}, ry = {r[1]:.6f}')

# --- Compute MEMBER FORCES & Classify Tension/Compression ---
element_data = [(1, 1, 4), (2, 2, 4), (3, 3, 4)]   # list of (etag, node_i, node_j)
forces = []
for etag, ni, nj in element_data:
    # basicForce(etag) returns a Python list; index 0 is the axial force
    f_axial = basicForce(etag)[0]
    state = 'Tension' if f_axial > 0 else 'Compression'
    forces.append([etag, ni, nj, f_axial, state])

df_forces = pd.DataFrame(forces, columns=['element', 'node_i', 'node_j', 'axial_force', 'state'])
print('=== MEMBER FORCES ===')
print(df_forces.to_string(index=False))

# End of auto-generated OpenSeesPy script
