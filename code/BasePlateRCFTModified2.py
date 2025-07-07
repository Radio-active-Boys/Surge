# -*- coding: utf-8 -*-
"""
Created on Thu May 21 13:37:00 2025

@author: CKolay
"""
#%% Import opensees and others
import openseespy.opensees as ops
import opsvis as opsv
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import os

#%% Define material and section properties
P = -46000.0  # Axial force (compression)
Mz = 55624    # Moment about z-axis
My = 14923    # Moment about y-axis
B = 3.0       # Width (z-direction)
D = 3.5       # Depth (y-direction)
db = 0.100    # Bolt diameter
pi = 3.141592653589793
Ab = pi * db**2 / 4  # Bolt area

# Reduce fiber count to avoid file system limits
Ny = 50  # y-direction (reduced from 50)
Nz = 50  # z-direction (reduced from 50)

# Number of bolts
Nbz = 10  # along z-direction
Nby = 7   # along y-direction
Nb = 2 * (Nbz + Nby)

ed = 0.2  # Edge distance

# Material properties
fy = 1000000.0  # High value to prevent yielding
Es = 200.0e6     # Steel modulus
fck = 50.0       # Concrete strength
Ec = 5000 * np.sqrt(fck) * 1e3  # Concrete modulus

ConcMatTag = 1
SteelMatTag = 2

#%% Wipe and create model
ops.wipe()
ops.model('basic', '-ndm', 3, '-ndf', 6)

# Define nodes
ops.node(1, 0.0, 0.0, 0.0)
ops.node(2, 0.0, 0.0, 0.0)

# Boundary conditions
ops.fix(1, 1, 1, 1, 1, 1, 1)  # Fixed all DOFs
ops.fix(2, 0, 1, 1, 1, 0, 0)  # Free: axial, rotation y, rotation z

# Materials - CORRECTED
ops.uniaxialMaterial('ENT', ConcMatTag, Ec)  # Compression-only concrete

# Tension-only bolts - FIXED MATERIAL
ops.uniaxialMaterial('Elastic', 10, Es)  # Backbone material
ops.uniaxialMaterial('MinMax', SteelMatTag, 10, '-min', 0.0, '-max', 1e20)

# Section geometry
y1 = D / 2.0
z1 = B / 2.0
dy = (D - 2 * ed) / (Nby + 1)
y2 = y1 - ed - dy
secTag = 1

# Create fiber section
fib_sec_CFST = [
    ['section', 'Fiber', secTag, '-GJ', 1.0e6],
    ['patch', 'rect', ConcMatTag, Ny, Nz, -y1, -z1, y1, z1],  # Concrete
    ['layer', 'straight', SteelMatTag, Nbz, Ab, y1-ed, z1-ed, y1-ed, ed-z1],  # Top
    ['layer', 'straight', SteelMatTag, Nby, Ab, y2, ed-z1, -y2, ed-z1],      # Right
    ['layer', 'straight', SteelMatTag, Nbz, Ab, ed-y1, ed-z1, ed-y1, z1-ed], # Bottom
    ['layer', 'straight', SteelMatTag, Nby, Ab, -y2, z1-ed, y2, z1-ed]       # Left
]

# Visualize section
matcolor = ['gold', 'lightgrey', 'gold', 'm', 'r', 'w', 'w']
opsv.plot_fiber_section(fib_sec_CFST, matcolor=matcolor)
plt.axis('equal')
plt.title('Fiber Section')
plt.savefig('fiber_section.png')
plt.close()

# Create section commands
opsv.fib_sec_list_to_cmds(fib_sec_CFST)

# Define element
ops.element('zeroLengthSection', 1, 1, 2, secTag)

#%% Define bolt coordinates and create recorders
def get_straight_layer_coords(n_fibers, yI, zI, yJ, zJ):
    ys = np.linspace(yI, yJ, n_fibers)
    zs = np.linspace(zI, zJ, n_fibers)
    return list(zip(ys, zs))

# Define all steel fiber layers
steel_fiber_coords = []
# Top bolt column
steel_fiber_coords += get_straight_layer_coords(Nbz, y1-ed, z1-ed, y1-ed, ed-z1)
# Right bolt column
steel_fiber_coords += get_straight_layer_coords(Nby, y2, ed-z1, -y2, ed-z1)
# Bottom bolt column
steel_fiber_coords += get_straight_layer_coords(Nbz, ed-y1, ed-z1, ed-y1, z1-ed)
# Left bolt column
steel_fiber_coords += get_straight_layer_coords(Nby, -y2, z1-ed, y2, z1-ed)

# Create recorders for bolts
for i, (y, z) in enumerate(steel_fiber_coords, 1):
    ops.recorder('Element', '-file', f'fiber_{i}.txt', 
                '-ele', 1, 'section', 'fiber', y, z, SteelMatTag, 'stressStrain')

# Create recorders for concrete fibers
dy_fiber = 2 * y1 / Ny
dz_fiber = 2 * z1 / Nz
concrete_fiber_coords = []

# Create directory for concrete files
os.makedirs('concrete_fibers', exist_ok=True)

for i in range(Ny):
    for j in range(Nz):
        y_center = -y1 + (i + 0.5) * dy_fiber
        z_center = -z1 + (j + 0.5) * dz_fiber
        concrete_fiber_coords.append((y_center, z_center))
        # Store files in subdirectory
        ops.recorder('Element', '-file', f'concrete_fibers/fiber_{i}_{j}.txt', 
                    '-ele', 1, 'section', 'fiber', y_center, z_center, 
                    ConcMatTag, 'stressStrain')

#%% Apply loads and run analysis
ops.timeSeries('Constant', 1)
ops.pattern('Plain', 1, 1)
ops.load(2, P, 0.0, 0.0, 0.0, My, Mz)  # Axial + biaxial moments

# Analysis settings
ops.integrator('LoadControl', 0.0)
ops.system('SparseGeneral', '-piv')
ops.test('NormUnbalance', 1e-9, 10)
ops.numberer('Plain')
ops.constraints('Plain')
ops.algorithm('Newton')
ops.analysis('Static')

# Run analysis
ops.analyze(1)
print(f'Applied P = {P} N, My = {My} N·m, Mz = {Mz} N·m')

# Verify section forces
forces = ops.eleForce(1)
print("\nSECTION FORCE VERIFICATION:")
print(f"  Axial (P): Applied = {P}, Section = {forces[0]}")
print(f"  Moment-Y (My): Applied = {My}, Section = {forces[4]}")
print(f"  Moment-Z (Mz): Applied = {Mz}, Section = {forces[5]}")

#%% Process bolt results
fiber_forces = []
bolt_stress = []
bolt_strain = []

for i in range(1, Nb + 1):
    try:
        data = np.loadtxt(f'fiber_{i}.txt')
        bolt_stress.append(data[0])
        bolt_strain.append(data[1])
        fiber_forces.append(data[0] * Ab)
    except FileNotFoundError:
        print(f"Warning: Missing bolt fiber file {i}")
        bolt_stress.append(0.0)
        bolt_strain.append(0.0)
        fiber_forces.append(0.0)

bolt_stress = np.array(bolt_stress)
bolt_strain = np.array(bolt_strain)
fiber_forces = np.array(fiber_forces)

# Save bolt data
bolt_data = []
for i, (y, z) in enumerate(steel_fiber_coords):
    bolt_data.append([y, z, fiber_forces[i], bolt_stress[i], bolt_strain[i]])

df_bolts = pd.DataFrame(bolt_data, 
                        columns=['y (m)', 'z (m)', 'Force (N)', 'Stress (Pa)', 'Strain'])
df_bolts.to_excel('Bolt_Forces.xlsx', index=False)

# Plot bolt stress distribution
plt.figure(figsize=(10, 7))
scatter = plt.scatter(df_bolts['z (m)'], df_bolts['y (m)'], 
                     c=df_bolts['Stress (Pa)'], cmap='viridis', 
                     s=100, edgecolor='k')
plt.colorbar(scatter, label='Stress (Pa)')
plt.xlabel('z (m)')
plt.ylabel('y (m)')
plt.title('Bolt Stress Distribution')
plt.grid(True, linestyle='--', alpha=0.7)
plt.axis('equal')
plt.tight_layout()
plt.savefig('bolt_stress_distribution.png')
plt.close()

#%% Process concrete results
concrete_stress = np.zeros((Ny, Nz))
concrete_strain = np.zeros((Ny, Nz))
y_coords = np.zeros((Ny, Nz))
z_coords = np.zeros((Ny, Nz))

for i in range(Ny):
    for j in range(Nz):
        try:
            data = np.loadtxt(f'concrete_fibers/fiber_{i}_{j}.txt')
            concrete_stress[i, j] = data[0]   # Stress in Pa
            concrete_strain[i, j] = data[1]    # Strain
        except FileNotFoundError:
            print(f"Warning: Missing concrete fiber file {i}_{j}")
            concrete_stress[i, j] = 0.0
            concrete_strain[i, j] = 0.0
        
        # Calculate coordinates
        y_coords[i, j] = -y1 + (i + 0.5) * dy_fiber
        z_coords[i, j] = -z1 + (j + 0.5) * dz_fiber

# Save concrete data
concrete_data = []
for i in range(Ny):
    for j in range(Nz):
        concrete_data.append([
            y_coords[i, j], 
            z_coords[i, j],
            concrete_stress[i, j],
            concrete_strain[i, j]
        ])

df_concrete = pd.DataFrame(concrete_data, 
                          columns=['y (m)', 'z (m)', 'Stress (Pa)', 'Strain'])
df_concrete.to_excel('Concrete_Fiber_Results.xlsx', index=False)

# Extreme fiber check
top_idx = np.unravel_index(np.argmax(y_coords), y_coords.shape)
bot_idx = np.unravel_index(np.argmin(y_coords), y_coords.shape)

print("\nCONCRETE EXTREME FIBERS:")
print(f"TOP: y={y_coords[top_idx]:.3f} m, stress={concrete_stress[top_idx]/1e6:.4f} MPa, "
      f"strain={concrete_strain[top_idx]:.6f}")
print(f"BOT: y={y_coords[bot_idx]:.3f} m, stress={concrete_stress[bot_idx]/1e6:.4f} MPa, "
      f"strain={concrete_strain[bot_idx]:.6f}")
#%% 3D Visualization of Stress Distribution
from mpl_toolkits.mplot3d import Axes3D

# Create figure
fig = plt.figure(figsize=(14, 10))
ax = fig.add_subplot(111, projection='3d')

# Plot concrete stress surface
X = z_coords  # Global Z (width direction)
Y = y_coords  # Global Y (depth direction)
Z = concrete_stress  # Stress values

# Surface plot with color mapping
surf = ax.plot_surface(X, Y, Z, cmap='coolwarm', edgecolor='black', alpha=0.7,
                      vmin=-np.max(np.abs(Z)), vmax=np.max(np.abs(Z)))
fig.colorbar(surf, ax=ax, label='Stress (Pa)', shrink=0.5)

# Plot bolts as colored bars
bolt_x = [coord[1] for coord in steel_fiber_coords]  # Z-coordinate
bolt_y = [coord[0] for coord in steel_fiber_coords]  # Y-coordinate
bolt_stress_arr = np.array(bolt_stress)

# Bar properties
bar_width = 0.05
bar_depth = 0.05

# Plot each bolt as a 3D bar
for i, (x, y, stress) in enumerate(zip(bolt_x, bolt_y, bolt_stress_arr)):
    ax.bar3d(x - bar_width/2, 
             y - bar_depth/2, 
             0, 
             bar_width, 
             bar_depth, 
             stress, 
             color='red' if stress > 0 else 'darkblue',
             alpha=0.8,
             shade=True)

# Add cross-section outline at base
z_min, z_max = -B/2, B/2
y_min, y_max = -D/2, D/2
ax.plot([z_min, z_max, z_max, z_min, z_min],
        [y_min, y_min, y_max, y_max, y_min],
        [0, 0, 0, 0, 0], '--', linewidth=2, color="black")

# Add labels and title
ax.set_xlabel('Global Z (m)')
ax.set_ylabel('Global Y (m)')
ax.set_zlabel('Stress (Pa)')
ax.set_title('3D Stress Distribution: Concrete (Surface) & Bolts (Bars)')

# Set viewing angle
ax.view_init(elev=30, azim=45)
plt.tight_layout()
plt.savefig('3d_stress_distribution.png', dpi=300)
plt.show()

print("3D visualization saved as '3d_stress_distribution.png'")