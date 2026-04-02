from flask import Flask, jsonify


def create_app():
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "ml-training-service"}), 200

    return app
