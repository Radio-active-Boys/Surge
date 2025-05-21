import matplotlib.pyplot as plt

# Create figure and axis
fig, ax = plt.subplots()
ax.set_title("Click to plot points (Close window to exit)")
ax.set_xlim(0, 10)
ax.set_ylim(0, 10)
ax.grid(True)
ax.set_aspect('equal')  # Keep grid squares equal
plt.xticks(range(11))
plt.yticks(range(11))

# List to store clicked points
clicked_points = []

# Click event handler
def onclick(event):
    if event.inaxes == ax and event.button == 1:  # Left click
        x, y = round(event.xdata), round(event.ydata)
        if (x, y) not in clicked_points:
            clicked_points.append((x, y))
            ax.plot(x, y, 'ro')  # Plot red circle
            print(f"Added point at ({x}, {y})")
            plt.draw()

# Register click handler
fig.canvas.mpl_connect('button_press_event', onclick)
plt.show()