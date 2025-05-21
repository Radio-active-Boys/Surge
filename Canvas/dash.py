# Import libraries
import dash
import dash_core_components as dcc
import dash_html_components as html
from plotly.subplots import make_subplots
import plotly.graph_objects as go
import numpy as np

# Create sample data
def create_data():
    x = np.linspace(-5, 5, 100)
    y = np.linspace(-5, 5, 100)
    X, Y = np.meshgrid(x, y)
    Z = np.sin(np.sqrt(X**2 + Y**2))
    return X, Y, Z

X, Y, Z = create_data()

# Create the 3D plot
fig = go.Figure(data=[go.Surface(z=Z, x=X, y=Y)])

# Add titles and labels
fig.update_layout(title='3D Surface Plot',
                   scene=dict(
                       xaxis_title='X',
                       yaxis_title='Y',
                       zaxis_title='Z'))

# Create the Dash app
app = dash.Dash(__name__)

# Define the layout
app.layout = html.Div([
    dcc.Graph(id='3d-plot', figure=fig),
])

# Run the app
if __name__ == '__main__':
    app.run_server(debug=True)