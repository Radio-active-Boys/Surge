#%% Import opensees and others
import openseespy.opensees as ops
import opsvis as opsv
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd

#%% Define material and section properties
P = -46000.0  # Axial force
Mz = 55624    # Moment about z-axis
My = 14923    # Moment about y-axis
B = 3.0
D = 3.5
db = 0.100
pi = 3.141592653589793
Ab = pi * db**2 / 4

# Number of subdivisions (fibers)
Ny = 50  # y-direction
Nz = 50  # z-direction

# Number of bolts
Nbz = 10  # z-direction
Nby = 7   # y-direction
Nb = 2 * (Nbz + Nby)

ed = 0.2  # Edge distance

fy = 1000000.0  # High value to prevent yielding
Es = 2e+11      # Steel modulus (N/m²)
fck = 50.0       # Concrete strength
Ec = 5000 * np.sqrt(fck) * 1e+6  # Concrete modulus (N/m²)

ConcMatTag = 1
SteelMatTag = 2

#%% Wipe and create model
ops.wipe()
ops.model('basic', '-ndm', 3, '-ndf', 6)
ops.node(1, 0.0, 0.0, 0.0)
ops.node(2, 0.0, 0.0, 0.0)
ops.fix(1, 1, 1, 1, 1, 1, 1)
ops.fix(2, 0, 1, 1, 1, 0, 0)

# Define materials
ops.uniaxialMaterial('ENT', ConcMatTag, Ec)
ops.uniaxialMaterial('ElasticPPGap', SteelMatTag, Es, fy, 0.0, 0.0)

#%% Define fiber section
y1 = D / 2.0
z1 = B / 2.0
dy = (D - 2 * ed) / (Nby + 1)
y2 = y1 - ed - dy
secTag = 1

fib_sec_CFST = [
    ['section', 'Fiber', secTag, '-GJ', 1.0e6],
    ['patch', 'rect', ConcMatTag, Ny, Nz, -y1, -z1, y1, z1],
    ['layer', 'straight', SteelMatTag, Nbz, Ab, y1 - ed, z1 - ed, y1 - ed, ed - z1],
    ['layer', 'straight', SteelMatTag, Nby, Ab, y2, ed - z1, -y2, ed - z1],
    ['layer', 'straight', SteelMatTag, Nbz, Ab, ed - y1, ed - z1, ed - y1, z1 - ed],
    ['layer', 'straight', SteelMatTag, Nby, Ab, -y2, z1 - ed, y2, z1 - ed]
]

# Create section
opsv.fib_sec_list_to_cmds(fib_sec_CFST)

# Visualize section
matcolor = ['gold', 'lightgrey', 'gold', 'm', 'r', 'w', 'w']
opsv.plot_fiber_section(fib_sec_CFST, matcolor=matcolor)
plt.axis('equal')
plt.title('Fiber Section')
plt.savefig('fiber_section.png')

#%% Define element
ops.element('zeroLengthSection', 1, 1, 2, secTag)

#%% Get fiber coordinates
# Steel fiber coordinates
def get_straight_layer_coords(n_fibers, yI, zI, yJ, zJ):
    ys = np.linspace(yI, yJ, n_fibers)
    zs = np.linspace(zI, zJ, n_fibers)
    return list(zip(ys, zs))

steel_fiber_coords = []
steel_fiber_coords += get_straight_layer_coords(Nbz, y1 - ed, z1 - ed, y1 - ed, ed - z1)
steel_fiber_coords += get_straight_layer_coords(Nby, y2, ed - z1, -y2, ed - z1)
steel_fiber_coords += get_straight_layer_coords(Nbz, ed - y1, ed - z1, ed - y1, z1 - ed)
steel_fiber_coords += get_straight_layer_coords(Nby, -y2, z1 - ed, y2, z1 - ed)

# Concrete fiber grid
dy_fiber = 2 * y1 / Ny
dz_fiber = 2 * z1 / Nz
concrete_fiber_coords = []
for i in range(Ny):
    for j in range(Nz):
        y_center = -y1 + (i + 0.5) * dy_fiber
        z_center = -z1 + (j + 0.5) * dz_fiber
        concrete_fiber_coords.append((y_center, z_center))

#%% Apply loads and perform analysis
ops.timeSeries('Constant', 1)
ops.pattern('Plain', 1, 1)
ops.load(2, P, 0.0, 0.0, 0.0, My, Mz)

ops.integrator('LoadControl', 0.0)
ops.system('SparseGeneral', '-piv')
ops.test('NormUnbalance', 1e-9, 10)
ops.numberer('Plain')
ops.constraints('Plain')
ops.algorithm('Newton')
ops.analysis('Static')
ops.analyze(1)

#%% Get fiber responses without recorders
# Steel fibers
bolt_data = []
for i, (y, z) in enumerate(steel_fiber_coords, 1):
    stress_strain = ops.eleResponse(1, 'section', 'fiber', y, z, SteelMatTag, 'stressStrain')
    stress = stress_strain[0]
    strain = stress_strain[1]
    force = stress * Ab
    bolt_data.append([y, z, force, stress, strain])

# Concrete corner fibers
corner_coords = [
    (y1, z1),    # top-right
    (y1, -z1),   # bottom-right
    (-y1, -z1),  # bottom-left
    (-y1, z1)    # top-left
]

corner_data = []
for coord in corner_coords:
    y, z = coord
    stress_strain = ops.eleResponse(1, 'section', 'fiber', y, z, ConcMatTag, 'stressStrain')
    stress = stress_strain[0]
    strain = stress_strain[1]
    corner_data.append([y, z, stress, strain])

# Concrete grid fibers
concrete_data = []
for y, z in concrete_fiber_coords:
    stress_strain = ops.eleResponse(1, 'section', 'fiber', y, z, ConcMatTag, 'stressStrain')
    stress = stress_strain[0]
    strain = stress_strain[1]
    concrete_data.append([y, z, stress, strain])

#%% Save results to DataFrames
df_bolts = pd.DataFrame(bolt_data, columns=['y (m)', 'z (m)', 'Force', 'Stress', 'Strain'])
df_bolts.to_excel('Bolt_Forces.xlsx', index=False)

df_concrete_corners = pd.DataFrame(corner_data, columns=['y (m)', 'z (m)', 'Stress', 'Strain'])
df_concrete_corners.to_excel('Concrete_Corners.xlsx', index=False)

df_concrete = pd.DataFrame(concrete_data, columns=['y (m)', 'z (m)', 'Stress', 'Strain'])
df_concrete.to_excel('Concrete_Fiber_Results.xlsx', index=False)

#%% Visualization
# Bolt stress distribution
plt.figure(figsize=(10, 7))
scatter = plt.scatter(
    df_bolts['z (m)'], 
    df_bolts['y (m)'], 
    c=df_bolts['Stress'], 
    cmap='viridis', 
    s=100, 
    edgecolor='k'
)
plt.colorbar(scatter, label='Stress (Pa)')
plt.xlabel('z (m)')
plt.ylabel('y (m)')
plt.title('Bolt Stress Distribution')
plt.axis('equal')
plt.grid(True, linestyle='--', alpha=0.7)
plt.tight_layout()
plt.savefig('bolt_stress_distribution.png')

# Concrete stress contour
stress_grid = df_concrete['Stress'].values.reshape((Ny, Nz))
y_grid = np.array([coord[0] for coord in concrete_fiber_coords]).reshape((Ny, Nz))
z_grid = np.array([coord[1] for coord in concrete_fiber_coords]).reshape((Ny, Nz))

plt.figure(figsize=(10, 7))
contour = plt.contourf(z_grid, y_grid, stress_grid, 50, cmap='viridis')
plt.colorbar(contour, label='Stress (Pa)')
plt.xlabel('z (m)')
plt.ylabel('y (m)')
plt.title('Concrete Stress Distribution')
plt.axis('equal')
plt.grid(True, linestyle='--', alpha=0.7)
plt.tight_layout()
plt.savefig('concrete_stress_contour.png')

# # 3D Visualization
# fig = plt.figure(figsize=(14, 10))
# ax = fig.add_subplot(111, projection='3d')
# ax.plot_surface(z_grid, y_grid, stress_grid, cmap='coolwarm', edgecolor='k', alpha=0.8)

# # Add bolt stresses
# ax.scatter3D(
#     df_bolts['z (m)'], 
#     df_bolts['y (m)'], 
#     df_bolts['Stress'], 
#     c='red', 
#     s=100, 
#     depthshade=True
# )

# ax.set_xlabel('Z (m)')
# ax.set_ylabel('Y (m)')
# ax.set_zlabel('Stress (Pa)')
# ax.set_title('Stress Distribution: Concrete (Surface) & Bolts (Points)')
# plt.tight_layout()
# plt.savefig('3d_stress_distribution.png')
plt.show()

#%% Clean up
ops.wipe()