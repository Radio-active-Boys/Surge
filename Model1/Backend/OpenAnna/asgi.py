# OpenAnna/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import socket_connect.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'OpenAnna.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            socket_connect.routing.websocket_urlpatterns
        )
    ),
})