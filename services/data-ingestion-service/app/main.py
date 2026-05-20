import os

from flask import Flask, jsonify

from .config import Config, TestingConfig
from .extensions import mongo


def create_app(config=None):
    from .observability import init_sentry

    init_sentry("data-ingestion-service")

    app = Flask(__name__)

    if config:
        app.config.from_object(config)
    elif os.environ.get("FLASK_ENV") == "testing":
        app.config.from_object(TestingConfig)
    else:
        app.config.from_object(Config)

    # Init MongoDB
    mongo.init_app(app)

    # Ensure upload folder + image-dataset root exist. The latter is also
    # mounted by dl-training-service for reads — pre-creating here avoids
    # a race where a `image-upload` lands before that service has booted.
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["IMAGE_DATASET_ROOT"], exist_ok=True)

    # Register blueprints
    from .routes.connector import connector_bp
    from .routes.dataset import dataset_bp
    from .routes.image_dataset import image_dataset_bp
    from .routes.preprocessing import preprocessing_bp
    from .routes.rag import rag_bp
    from .routes.tasks import tasks_bp
    from .routes.upload import upload_bp

    app.register_blueprint(upload_bp)
    app.register_blueprint(connector_bp)
    app.register_blueprint(dataset_bp)
    app.register_blueprint(image_dataset_bp)
    app.register_blueprint(preprocessing_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(rag_bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "data-ingestion-service"}), 200

    return app
