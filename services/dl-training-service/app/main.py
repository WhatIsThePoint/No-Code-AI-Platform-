import os

from flask import Flask, jsonify

from .config import Config, TestingConfig
from .extensions import mongo


def create_app(config=None):
    from .observability import init_sentry

    init_sentry("dl-training-service")

    app = Flask(__name__)

    if config:
        app.config.from_object(config)
    elif os.environ.get("FLASK_ENV") == "testing":
        app.config.from_object(TestingConfig)
    else:
        app.config.from_object(Config)

    app.config["MONGO_URI"] = app.config["MONGO_URL"]

    mongo.init_app(app)

    os.makedirs(app.config["MODEL_FOLDER"], exist_ok=True)
    os.makedirs(app.config["IMAGE_DATASET_ROOT"], exist_ok=True)

    from .routes.predict import predict_bp
    from .routes.train import train_bp

    app.register_blueprint(train_bp)
    app.register_blueprint(predict_bp)

    @app.get("/health")
    def health():
        # `/health` purposely does NOT touch CUDA — that probe lives at
        # `/dl/gpu` so a Mongo blip doesn't mask a missing GPU and vice versa.
        return jsonify({"status": "ok", "service": "dl-training-service"}), 200

    @app.get("/dl/gpu")
    def gpu_status():
        """Reports whether torch can see the GPU + a coarse memory snapshot.

        Used by the admin Healthcheck panel so a wrong --gpus flag at compose
        time is visible from the UI rather than buried in worker logs.
        """
        try:
            import torch
        except Exception as exc:  # torch missing entirely — should never happen
            return jsonify({"available": False, "error": str(exc)[:200]}), 200

        info = {
            "available": bool(torch.cuda.is_available()),
            "device_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
            "torch_version": torch.__version__,
            "cuda_version": getattr(torch.version, "cuda", None),
        }
        if info["available"]:
            try:
                idx = torch.cuda.current_device()
                props = torch.cuda.get_device_properties(idx)
                # `mem_get_info` returns (free, total) bytes for the *current*
                # device — accurate at the moment of the call. The admin
                # panel polls this every few seconds so the bar moves as
                # other CUDA processes (e.g. an active training run) take
                # or release VRAM.
                try:
                    free_b, total_b = torch.cuda.mem_get_info(idx)
                    free_mb = round(free_b / (1024 * 1024))
                    total_mb_live = round(total_b / (1024 * 1024))
                except Exception:
                    free_mb = None
                    total_mb_live = None
                info.update(
                    {
                        "device_name": props.name,
                        "total_memory_mb": round(props.total_memory / (1024 * 1024)),
                        "compute_capability": f"{props.major}.{props.minor}",
                        "free_memory_mb": free_mb,
                        # Sometimes diverges from total_memory_mb because the
                        # driver carves out a small reserved slice; expose
                        # both so callers can use whichever is appropriate.
                        "total_memory_mb_live": total_mb_live,
                    }
                )
            except Exception as exc:
                info["probe_error"] = str(exc)[:200]
        return jsonify(info), 200

    return app
