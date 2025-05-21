import matplotlib.pyplot as plt
from matplotlib.widgets import RadioButtons, TextBox
import numpy as np
from mpl_toolkits.mplot3d import Axes3D  # Required for 3D projection

class GridEditor:
    def __init__(self):
        self.fig = plt.figure(figsize=(12, 8))
        self.dimensions = 2
        self.grid_spacing = [1.0, 1.0, 1.0]
        self.nodes = []
        self.elements = []
        self.supports = []
        self.current_mode = "add_node"
        self.current_z = 0  # For 3D node placement
        
        # Create UI controls first
        self._create_controls()
        
        # Initialize main axis
        self.ax = self._create_main_axis()
        self._setup_event_handlers()
        self.update_grid()
        plt.show()

    def _create_main_axis(self):
        # Clear existing axis if it exists
        if hasattr(self, 'ax') and self.ax:
            self.fig.delaxes(self.ax)
            
        # Create new axis with proper projection
        projection = '3d' if self.dimensions == 3 else None
        ax = self.fig.add_subplot(111, projection=projection)
        
        # Adjust layout to accommodate controls
        plt.subplots_adjust(left=0.3, right=0.95, top=0.95, bottom=0.1)
        return ax

    def _create_controls(self):
        # Dimension selector
        self.rax_dim = plt.axes([0.05, 0.7, 0.15, 0.15])
        self.radio_dim = RadioButtons(self.rax_dim, ('2D', '3D'), active=0)
        
        # Grid spacing input
        self.axbox = plt.axes([0.05, 0.5, 0.15, 0.05])
        self.text_box = TextBox(self.axbox, "Grid Spacing\n(x,y,z):", initial="1.0,1.0,1.0")
        
        # Mode selector
        self.rax_mode = plt.axes([0.05, 0.3, 0.15, 0.15])
        self.radio_mode = RadioButtons(self.rax_mode, ('Add Node', 'Add Element', 'Add Support'))
        
        # Z-level control (3D only)
        self.z_slider_ax = plt.axes([0.05, 0.1, 0.15, 0.03])
        self.z_slider = plt.Slider(self.z_slider_ax, 'Z-level', 0, 10, valinit=0, valstep=self.grid_spacing[2])

    def _setup_event_handlers(self):
        self.radio_dim.on_clicked(self.set_dimensions)
        self.radio_mode.on_clicked(self.set_mode)
        self.text_box.on_submit(self.submit_grid_spacing)
        self.fig.canvas.mpl_connect('button_press_event', self.onclick)
        self.z_slider.on_changed(self.update_z_level)

    def update_z_level(self, val):
        self.current_z = round(float(val) / self.grid_spacing[2]) * self.grid_spacing[2]
        self.z_slider.set_val(self.current_z)
        self.update_grid()

    def set_dimensions(self, label):
        self.dimensions = 3 if label == "3D" else 2
        self.ax = self._create_main_axis()
        self.update_grid()
        self.z_slider_ax.set_visible(self.dimensions == 3)
        self.fig.canvas.draw_idle()

    def update_grid(self):
        self.ax.clear()
        self.ax.set_title(f"{'3D' if self.dimensions==3 else '2D'} Structural Modeller")
        
        # Set grid bounds and ticks
        max_dim = 10
        x_ticks = np.arange(0, max_dim+self.grid_spacing[0], self.grid_spacing[0])
        y_ticks = np.arange(0, max_dim+self.grid_spacing[1], self.grid_spacing[1])
        z_ticks = np.arange(0, max_dim+self.grid_spacing[2], self.grid_spacing[2])
        
        self.ax.set(xlim=(0, max_dim), ylim=(0, max_dim), xticks=x_ticks, yticks=y_ticks)
        self.ax.grid(True)
        
        if self.dimensions == 3:
            self.ax.set(zlim=(0, max_dim), zticks=z_ticks)
            self.ax.set_box_aspect([1,1,1])
        else:
            self.ax.set_aspect('equal')

        # Plot nodes
        for node in self.nodes:
            x, y, z = node[1]
            if self.dimensions == 2:
                self.ax.plot(x, y, 'ro', markersize=8)
            else:
                self.ax.scatter(x, y, z, color='red', s=80)

        # Plot elements
        for elm in self.elements:
            start = next(n[1] for n in self.nodes if n[0] == elm[1])
            end = next(n[1] for n in self.nodes if n[0] == elm[2])
            if self.dimensions == 2:
                self.ax.plot([start[0], end[0]], [start[1], end[1]], 'b-')
            else:
                self.ax.plot([start[0], end[0]], [start[1], end[1]], [start[2], end[2]], 'b-')

    def onclick(self, event):
        if event.inaxes != self.ax:
            return

        # Get coordinates snapped to grid
        x = round(event.xdata / self.grid_spacing[0]) * self.grid_spacing[0]
        y = round(event.ydata / self.grid_spacing[1]) * self.grid_spacing[1]
        z = self.current_z if self.dimensions == 3 else 0

        if self.current_mode == "add_node":
            if not any(np.allclose([x,y,z], n[1]) for n in self.nodes):
                node_tag = len(self.nodes) + 1
                self.nodes.append((node_tag, (x, y, z)))
                
        elif self.current_mode == "add_element" and len(self.nodes) >= 2:
            # Find nearest node within snap tolerance
            snap_tol = min(self.grid_spacing) * 0.5
            nearest = None
            for node in self.nodes:
                dx = node[1][0] - x
                dy = node[1][1] - y
                dz = node[1][2] - z
                dist = np.sqrt(dx**2 + dy**2 + dz**2)
                if dist < snap_tol:
                    nearest = node[0]
                    break
            if nearest:
                if len(self.selected_nodes) < 2:
                    self.selected_nodes.append(nearest)
                if len(self.selected_nodes) == 2:
                    elem_tag = len(self.elements) + 1
                    self.elements.append((elem_tag, *self.selected_nodes))
                    self.selected_nodes = []

        self.update_grid()
        self.fig.canvas.draw_idle()

    def submit_grid_spacing(self, text):
        try:
            values = list(map(float, text.split(',')))
            self.grid_spacing = values + [1.0]*(3-len(values))  # Pad to 3 values
            self.z_slider.valstep = self.grid_spacing[2]
            self.update_grid()
        except:
            pass

    def set_mode(self, label):
        self.current_mode = label.lower().replace(' ', '_')
        if self.current_mode == "add_element":
            self.selected_nodes = []

if __name__ == "__main__":
    GridEditor()