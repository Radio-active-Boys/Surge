# -*- coding: utf-8 -*-
"""
Created on Thu May 21 13:37:00 2025

@author: CKolay
"""
#%% Import opensees and others
#==============================================================================
import openseespy.opensees as ops
# import opensees as ops  # local compilation
import opsvis as opsv
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.image as mpimg
import pandas as pd
import os
import shutil
# import sys
# sys.path.append('../')
# from FiberSectionForceDeformation import MomentCurvaturePy2D
# import os
# os.system('clear')
# plt.close("all")

def delete_local_folder(folder_name):
    folder_path = os.path.join(os.getcwd(), folder_name)
    if os.path.isdir(folder_path):
        try:
            shutil.rmtree(folder_path)
            print(f"Deleted folder: {folder_name}")
        except Exception as e:
            print(f"Error deleting {folder_name}: {e}")
    else:
        print(f"{folder_name} does not exist.")

# delete only folders in current directory
delete_local_folder("steel_fibers")
delete_local_folder("concrete_fibers")

# Load image
img = mpimg.imread('BasePlateRCFST_Schematic.png')

# Display image
plt.imshow(img)
plt.axis('off')  # Hide axes
plt.show()

#%% Input parameters
#==============================================================================
P =-46000.0 # Axial force [kN]
Mz = 55624 # Moment about z-axis [kN-m]
My = 14923 # Moment about y-axis [kN-m]
# Base plate dimension
B = 3.35 # Dimension along the z-direction [m]
D = 3.4 # Dimension along y-direction [m]
db = 0.1 # Diameter of bolt [m]

# Column dimension
b = 1.65 # Dimension along z-direction [m]
d = 1.75 # Dimension alogn y-direction [m]

# Number of bolts in the column region 
# along z-direction
Nbzc = 5
# along y-direction
Nbyc = 5

# Number of bolts in base plate edge region
# along z-direction, including corner bolt
Nbze = 2
# along y-direction, excluding corner bolt
Nbye = 1

# Edge distance of bolt center line, taken the same for both directions
ed = 0.2 # [m]

# Distance along z-direction between column face and nearest bolt in the column region
ez = 0.165 # [m]

# Distance along y-direction between column face and nearest bolt in the column region
ey = 0.165 # [m]

#%% PLEASE DO NOT EDIT AFTER THIS LINE
#==============================================================================
#  Number of bolts along z-direction, including the corner bolts
Nbz = Nbzc + 2*Nbze
#  Number of bolts along y-direction, excluding the corner bolts
Nby = Nbyc + 2*Nbye
Nb = 2*(Nbz+Nby) # Total number of bolts
print(f'Total number of bolts = {Nb}')

pi =3.141592653589793
Ab = pi*db**2/4 # Area of one bolt

# Number of subdivisions (fibers) in the y direction (fiber width = H/Ny)
Ny = 30
# Number of subdivisions (fibers) in the z-direction  (fiber width = B/Nz)
Nz = 30

fy = 1000000.0 # High value so that no yielding occurs
Es = 200.0*10**6
fck = 40.0
Ec = 5000*np.sqrt(fck)*1e3

ConcMatTag = 1
SteelMatTag = 2

#% Wipe and create model
ops.wipe()
ops.model('basic', '-ndm', 3, '-ndf', 6)  # frame 3D
# Define two nodes at (0,0)
ops.node(1, 0.0, 0.0, 0.0)
ops.node(2, 0.0, 0.0, 0.0)

# Fix all degrees of freedom except axial and bending
ops.fix(1, 1, 1, 1, 1, 1, 1)
ops.fix(2, 0, 1, 1, 1, 0, 0)

# No tension concrete material
ops.uniaxialMaterial('ENT',ConcMatTag,Ec)

# Tension only bolt material
ops.uniaxialMaterial('ElasticPPGap', SteelMatTag, Es, fy, 0.0, 0.0)

# some variables derived from the parameters
y1 = D/2.0
z1 = B/2.0

yc1 = d/2.0
zc1 = b/2.0


dy = (D/2 - d/2 - ed)/(Nbye+0.5) # y-spacing of bolts in edge region
y2 = y1-ed-dy

dy2 = d/Nbyc # y-spacing of bolts in column region

secTag = 1

#ops.section(secType, secTag, *secArgs)¶
fib_sec_CFST = [['section','Fiber',secTag,'-GJ',1.0e6],
    # Create the concrete core fibers
    ['patch', 'rect', ConcMatTag, Ny, Nz, -y1, -z1, y1, z1],
    # Top row (left corner)
    ['layer', 'straight', SteelMatTag, Nbze, Ab, y1-ed, z1-ed, y1-ed, zc1+ez], 
    # Top row (column region)
    ['layer', 'straight', SteelMatTag, Nbzc, Ab, y1-ed, zc1-ez, y1-ed, ez-zc1],
    # Top row (right corner)
    ['layer', 'straight', SteelMatTag, Nbze, Ab, y1-ed, -(zc1+ez), y1-ed, ed-z1],
    # Right column (top corner)
    ['layer', 'straight', SteelMatTag, Nbye, Ab, y2, ed-z1, yc1+dy/2, ed-z1], 
    # Right column (column region)
    ['layer', 'straight', SteelMatTag, Nbyc, Ab, yc1-dy2/2, ed-z1, -(yc1-dy2/2), ed-z1],
    # Right column (bottom corner)
    ['layer', 'straight', SteelMatTag, Nbye, Ab, -yc1-dy/2, ed-z1, -y2, ed-z1], 
    # Bottom row (right corner)
    ['layer', 'straight', SteelMatTag, Nbze, Ab, ed-y1, ed-z1, ed-y1, -(zc1+ez)],
    # Bottom row (column region)
    ['layer', 'straight', SteelMatTag, Nbzc, Ab, -(y1-ed), ez-zc1, -(y1-ed), zc1-ez],
    # Bottom row (left corner)
    ['layer', 'straight', SteelMatTag, Nbze, Ab, ed-y1, (zc1+ez), ed-y1, z1-ed],
    # Left column (bottom corner)
    ['layer', 'straight', SteelMatTag, Nbye, Ab, -y2, z1-ed, -yc1-dy/2, z1-ed], 
    # Left column (column region)
    ['layer', 'straight', SteelMatTag, Nbyc, Ab, -(yc1-dy2/2), z1-ed, yc1-dy2/2, z1-ed],
    # Left column (top corner)
    ['layer', 'straight', SteelMatTag, Nbye, Ab, yc1+dy/2, z1-ed, y2, z1-ed] 
    ]

matcolor = ['gold','lightgrey', 'gold', 'm', 'r', 'w', 'w']
opsv.plot_fiber_section(fib_sec_CFST, matcolor=matcolor)
plt.axis('equal')

# Get the current axis
ax = plt.gca()
plt.show()
# Define the rectangle: bottom-left corner (x, y), width, height
rect = patches.Rectangle((-b/2, -d/2), b, d, linewidth=4, edgecolor='blue', facecolor='gray')

# Add the rectangle to the plot
ax.add_patch(rect)

opsv.fib_sec_list_to_cmds(fib_sec_CFST)

# Define element
#                             tag ndI ndJ  secTag
ops.element('zeroLengthSection',  1,   1,   2,  secTag)

#%% Record stress-strain response in bolts and get bolt forces
def get_straight_layer_coords(n_fibers, yI, zI, yJ, zJ):
    ys = np.linspace(yI, yJ, n_fibers)
    zs = np.linspace(zI, zJ, n_fibers)
    return list(zip(ys, zs))

# Define all steel fiber layers
steel_fiber_coords = []
# Top row (left corner)
steel_fiber_coords += get_straight_layer_coords(Nbze, y1-ed, z1-ed, y1-ed, zc1+ez)
# Top row (column region)
steel_fiber_coords += get_straight_layer_coords(Nbzc, y1-ed, zc1-ez, y1-ed, ez-zc1)
# Top row (right corner)
steel_fiber_coords += get_straight_layer_coords(Nbze, y1-ed, -(zc1+ez), y1-ed, ed-z1)
# Right column (top corner)
steel_fiber_coords += get_straight_layer_coords(Nbye, y2, ed-z1, yc1+dy/2, ed-z1)
# Right column (column region)
steel_fiber_coords += get_straight_layer_coords(Nbyc, yc1-dy2/2, ed-z1, -(yc1-dy2/2), ed-z1)
# Right column (bottom corner)
steel_fiber_coords += get_straight_layer_coords(Nbye, -yc1-dy/2, ed-z1, -y2, ed-z1)
# Bottom row (right corner)
steel_fiber_coords += get_straight_layer_coords(Nbze, ed-y1, ed-z1, ed-y1, -(zc1+ez))
# Bottom row (column region)
steel_fiber_coords += get_straight_layer_coords(Nbzc, -(y1-ed), ez-zc1, -(y1-ed), zc1-ez)
# Bottom row (left corner)
steel_fiber_coords += get_straight_layer_coords(Nbze, ed-y1, (zc1+ez), ed-y1, z1-ed)
# Left column (bottom corner)
steel_fiber_coords += get_straight_layer_coords(Nbye, -y2, z1-ed, -yc1-dy/2, z1-ed)
# Left column (column region)
steel_fiber_coords += get_straight_layer_coords(Nbyc, -(yc1-dy2/2), z1-ed, yc1-dy2/2, z1-ed)
# Left column (top corner)
steel_fiber_coords += get_straight_layer_coords(Nbye, yc1+dy/2, z1-ed, y2, z1-ed)


# Print coordinates
# for i, (y, z) in enumerate(steel_fiber_coords, 1):
#     print(f"Steel Fiber {i}: y = {y:.3f}, z = {z:.3f}")
os.makedirs('steel_fibers', exist_ok=True)
os.makedirs('concrete_fibers', exist_ok=True)

for i, (y, z) in enumerate(steel_fiber_coords, 1):
    ops.recorder('Element', '-file', f'steel_fibers/fiber_{i}.out', '-ele', secTag, 'section', 'fiber', y, z, SteelMatTag,'stressStrain')

# fibLoc = D/2-ed;
# ops.recorder('Element','-ele',1,'-file','BoltFiber.out','section','fiber', -fibLoc, 0,SteelMatTag,'stressStrain')

#%% Record bearing pressure at four corners
ops.recorder('Element','-ele',1,'-file','concrete_fibers/BearingP1.out','section','fiber', y1, z1,ConcMatTag,'stressStrain')
ops.recorder('Element','-ele',1,'-file','concrete_fibers/BearingP2.out','section','fiber', y1, -z1,ConcMatTag,'stressStrain')
ops.recorder('Element','-ele',1,'-file','concrete_fibers/BearingP3.out','section','fiber', -y1, -z1,ConcMatTag,'stressStrain')
ops.recorder('Element','-ele',1,'-file','concrete_fibers/BearingP4.out','section','fiber', -y1, z1,ConcMatTag,'stressStrain')

# Create recorders for concrete fibers set by Vishal
dy_fiber = 2 * y1 / Ny
dz_fiber = 2 * z1 / Nz
concrete_fiber_coords = []

for i in range(Ny):
    os.makedirs(f'concrete_fibers/concrete_fibers_{i}', exist_ok=True)

    for j in range(Nz):
        y_center = -y1 + (i + 0.5) * dy_fiber
        z_center = -z1 + (j + 0.5) * dz_fiber
        concrete_fiber_coords.append((y_center, z_center))

        # And here, make sure to write into the correct subfolder:
        ops.recorder(
            'Element',
            '-file',
            f'concrete_fibers/concrete_fibers_{i}/fiber_{i}_{j}.out',
            '-ele', 1,
            'section', 'fiber',
            y_center, z_center,
            ConcMatTag,
            'stressStrain'
        )

#%% Define constant axial load
ops.timeSeries('Constant', 1)
ops.pattern('Plain', 1, 1)
ops.load(2, P, 0.0, 0.0, 0.0, My, Mz)

# Define analysis parameters
ops.integrator('LoadControl', 0.0)
ops.system('SparseGeneral', '-piv')
ops.test('NormUnbalance', 1e-9, 10)
ops.numberer('Plain')
ops.constraints('Plain')
ops.algorithm('Newton')
ops.analysis('Static')

# Do one analysis for constant axial load
ops.analyze(1)

#%% For visualization
print(f'Applied P = {P} N, My = {My} N·m, Mz = {Mz} N·m')
print(f'P = {P} and Mz = {Mz} applied')
# Verify section forces
forces = ops.eleForce(1)
print("\nSECTION FORCE VERIFICATION:")
print(f"  Axial (P): Applied = {P}, Section = {-forces[0]}")
print(f"  Moment-Y (My): Applied = {My}, Section = {-forces[4]}")
print(f"  Moment-Z (Mz): Applied = {Mz}, Section = {-forces[5]}")

#%% Get forces in each bolt and write to an excel file
fiber_forces = []
bolt_stress = []
bolt_strain = []
# --- Loop through each fiber file ---
for i in range(1, Nb + 1):
    try:
        filename = f"steel_fibers/fiber_{i}.out"
        bolt_data = np.loadtxt(filename)  # shape: (n_steps,)
        bolt_stress.append(bolt_data[0]*0.001)
        bolt_strain.append(bolt_data[1])
        force = bolt_data[0] * Ab
        fiber_forces.append(force)
    except FileNotFoundError:
        print(f"Warning: Missing bolt fiber file {i}")
        bolt_stress.append(0.0)
        bolt_strain.append(0.0)
        fiber_forces.append(0.0)

# Convert to numpy array for further processing
# shape: (num_fibers, n_steps)
fiber_forces = np.array(fiber_forces)
bolt_stress = np.array(bolt_stress)
bolt_strain = np.array(bolt_strain)
print("Maximum bolt force:", np.max(fiber_forces),"kN")

# Save bolt data
bolt_data = []
for i, (y, z) in enumerate(steel_fiber_coords):
    bolt_data.append([y, z, fiber_forces[i], bolt_stress[i], bolt_strain[i]])

df_bolts = pd.DataFrame(bolt_data, 
                        columns=['y (m)', 'z (m)', 'Force (kN)', 'Stress (MPa)', 'Strain'])
df_bolts.to_excel('Bolt_Forces.xlsx', index=False)

# for e,i in enumerate(bolt_stress):
#     print("each ", e+1, " Stress ", i)
    
#%% Get maximum bearing pressure

BearingPressure = []
for i in range(1,5):
    filename = f"concrete_fibers/BearingP{i}.out"
    
    # Load stress values
    pressure = np.loadtxt(filename)  # shape: (n_steps,)
   
    BearingPressure.append(pressure)

# Convert to numpy array for further processing
# shape: (num_fibers, n_steps)
BearingPressure = np.array(BearingPressure)
abs_max_col = np.max(np.abs(BearingPressure[:,0]))
print("Maximum bearing pressure:", (abs_max_col*1e-3),"MPa")

#%% Process concrete results
concrete_stress = np.zeros((Ny, Nz))
concrete_strain = np.zeros((Ny, Nz))
y_coords = np.zeros((Ny, Nz))
z_coords = np.zeros((Ny, Nz))

for i in range(Ny):
    for j in range(Nz):
        try:
            data = np.loadtxt(f'concrete_fibers/concrete_fibers_{i}/fiber_{i}_{j}.out')
            concrete_stress[i, j] = data[0]*0.001   # Stress
            concrete_strain[i, j] = data[1]    # Strain
        except FileNotFoundError:
            print(f"Warning: Missing concrete fiber file {i}_{j}")
            concrete_stress[i, j] = 0.0
            concrete_strain[i, j] = 0.0

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
                          columns=['y (m)', 'z (m)', 'Stress (MPa)', 'Strain'])
df_concrete.to_excel('Concrete_Fiber_Results.xlsx', index=False)

top_idx = np.unravel_index(np.argmax(y_coords), y_coords.shape)
bot_idx = np.unravel_index(np.argmin(y_coords), y_coords.shape)

# print("\nCONCRETE EXTREME FIBERS:")
# print(f"TOP: y={y_coords[top_idx]:.3f} m, stress={concrete_stress[top_idx]:.4f} , "
#       f"strain={concrete_strain[top_idx]:.6f}")
# print(f"BOTTOM: y={y_coords[bot_idx]:.3f} m, stress={concrete_stress[bot_idx]:.4f} , "
#       f"strain={concrete_strain[bot_idx]:.6f}")

plt.figure(figsize=(10, 7), constrained_layout=True)
contour = plt.contourf(z_coords, y_coords, concrete_stress , 50, cmap='viridis')
scatter = plt.scatter(df_bolts['z (m)'], df_bolts['y (m)'], 
                     c=df_bolts['Stress (MPa)'], cmap='magma', 
                     s=100, edgecolor='k')
plt.colorbar(scatter, label='Bolt Stress')
plt.colorbar(contour, label='Bearing Pressure')
plt.xlabel('z (m)')
plt.ylabel('y (m)')
plt.title('Stress Contour (MPa)')
plt.axis('equal')
plt.grid(True, linestyle='--', alpha=0.7)
plt.savefig('Stress_contour.png')

plt.figure(figsize=(10, 7), constrained_layout=True)
contour = plt.contourf(z_coords, y_coords, concrete_strain , 50, cmap='gist_rainbow')
scatter = plt.scatter(df_bolts['z (m)'], df_bolts['y (m)'], 
                     c=df_bolts['Strain'], cmap='gist_rainbow', 
                     s=100, edgecolor='k')
plt.colorbar(contour, label='Strain')
plt.xlabel('z (m)')
plt.ylabel('y (m)')
plt.title('Strain Contour')
plt.axis('equal')
plt.grid(True, linestyle='--', alpha=0.7)
plt.savefig('Strain_contour.png')