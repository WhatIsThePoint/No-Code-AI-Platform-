import os

from flask import Flask, jsonify

from .config import Config, TestingConfig
from .extensions import mail, mongo


def create_app(config=None):
    from .observability import init_sentry

    init_sentry("ml-training-service")

    app = Flask(__name__)

    if config:
        app.config.from_object(config)
    elif os.environ.get("FLASK_ENV") == "testing":
        app.config.from_object(TestingConfig)
    else:
        app.config.from_object(Config)

    app.config["MONGO_URI"] = app.config["MONGO_URL"]

    mongo.init_app(app)
    mail.init_app(app)

    os.makedirs(app.config["MODEL_FOLDER"], exist_ok=True)

    from .routes.chat import chat_bp
    from .routes.compare import compare_bp
    from .routes.export import export_bp
    from .routes.models import models_bp
    from .routes.notes import notes_bp
    from .routes.pipelines import pipelines_bp
    from .routes.predict import predict_bp
    from .routes.train import train_bp

    app.register_blueprint(pipelines_bp)
    app.register_blueprint(models_bp)
    app.register_blueprint(train_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(predict_bp)
    app.register_blueprint(compare_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(export_bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "ml-training-service"}), 200

    return app
