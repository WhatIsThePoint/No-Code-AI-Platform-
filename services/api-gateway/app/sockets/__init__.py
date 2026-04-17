"""SocketIO singleton + registration entry point."""

from flask_socketio import SocketIO

# One SocketIO instance shared across the process. Initialised with a
# Redis message queue so cross-process emits (e.g. from auth-service's
# meetings route) land on connected clients.
socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=False,
    engineio_logger=False,
)


def register_socket_handlers(app) -> None:
    """Attach SocketIO to a Flask app and import handler modules."""
    socketio.init_app(
        app,
        message_queue=app.config["SOCKETIO_MESSAGE_QUEUE"],
    )
    # Import side effects: decorators register event handlers on `socketio`.
    from . import chat  # noqa: F401
