
"""# 📦 Import packages :"""

import openseespy.opensees as ops   # Import the OpenSeesPy library and alias it as 'ops' for easier use
import opsvis as opsv               # Import the opsvis library for visualization, aliased as 'opsv'
import matplotlib.pyplot as plt     # Import matplotlib.pyplot for plotting results, aliased as 'plt'

"""# 🧹 Clear existing model :"""

ops.wipe()                          # Clear existing model to start fresh.  This is crucial for repeated runs or script modifications.

"""# Input Data
![Picture1.png](data:image/png;base64,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)
"""

L = 2000                           # Length parameter
E = 2.1e5                          # Young's modulus
A = 5624                           # Cross-sectional area
I = 61200000                       # Moment of inertia

"""# 🔷 Node definitions"""

nodes_positions = {
    1: [0.0, 0.0],                    #NODE A
    3: [0.0, L],                      #NODE B
    4: [L, L],                        #NODE C
    5: [L, L],                        #NODE C
    6: [1.5*L, L],                    #NODE D
    7: [2*L, L],                      #NODE E
    8: [2*L, 0.0]                     #NODE F
}                               # Each node needs to be defined with a unique ID and its coordinates.

"""# 🏠 Create ModelBuilder (2D, 2 DOF per node)"""

ops.model('basic', '-ndm', 2, '-ndf', 3)      # '-ndm', 2:  2-dimensional model (x and y coordinates).'-ndf', 3:  3 degrees of freedom per node (translation in x, translation in y, rotation about z).

"""# Create nodes"""

for node, pos in nodes_positions.items():
    ops.node(node, *pos)                      # Create each node using the node ID and its position.

"""# Boundary conditions"""

ops.fix(1, 1, 1, 0)                           # Node 1 is fixed in x and y directions (pinned support). Rotation is free.
#ops.fix(2, 0, 0, 0)
ops.fix(3, 0, 0, 0)
ops.fix(4, 0, 0, 0)
ops.fix(5, 0, 0, 0)
ops.fix(6, 0, 0, 0)
ops.fix(7, 0, 0, 0)
ops.fix(8, 1, 1, 0)                           # Node 8 is fixed in x and y directions (pinned support). Rotation is free.

"""# Define geometric transformation"""

ops.geomTransf('Linear', 1)                   # Create a linear geometric transformation with ID 1.

"""# Elements"""

# ops.element('elasticBeamColumn', ele_id, node_i, node_j, A, E, I, transf_id)
# ele_id:  Unique ID for the element.
# node_i, node_j:  Node IDs at the element ends.
# A, E, I:  Cross-sectional area, Young's modulus, and moment of inertia.
# transf_id:  ID of the geometric transformation.

#ops.element('elasticBeamColumn', 1, 1, 2, A, E, I, 1)
#ops.element('elasticBeamColumn', 2, 2, 3, A, E, I, 1)
ops.element('elasticBeamColumn', 1, 1, 3, A, E, I, 1)
ops.element('elasticBeamColumn', 3, 3, 4, A, E, I, 1)
ops.element('elasticBeamColumn', 4, 5, 6, A, E, I, 1)
ops.element('elasticBeamColumn', 5, 6, 7, A, E, I, 1)
ops.element('elasticBeamColumn', 6, 7, 8, A, E, I, 1)

"""# Hinge connection between node 4 and 5"""

ops.equalDOF(4, 5, 1, 2)                         # equalDOF command constrains x and y translation to be equal between nodes 4 and 5

"""# Time series"""

ops.timeSeries('Linear', 1)                     # Create a linear time series with ID 1.

"""# ⬇⬇⬇ Loads"""

ops.pattern('Plain', 1, 1)                       # Create a plain load pattern with ID 1, using time series 1.

# ops.load(node_id, Fx, Fy, Mz)
# node_id:  Node ID where the load is applied.
# Fx, Fy:  Forces in the x and y directions.
# Mz:  Moment about the z-axis.
#ops.load(2, 2000, 0, 0)                         # Apply a horizontal force of 2000 at node 2.
ops.eleLoad('-ele', 1,'-type', 'beamUniform', -20., 0., 0., 1, 0.01, 0.)
ops.load(6, 0, -20000, 0)                       # Apply a vertical force of -20000 (downward) at node 6.

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

node_disp = ops.nodeDisp(3)
print(f"Node B displacement: {node_disp}")                  # Get the displacement of node 3.

opsv.plot_model()

opsv.plot_load()

opsv.section_force_diagram_2d('N', 10**-1.5)
plt.title('Axial force distribution')

opsv.section_force_diagram_2d('T', 10**-1.5)
plt.title('Shear force distribution')

opsv.section_force_diagram_2d('M', 10**-4)
plt.title('Bending moment distribution')

"""# Print nodes and elements details"""

ops.printModel()