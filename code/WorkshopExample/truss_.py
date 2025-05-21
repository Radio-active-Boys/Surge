
"""# 📦 Import packages"""

import openseespy.opensees as ops              # Import OpenSeesPy and alias it as 'ops'
import opsvis as opsv                          # Import opsvis for visualization
import matplotlib.pyplot as plt                # Import matplotlib for plotting

"""# 🧹 Clear existing model"""

ops.wipe()                            # Clear existing model to ensure a clean start

"""# Input Data"""

L = 250.0                        # Length parameter (mm)
L2 = 500.0                       # Length parameter (mm)

E = 2.1e5                        # Young's modulus (N/mm^2)

A = 2000.0                       # Cross-sectional area (mm^2)

F = 5000.0
F2 = 10000.0

"""# 🔷 Node definitions"""

nodes = {
    1: [0.0, 0.0],
    2: [0.0, L2],
    3: [L2, L2],
    4: [2*L2, L2],
    5: [2*L2, 0.0],
    6: [3*L, 0.0],
    7: [2*L, 0.0],
    8: [L, 0.0],
    9: [L, L],
    10: [3*L, L]
}

"""# 🏠 Create ModelBuilder (2D, 2 DOF per node)"""

ops.model('basic', '-ndm', 2, '-ndf', 2)

"""# Create nodes"""

for node, coords in nodes.items():
    ops.node(node, *coords)

"""# Boundary conditions"""

ops.fix(1, 1, 1)
ops.fix(2, 0, 0)
ops.fix(3, 0, 0)
ops.fix(4, 0, 0)
ops.fix(5, 0, 1)
ops.fix(6, 0, 0)
ops.fix(7, 0, 0)
ops.fix(8, 0, 0)
ops.fix(9, 0, 0)
ops.fix(10, 0, 0)

"""# Materials"""

ops.uniaxialMaterial('Elastic', 1, E)

"""# Elements"""

elements = [
    (1, 1, 2), (2, 2, 3), (3, 3, 4), (4, 4, 5), (5, 1, 8),
    (6, 8, 7), (7, 7, 6), (8, 6, 5), (9, 1, 9), (10, 8, 9),
    (11, 7, 9), (12, 7, 3), (13, 7, 10), (14, 6, 10), (15, 5, 10),
    (16, 9, 3), (17, 10, 3)
]

for ele_id, n1, n2 in elements:
    ops.element('Truss', ele_id, n1, n2, A, 1)

"""# Time series

"""

ops.timeSeries('Linear', 1)

"""# ⬇⬇⬇ Loads"""

ops.pattern('Plain', 1, 1)

ops.load(2, F, 0.0)
ops.load(3, 0.0, -F2)
ops.load(4, 0.0, -F)
#ops.load(5, 0.0, -F)
ops.load(6, 0.0, -F)
ops.load(8, 0.0, -F)

# RECORDER
# ------------------------------
# Create a recorder for displacements of free DOFs:
#ops.recorder('Node', '-file', DataDir+"/Dfree.out",'-time', '-closeOnWrite', '-node', 2, '-dof',1,2,3, 'disp')
# Create a recorder for reaction forces:
#ops.recorder('Node', '-file', DataDir+"/RBase.out",'-time', '-closeOnWrite', '-node', 1, '-dof',1,2,3, 'reaction')
# Create a recorder for element forces:
#ops.recorder('Element', '-file', DataDir+"/eleGlobal.out",'-time', '-closeOnWrite', '-ele', 1, 'forces')

"""# Analysis configuration"""

ops.constraints('Plain')
ops.numberer('Plain')
ops.system('BandSPD')
ops.test('NormUnbalance', 1e-6, 1000)
ops.algorithm('Linear')
ops.integrator('LoadControl', 1.0)
ops.analysis('Static')

"""# Perform analysis"""

ops.analyze(1)

"""# Visualize output"""

print("Node displacements at node 7:", ops.nodeDisp(7))

opsv.plot_model()
opsv.plot_load()
opsv.section_force_diagram_2d('N', 10**-2.5)
plt.title('Axial force distribution')

"""# Print nodes and elements details"""

ops.printModel('node')
ops.printModel('ele')