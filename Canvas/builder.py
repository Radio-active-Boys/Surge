# editor.py
import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d import Axes3D      # Enables 3D projection
from matplotlib.widgets import TextBox, RadioButtons

class SimpleFrameEditor:
    def __init__(self):
        # State
        self.dim = 2                            # 2 or 3
        self.grid = [1.0, 1.0, 1.0]             # Spacings for X,Y,Z
        self.nodes = []    # [(tag, (x,y,z))]
        self.elements = [] # [(tag, start_tag, end_tag)]
        self.supports = {} # {node_tag: [dof0..5]}
        self.mode = 'add_node'
        self.sel = []      # For element‐pair selection

        # Figure + Axes
        self.fig = plt.figure(figsize=(8,6))
        self.ax = self.fig.add_subplot(111)
        plt.subplots_adjust(left=0.3)

        # Widgets
        self._init_widgets()
        self._connect_events()
        self.redraw()
        plt.show()

    def _init_widgets(self):
        # Dim selector
        ax_dim = plt.axes([0.05, 0.8, 0.2, 0.1])
        self.rad_dim = RadioButtons(ax_dim, ('2D','3D'))
        # Mode selector
        ax_mode = plt.axes([0.05, 0.6, 0.2, 0.15])
        self.rad_mode = RadioButtons(ax_mode, 
                                    ('add_node','add_elem','add_support','delete'))
        # Grid spacing input
        ax_grid = plt.axes([0.05, 0.4, 0.2, 0.1])
        self.txt_grid = TextBox(ax_grid, 'Grid (x,y,z)', initial='1,1,1')

    def _connect_events(self):
        self.rad_dim.on_clicked(self.on_dim)
        self.rad_mode.on_clicked(self.on_mode)
        self.txt_grid.on_submit(self.on_grid)
        self.fig.canvas.mpl_connect('button_press_event', self.on_click)
        self.fig.canvas.mpl_connect('key_press_event', self.on_key)

    def on_dim(self, label):
        self.dim = 3 if label=='3D' else 2
        # recreate axes
        self.fig.delaxes(self.ax)
        proj = '3d' if self.dim==3 else None
        self.ax = self.fig.add_subplot(111, projection=proj)
        self.redraw()

    def on_mode(self, label):
        self.mode = label
        self.sel.clear()

    def on_grid(self, text):
        try:
            vals = [float(v) for v in text.split(',')]
            for i in range(min(3,len(vals))):
                self.grid[i] = vals[i]
        except:
            pass
        self.redraw()

    def snap(self, x, y, z=0):
        gx, gy, gz = self.grid
        return (round(x/gx)*gx, round(y/gy)*gy, round(z/gz)*gz)

    def nearest_node(self, x, y, z):
        dmin, nd = float('inf'), None
        for tag, (nx,ny,nz) in self.nodes:
            d = np.hypot(np.hypot(nx-x, ny-y), nz-z)
            if d<dmin:
                dmin, nd = d, tag
        return nd, dmin

    def nearest_elem(self, x, y, z):
        dmin, ed = float('inf'), None
        for tag, a, b in self.elements:
            # midpoint distance:
            nA = next(n for n in self.nodes if n[0]==a)[1]
            nB = next(n for n in self.nodes if n[0]==b)[1]
            mx,my,mz = np.mean([nA,nB], axis=0)
            d = np.hypot(np.hypot(mx-x, my-y), mz-z)
            if d<dmin:
                dmin, ed = d, tag
        return ed, dmin

    def on_click(self, ev):
        if ev.inaxes!=self.ax: return
        x,y = ev.xdata, ev.ydata
        z = 0
        if self.dim==3 and hasattr(ev, 'zdata'):
            z = ev.zdata
        x,y,z = self.snap(x,y,z)

        if self.mode=='add_node':
            # avoid dup
            if not any((x,y,z)==coord for _,coord in self.nodes):
                self.nodes.append((len(self.nodes)+1, (x,y,z)))

        elif self.mode=='add_elem' and len(self.nodes)>=2:
            tag, dist = self.nearest_node(x,y,z)
            if dist < max(self.grid)*0.5:
                self.sel.append(tag)
                if len(self.sel)==2:
                    self.elements.append((len(self.elements)+1, *self.sel))
                    self.sel.clear()

        elif self.mode=='add_support':
            tag, dist = self.nearest_node(x,y,z)
            if dist < max(self.grid)*0.5:
                # default 6‐DOF = fixed
                self.supports[tag] = [1]*6

        elif self.mode=='delete':
            # delete nearest node or element
            nd, d1 = self.nearest_node(x,y,z)
            ed, d2 = self.nearest_elem(x,y,z)
            if d1<d2 and d1<max(self.grid):
                self.nodes = [(t,c) for t,c in self.nodes if t!=nd]
                self.elements = [e for e in self.elements if nd not in e]
                self.supports.pop(nd, None)
            elif d2<d1 and d2<max(self.grid):
                self.elements = [e for e in self.elements if e[0]!=ed]

        self.redraw()

    def on_key(self, ev):
        if ev.key == 'backspace' and self.mode=='add_node':
            # remove last node
            if self.nodes:
                t,_ = self.nodes.pop()
                # cascade deletes
                self.elements = [e for e in self.elements if t not in e]
                self.supports.pop(t, None)
            self.redraw()

    def redraw(self):
        self.ax.clear()
        # Grid lines
        rng = np.arange(0, 10+self.grid[0], self.grid[0])
        for g in rng:
            if self.dim==2:
                self.ax.plot([g,g],[0,10],'--',linewidth=0.5)
                self.ax.plot([0,10],[g,g],'--',linewidth=0.5)
                self.ax.set_aspect('equal')
            else:
                # 3D grid in XY plane
                self.ax.plot3D([g,g],[0,10],[0,0],'--',linewidth=0.3)
                self.ax.plot3D([0,10],[g,g],[0,0],'--',linewidth=0.3)
                self.ax.set_box_aspect([1,1,1])
                self.ax.set_zlim(0,10)

        # Plot nodes
        for t,(x,y,z) in self.nodes:
            if self.dim==2:
                self.ax.scatter(x,y, s=50, c='red')
                self.ax.text(x,y, f'{t}', color='white', ha='center', va='center')
            else:
                self.ax.scatter(x,y,z, s=50, c='red')
                self.ax.text(x,y,z, f'{t}')

        # Plot elements
        for _, a, b in self.elements:
            A = next(c for t,c in self.nodes if t==a)
            B = next(c for t,c in self.nodes if t==b)
            if self.dim==2:
                self.ax.plot([A[0],B[0]],[A[1],B[1]], '-o')
            else:
                self.ax.plot3D([A[0],B[0]],[A[1],B[1]],[A[2],B[2]], '-o')

        # Plot supports as small squares at node
        for t,dofs in self.supports.items():
            coord = next(c for tt,c in self.nodes if tt==t)
            if self.dim==2:
                self.ax.scatter(coord[0], coord[1]-self.grid[1]*0.2,
                                marker='s', s=30, c='blue')
            else:
                self.ax.scatter(*coord, marker='s', s=30, c='blue')

        self.ax.set_xlim(0,10); self.ax.set_ylim(0,10)
        self.ax.set_title(f"{self.dim}D Frame Editor · mode={self.mode}")
        self.fig.canvas.draw_idle()

if __name__=='__main__':
    SimpleFrameEditor()
