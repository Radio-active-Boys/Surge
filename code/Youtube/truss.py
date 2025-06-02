
from matplotlib import image as img
from matplotlib import pyplot as plt
from opensees.openseespy import *
# %%
# image = img.imread("image.png")

# %%
# plt.imshow(image)

# %%
import numpy as np
import pandas as pd 

# %%
nodes = np.array([[0,6],
                  [4,6],
                  [8,6],
                  [12,6],
                  [16,6],
                  [12,2],
                  [8,0],
                  [4,2]])
elements = np.array([[1,2],
                     [2,3],
                     [3,4],
                     [4,5],
                     [5,6],
                     [6,7],
                     [7,8],
                     [1,8],
                     [2,8],
                     [3,8],
                     [3,7],
                     [3,6],
                     [4,6]])

# %%
for e in elements:
    ni = e[0]
    nj = e[1]
    xi = nodes[ni-1][0]
    yi = nodes[ni-1][1]
    xj = nodes[nj-1][0]
    yj = nodes[nj-1][1]
    print("Node ",ni," ",xi," ",yi,"Node ",nj," ",xj," ",yj)

# %%
fig = plt.figure()
fig.gca().set_aspect("equal",adjustable="box")
for e in elements:
    ni = e[0]
    nj = e[1]
    xi = nodes[ni-1][0]
    yi = nodes[ni-1][1]
    xj = nodes[nj-1][0]
    yj = nodes[nj-1][1]
    print("Node ",ni," ",xi," ",yi,"Node ",nj," ",xj," ",yj)
    plt.plot([xi,xj],[yi,yj],'-b')
for n in nodes:
    plt.plot(n[0],n[1],'bo')
plt.grid(True)
plt.show()

# %%
from openseespy.opensees import *

# %%
wipe()

# %%
model('basic','-ndm',2,'-ndf',2)

# %%
for i, n in enumerate(nodes):
    node(i+1,float(n[0]),float(n[1]))

# %%
# Set boundary condition
fix(1,1,1) #Pin at node 1
fix(5,0,1) #Horizontal roller at node 5

# %%
E = 2e+11 #(N/m2)
A = 0.005 # m2

# %%
uniaxialMaterial("Elastic",1,E)

# %%
for i,ele in enumerate(elements):
    element("Truss",i+1,int(ele[0]),int(ele[1]),A,1)

# %%
timeSeries("Constant",1)

# %%
pattern("Plain",1,1)

# %%
load(2,0.0,-10000.0)
load(3,0.0,-30000.0)
load(4,0.0,-5000.0)

# %%
system("BandSPD")

# %%
numberer("RCM")

# %%
constraints("Plain")

# %%
integrator("LoadControl",1.0)

# %%
algorithm("Linear")

# %%
analysis("Static")

# %%
analyze(1)

# %%
for i, n in enumerate(nodes):
    ux = round(nodeDisp(i+1, 1),5) #Horizontal nodal displacement
    uy = round(nodeDisp(i+1, 2),5) #Vertical nodal displacement
    print(f'Node {i+1}: Ux = {ux} m, Uy = {uy}')

# %%
fig = plt.figure()
# fig.gca().set_aspect("equal",adjustable="box")
for e in elements:
    ni = e[0]
    nj = e[1]
    xi = nodes[ni-1][0]
    yi = nodes[ni-1][1]
    uxi = nodes[ni-1][0]+round(nodeDisp(int(ni), 1),5)*500
    uyi = nodes[ni-1][1]+round(nodeDisp(int(ni), 2),5)*500
    xj = nodes[nj-1][0]
    yj = nodes[nj-1][1]
    uxj = nodes[nj-1][0]+round(nodeDisp(int(nj), 1),5)*500
    uyj = nodes[nj-1][1]+round(nodeDisp(int(nj), 2),5)*500
    print("Node ",ni," ",xi," ",yi,"Node ",nj," ",xj," ",yj)
    plt.plot([xi,xj],[yi,yj],'-b')
    plt.plot([uxi,uxj],[uyi,uyj],'-r')
for n in nodes:
    plt.plot(n[0],n[1],'bo')
#%%
plt.grid(True)
plt.show()

# %%
basicForce(5) #Element force in member 5 (nodes 5-6)

# %%
mbrForces = np.array([])
for i, mbr in enumerate(elements):
    axialForce = round(basicForce(i+1)[0]/1000,2)
    mbrForces = np.append(mbrForces,axialForce) #Store axial loads
    print(f'Force in member {i+1} (nodes {mbr[0]} to {mbr[1]}) is {axialForce} kN')

# %%
fig = plt.figure()
axes = fig.add_axes([0.1,0.1,2,2])
fig.gca().set_aspect('equal', adjustable='box')

#Plot members
for n, mbr in enumerate(elements):
    node_i = mbr[0] #Node number for node i of this member
    node_j = mbr[1] #Node number for node j of this member

    ix = nodes[node_i-1,0] #x-coord of node i of this member
    iy = nodes[node_i-1,1] #y-coord of node i of this member
    jx = nodes[node_j-1,0] #x-coord of node j of this member
    jy = nodes[node_j-1,1] #y-coord of node j of this member

    if(abs(mbrForces[n])<0.001):
        axes.plot([ix,jx],[iy,jy],'grey',linestyle='--') #Zero force in member
    elif(mbrForces[n]>0):
        axes.plot([ix,jx],[iy,jy],'b') #Member in tension
    else:
        axes.plot([ix,jx],[iy,jy],'r') #Member in compression

axes.set_xlabel('Distance (m)')
axes.set_ylabel('Distance (m)')
axes.set_title('Tension/compression members')
axes.grid()
plt.show()

# %%
# %%


