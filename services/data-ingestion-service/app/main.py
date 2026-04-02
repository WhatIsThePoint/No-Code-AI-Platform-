import os

from flask import Flask, jsonify

from .config import Config, TestingConfig
from .extensions import mongo


def create_app(config=None):
    app = Flask(__name__)

    if config:
        app.config.from_object(config)
    elif os.environ.get("FLASK_ENV") == "testing":
        app.config.from_object(TestingConfig)
    else:
        app.config.from_object(Config)

    # Init MongoDB
    mongo.init_app(app)

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Register blueprints
    from .routes.upload import upload_bp
    from .routes.connector import connector_bp
    from .routes.dataset import dataset_bp
    from .routes.preprocessing import preprocessing_bp
    from .routes.tasks import tasks_bp

    app.register_blueprint(upload_bp)
    app.register_blueprint(connector_bp)
    app.register_blueprint(dataset_bp)
    app.register_blueprint(preprocessing_bp)
    app.register_blueprint(tasks_bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "data-ingestion-service"}), 200

    return app
