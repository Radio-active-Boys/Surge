# -*- coding: utf-8 -*-
"""
Created on Thu May 21 13:37:00 2025

@author: CKolay
"""
#%% Import opensees and others
# Restart kernel before running

import openseespy.opensees as ops
# import opensees as ops  # local compilation
import opsvis as opsv
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import os as os
import shutil


#import os

# import sys
# sys.path.append('../')
# from FiberSectionForceDeformation import MomentCurvaturePy2D
# import os
# os.system('clear')
# plt.close("all")

# New
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

# Old
# def delete_directory_if_exists(directory_path):
#     """Deletes a directory and its contents if it exists.

#     Args:
#         directory_path: The path to the directory to delete.
#     """
#     if os.path.exists(directory_path):
#         try:
#             shutil.rmtree(directory_path)
#             print(f"Directory '{directory_path}' and its contents deleted successfully.")
#         except Exception as e:
#             print(f"Error deleting directory '{directory_path}': {e}")
#     else:
#         print(f"Directory '{directory_path}' does not exist.")
    
# #Try deleting a non-existing directory

# FolderLoc=os.getcwd()
# FolderName=FolderLoc+"\\ResultFiles"
# delete_directory_if_exists(FolderName)
# os.mkdir(FolderName)


#%% Define material and section properties
P =-46000.0 # Axial force
Mz =55624 # Moment about z-axis
My = 14923 # Moment about y-axis
Dc = 1.750 #Diameter of the column in m
Dp = 4.500 #Diameter of the base plate in m
db = 0.1

#%% PLEASE DO NOT EDIT AFTER THIS LINE
#==============================================================================
pi =3.141592653589793
Ab = pi*db**2/4


#  Number of bolts along the perimeter
Nb = 24
print(f'Total number of bolts = {Nb}')

ed = 0.2

# Number of subdivisions (fibers) in the circumferential direction
Nc =22
# Number of subdivisions (fibers) in radial direction
Nr = 23


fy = 1000000.0 # High value so that no yielding occurs
Es = 200.0*10**6
fck = 50.0
Ec = 5000*np.sqrt(fck)*1e3

ConcMatTag = 1
SteelMatTag = 2

#%% Wipe and create model
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

secTag = 1

inRad=0.0
outRad=Dp/2

thetas=0*np.pi/Nc # starting angle for the bolts

#ops.section(secType, secTag, *secArgs)¶
fib_sec_CFST = [['section','Fiber',secTag,'-GJ',1.0e6],
    # Create the concrete core fibers
    ['patch', 'circ', ConcMatTag,  Nc, Nr, 0, 0, inRad, outRad, 0, 360],
    ['layer', 'circ', SteelMatTag, Nb, Ab, 0, 0, outRad-ed, thetas*180/np.pi,360+thetas*180/np.pi], # Rebars along the circumference
    ]

matcolor = ['gold','lightgrey', 'gold', 'm', 'r', 'w', 'w']
opsv.plot_fiber_section(fib_sec_CFST, matcolor=matcolor)
plt.axis('equal')
plt.show()


opsv.fib_sec_list_to_cmds(fib_sec_CFST)

# Define element
#                             tag ndI ndJ  secTag
ops.element('zeroLengthSection',  1,   1,   2,  secTag)

#%% Record stress-strain response in bolts and get bolt forces
def get_steel_bolt_centers(n_fibers, outRad, ed,startangle):
    theta = np.linspace(0, 2*np.pi, n_fibers)+thetas
    ys = (outRad-ed)* np.cos(theta) 
    zs = (outRad-ed)*np.sin(theta)
    return list(zip(ys, zs))

def get_RC_outer_edges(n_patch, outRad):
    theta = np.linspace(0, 2*np.pi, n_patch)
    ys = (outRad)* np.cos(theta) 
    zs = (outRad)*np.sin(theta)
    return list(zip(ys, zs))

# Define all steel fiber layers
steel_fiber_coords = []

# Bolts
steel_fiber_coords += get_steel_bolt_centers(Nb, outRad, ed,thetas)

# Concrete edge coordinates
concrete_edge=[]
concrete_edge += get_RC_outer_edges(Nc, outRad)


# Print coordinates
# for i, (y, z) in enumerate(steel_fiber_coords, 1):
#     print(f"Steel Fiber {i}: y = {y:.3f}, z = {z:.3f}")
os.makedirs('steel_fibers', exist_ok=True)
os.makedirs('concrete_fibers', exist_ok=True)

for i, (y, z) in enumerate(steel_fiber_coords, 1):
    # BoltFileName=FolderName+'\\'+f'boltForce_{i}.txt'
    ops.recorder('Element', '-file', f'steel_fibers/boltForce_{i}.txt', '-ele', secTag, 'section', 'fiber', y, z, SteelMatTag,'stressStrain')

fibLoc = outRad-ed
ops.recorder('Element','-ele',1,'-file','steel_fibers/BoltFiber.out','section','fiber', -fibLoc, 0,SteelMatTag,'stressStrain')

#%% Record bearing pressure around the edges

for i, (y, z) in enumerate(concrete_edge, 1):
    # ConcFileName=FolderName+'\\'+f'concretePress_{i}.txt'
    ConcFileName=f'concrete_fibers/concretePress_{i}.txt'
    ops.recorder('Element', '-file',ConcFileName , '-ele', secTag, 'section', 'fiber', y, z, ConcMatTag,'stressStrain')

#ops.recorder('Element','-ele',1,'-file','BearingP1.out','section','fiber', y1, z1,ConcMatTag,'stressStrain')

# Create recorders for concrete patch fibers (circular pattern)
Ny = Nc  # circumferential subdivisions=
Nz = Nr  # radial subdivisions=

def get_fiber_centers_circular_patch(Ny, Nz, inRad, outRad, yCenter=0.0, zCenter=0.0, startAngleDeg=0.0, endAngleDeg=360.0):
    fiber_coords = []
    dtheta = np.radians(endAngleDeg - startAngleDeg) / Ny
    dr = (outRad - inRad) / max(Nz - 1, 1)

    for i in range(Nz):
        r = inRad + i * dr
        for j in range(Ny):
            theta = np.radians(startAngleDeg) + (j + 0.5) * dtheta
            y = yCenter + r * np.cos(theta)
            z = zCenter + r * np.sin(theta)
            fiber_coords.append((i, j, y, z))
    return fiber_coords

# Generate circular patch fiber centers
circular_fiber_coords = get_fiber_centers_circular_patch(Ny, Nz, inRad=0.0, outRad=outRad)

# Create directories and recorders
for i, j, y, z in circular_fiber_coords:
    os.makedirs(f'concrete_fibers/concrete_fibers_{i}', exist_ok=True)
    ops.recorder(
        'Element',
        '-file',
        f'concrete_fibers/concrete_fibers_{i}/fiber_{i}_{j}.txt',
        '-ele', 1,
        'section', 'fiber',
        y, z,
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
print(f'P = {P}, My = {My}, and Mz = {Mz} applied')
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
for i in range(1, Nb+1):
    # New
    BoltFileName = f"steel_fibers/boltForce_{i}.txt"
    bolt_data = np.loadtxt(BoltFileName)  # shape: (n_steps,)
    bolt_stress.append(bolt_data[0]*0.001)
    bolt_strain.append(bolt_data[1])
    force = bolt_data[0] * Ab
    fiber_forces.append(force)
    # Old
    # BoltFileName=FolderName+'\\'+f'boltForce_{i}.txt'
    # stress = np.loadtxt(BoltFileName)  # shape: (n_steps,)
    # force = stress * Ab
    # fiber_forces.append(force)

# Convert to numpy array for further processing
# shape: (num_fibers, n_steps)
fiber_forces = np.array(fiber_forces)
bolt_stress = np.array(bolt_stress)
bolt_strain = np.array(bolt_strain)
print("Maximum bolt force:", np.max(fiber_forces),"kN")

# New
# Save bolt data
bolt_data = []
for i, (y, z) in enumerate(steel_fiber_coords):
    bolt_data.append([y, z, fiber_forces[i], bolt_stress[i], bolt_strain[i]])

df_bolts = pd.DataFrame(bolt_data, 
                        columns=['y (m)', 'z (m)', 'Force (kN)', 'Stress (MPa)', 'Strain'])
df_bolts.to_excel('Bolt_Forces.xlsx', index=False)

# Old
# combined_data = []

# for i, (y, z) in enumerate(steel_fiber_coords):
#     row = [y, z] + fiber_forces[i].tolist()
#     combined_data.append(row)

# combined_data = np.array(combined_data)  # shape: (n_fibers, 2 + n_steps)
# max_bolt_force = np.max(combined_data[:,2])
# print("Maximum bolt force:", (max_bolt_force),"kN")
# # Assuming `combined_data` is a NumPy array of shape (n_fibers, 2 + n_steps)
# # from earlier step, and:
# # - First column: y
# # - Second column: z
# # - Rest: forces over time

# n_steps = combined_data.shape[1] - 2

# # Create column names
# columns = ['y (m)', 'z (m)', 'Force (kN)', 'Strain']

# # Convert to DataFrame
# df = pd.DataFrame(combined_data, columns=columns)

# # Write to Excel
# df.to_excel('Bolt_Forces.xlsx', index=False)


#%% Get maximum bearing pressure

BearingPressure = []

for i in range(1, Nc+1):
    # New
    ConcFileName = f"concrete_fibers/concretePress_{i}.txt"
    # Load stress values
    pressure = np.loadtxt(ConcFileName)  # shape: (n_steps,)
    BearingPressure.append(pressure)

    # Old
    # ConcFileName=FolderName+'\\'+f'concretePress_{i}.txt'
    # stress = np.loadtxt(ConcFileName)  # shape: (n_steps,)
    # bearingpress = stress
    # BearingPressure.append(bearingpress)

BearingPressure = np.array(BearingPressure)

combined_data = []

for i, (y, z) in enumerate(concrete_edge):
    row = [y, z] + BearingPressure[i].tolist()
    combined_data.append(row)

BearingPressure = np.array(combined_data)  # shape: (n_fibers, 2 + n_steps)
abs_max_col = np.max(np.abs(BearingPressure[:,2]))



print("Maximum bearing pressure:", (abs_max_col*1e-3),"MPa")

#%% Process concrete results 
concrete_stress = np.zeros((Nz, Ny))  # radial × circumferential
concrete_strain = np.zeros((Nz, Ny))
y_coords = np.zeros((Nz, Ny))
z_coords = np.zeros((Nz, Ny))

for i, j, y, z in circular_fiber_coords:
    try:
        data = np.loadtxt(f'concrete_fibers/concrete_fibers_{i}/fiber_{i}_{j}.txt')
        concrete_stress[i, j] = data[0] * 0.001  # MPa
        concrete_strain[i, j] = data[1]
    except FileNotFoundError:
        print(f"Warning: Missing concrete fiber file {i}_{j}")
        concrete_stress[i, j] = 0.0
        concrete_strain[i, j] = 0.0
    y_coords[i, j] = y
    z_coords[i, j] = z

y_coords = np.hstack([y_coords, y_coords[:, 0:1]])
z_coords = np.hstack([z_coords, z_coords[:, 0:1]])
concrete_stress = np.hstack([concrete_stress, concrete_stress[:, 0:1]])
concrete_strain = np.hstack([concrete_strain, concrete_strain[:, 0:1]])
# Save to Excel
concrete_data = []
for i in range(Nz):
    for j in range(Ny):
        concrete_data.append([
            y_coords[i, j], 
            z_coords[i, j],
            concrete_stress[i, j],
            concrete_strain[i, j]
        ])

df_concrete = pd.DataFrame(concrete_data, 
                          columns=['y (m)', 'z (m)', 'Stress (MPa)', 'Strain'])
df_concrete.drop_duplicates(subset=['y (m)', 'z (m)'], keep='first', inplace=True)
df_concrete.to_excel('Concrete_Fiber_Results.xlsx', index=False)

# Print top and bottom fiber (based on y-coordinate)
top_idx = np.unravel_index(np.argmax(y_coords), y_coords.shape)
bot_idx = np.unravel_index(np.argmin(y_coords), y_coords.shape)

# print("\nCONCRETE EXTREME FIBERS:")
# print(f"TOP: y={y_coords[top_idx]:.3f} m, stress={concrete_stress[top_idx]:.4f} MPa, "
#       f"strain={concrete_strain[top_idx]:.6f}")
# print(f"BOTTOM: y={y_coords[bot_idx]:.3f} m, stress={concrete_stress[bot_idx]:.4f} MPa, "
#       f"strain={concrete_strain[bot_idx]:.6f}")

# Stress contour
plt.figure(figsize=(10, 7), constrained_layout=True)
contour = plt.contourf(z_coords, y_coords, concrete_stress, 50, cmap='viridis')
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
plt.savefig('Stress_Contour.png', dpi=600)

# Strain contour
plt.figure(figsize=(10, 7), constrained_layout=True)
contour = plt.contourf(z_coords, y_coords, concrete_strain, 50, cmap='gist_rainbow')
scatter = plt.scatter(df_bolts['z (m)'], df_bolts['y (m)'],
                      c=df_bolts['Strain'], cmap='gist_rainbow',
                      s=100, edgecolor='k')

plt.colorbar(contour, label='Strain')
plt.xlabel('z (m)')
plt.ylabel('y (m)')
plt.title('Strain Contour')
plt.axis('equal')
plt.grid(True, linestyle='--', alpha=0.7)
plt.savefig('Strain_Contour.png', dpi=600)
