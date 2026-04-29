from flask import Flask, jsonify

from .observability import init_sentry


def create_app():
    init_sentry("metrics-service")
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "metrics-service"}), 200

    return app
