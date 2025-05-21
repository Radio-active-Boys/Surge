
"""# 📦 Import packages :"""

import openseespy.opensees as ops   # Import the OpenSeesPy library and alias it as 'ops' for easier use
import opsvis as opsv               # Import the opsvis library for visualization, aliased as 'opsv'
import matplotlib.pyplot as plt     # Import matplotlib.pyplot for plotting results, aliased as 'plt'

"""# 🧹 Clear existing model :"""

ops.wipe()                          # Clear existing model to start fresh.  This is crucial for repeated runs or script modifications.

"""# Input Data"""

L = 6000.0
L2 = 9000.0
B = 500.0
H = 1000.0
E = 30000.0
A1 = B * B
A2 = B * H
I1 = 1/12 * B**4
I2 = 1/12 * B * H**3

"""# 🔷 Node definitions"""

nodes_positions = {
    1: [0.0, 0.0],
     2: [0.0, L],
    3: [L2, L],
    4: [2*L2, L],
    5: [2*L2, 0.0],
    }# Each node needs to be defined with a unique ID and its coordinates.

"""# 🏠 Create ModelBuilder (2D, 2 DOF per node)"""

ops.model('basic', '-ndm', 2, '-ndf', 3)

"""# Create nodes"""

for node, pos in nodes_positions.items():
    ops.node(node, *pos)                      # Create each node using the node ID and its position.

"""# Boundary conditions"""

ops.fix(1, 1, 1, 1)                          # Node 1 is fixed in x and y directions and rotation.
ops.fix(2, 0, 0, 0)
ops.fix(3, 0, 0, 0)
ops.fix(4, 0, 0, 0)
ops.fix(5, 1, 1, 1)                          # Node 5 is fixed in x and y directions and rotation.

"""# Define geometric transformation"""

ops.geomTransf('Linear', 1)                   # Create a linear geometric transformation with ID 1.

"""# Elements"""

# ops.element('elasticBeamColumn', ele_id, node_i, node_j, A, E, I, transf_id)
# ele_id:  Unique ID for the element.
# node_i, node_j:  Node IDs at the element ends.
# A, E, I:  Cross-sectional area, Young's modulus, and moment of inertia.
# transf_id:  ID of the geometric transformation.

ops.element('elasticBeamColumn', 1, 1, 2, A1, E, I1, 1)
ops.element('elasticBeamColumn', 2, 2, 3, A2, E, I2, 1)
ops.element('elasticBeamColumn', 3, 3, 4, A2, E, I2, 1)
ops.element('elasticBeamColumn', 4, 4, 5, A1, E, I1, 1)

"""# Time series"""

ops.timeSeries('Linear', 1)                     # Create a linear time series with ID 1.

"""# ⬇⬇⬇ Loads"""

ops.pattern('Plain', 1, 1)                       # Create a plain load pattern with ID 1, using time series 1.

# ops.load(node_id, Fx, Fy, Mz)
# node_id:  Node ID where the load is applied.
# Fx, Fy:  Forces in the x and y directions.
# Mz:  Moment about the z-axis.

ops.eleLoad('-ele', 2, 3, '-type', '-beamUniform', -3.0)

"""# Analysis configuration"""

ops.constraints('Plain')
ops.numberer('Plain')
ops.system('BandSPD')
ops.algorithm('Linear')
ops.integrator('LoadControl', 1.0)
ops.analysis('Static')

"""# Perform analysis"""

ops.analyze(1)

"""# Visualize output"""

displacement = ops.nodeDisp(3)
print(f"Displacement at the midspan: {displacement}")                # Get the displacement of node 3.

opsv.plot_model()

opsv.plot_load(sfac=10**-2)

opsv.section_force_diagram_2d('N', 10**-1.2)
plt.title('Axial force distribution')

opsv.section_force_diagram_2d('T', 10**-1.2)
plt.title('Shear force distribution')

opsv.section_force_diagram_2d('M', 10**-5)
plt.title('Bending moment distribution')

"""# Print nodes and elements details"""

ops.printModel('node')
ops.printModel('ele')