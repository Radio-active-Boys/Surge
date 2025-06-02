# Auto-generated OpenSeesPy model script
# Title: Untitled Model
from openseespy.opensees import *

wipe()
model('basic', '-ndm', 2, '-ndf', 2)

# --- Create Nodes ---

# --- Define Materials ---

# --- Create Elements ---

# --- Apply Supports (BCs) ---

# --- Define Load Patterns & Nodal Loads ---

# --- Analysis Settings ---
constraints('Plain')
system('BandSPD')
numberer('RCM')
integrator('LoadControl', 1.0)
algorithm('Linear')
analysis('Static')

# --- Run Analysis ---
ok = analyze(1)
if ok != 0:
    print('WARNING: Analysis did not converge or failed')

# --- Retrieve Displacements & Reactions ---
disp = {}

react = {}

# --- Print Results ---
print('=== NODAL DISPLACEMENTS ===')
for nid, d in disp.items():
    print(f'Node {nid}: ux = {d[0]:.6f}, uy = {d[1]:.6f}')

print('=== NODAL REACTIONS ===')
for nid, r in react.items():
    print(f'Node {nid}: rx = {r[0]:.6f}, ry = {r[1]:.6f}')

# End of auto-generated OpenSeesPy script
