# Auto-generated OpenSeesPy model script
# Title: 5-Member Square Truss
# Units: kN-m
from openseespy.opensees import *

wipe()
model('basic', '-ndm', 2, '-ndf', 2)

# --- Create Nodes ---
node(1, 0.0, 0.0)
node(2, 4.0, 0.0)
node(3, 4.0, 3.0)
node(4, 0.0, 3.0)

# --- Define Materials ---
uniaxialMaterial('Elastic', 1, 210000)

# --- Create Elements ---
element('Truss', 1, 1, 2, 0.01, 1)
element('Truss', 2, 2, 3, 0.01, 1)
element('Truss', 3, 3, 4, 0.01, 1)
element('Truss', 4, 4, 1, 0.01, 1)
element('Truss', 5, 1, 3, 0.008, 1)

# --- Apply Supports (BCs) ---
fix(1, 1, 1)
fix(2, 0, 1)

# --- Define Load Patterns & Nodal Loads ---
timeSeries('Constant', 1)
pattern('Plain', 1, 1)
load(3, 0.0, -60.0)
load(4, 20.0, 0.0)

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

# --- Print Results ---
print('=== NODAL DISPLACEMENTS ===')
for nid, d in disp.items():
    print(f'Node {nid}: ux = {d[0]:.6f}, uy = {d[1]:.6f}')

print('=== NODAL REACTIONS ===')
for nid, r in react.items():
    print(f'Node {nid}: rx = {r[0]:.6f}, ry = {r[1]:.6f}')

# End of auto-generated OpenSeesPy script
