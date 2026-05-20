"""POST /dl/predict/<model_version_id> — single-image inference.

Loads the saved state_dict + class_index sidecar from MODEL_FOLDER, rebuilds
the architecture, runs one forward pass, and returns top-K softmax
probabilities. CPU is used unconditionally — single-image inference is
~5–20 ms either way and avoiding the CUDA path keeps the predict route
usable on a host without a GPU (e.g. CI healthcheck).

Result shape:
  {
    "class": "<best label>",
    "probs": [{"class": "<label>", "probability": <float>}, ...]
  }
"""

from __future__ import annotations

import io

from flask import Blueprint, current_app, jsonify, request

from ..extensions import mongo

predict_bp = Blueprint("dl_predict", __name__)

# Top-K returned in the response. Five is enough to show "this CIFAR cat
# also looks slightly like a dog" without bloating the JSON.
_TOP_K = 5

# Mirror the eval transform from training so the input distribution at
# predict time matches what the model saw at validation. Hard-coded
# Imagenet mean/std for the same reason as image_dataset.build_transforms.
_IMAGENET_MEAN = (0.485, 0.456, 0.406)
_IMAGENET_STD = (0.229, 0.224, 0.225)


@predict_bp.post("/dl/predict/<model_version_id>")
def predict(model_version_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    if "file" not in request.files:
        return (
            jsonify(
                {
                    "error": "validation_error",
                    "detail": "Multipart form must include a 'file' field with the image.",
                }
            ),
            400,
        )
    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "validation_error", "detail": "Empty file."}), 400

    # ── Look up the version row in Mongo so we can reject failed/training
    # runs with a clear status before touching the disk. The sidecar files
    # exist only after a successful save by tasks.train_image.
    version = mongo.get_collection("model_versions").find_one(
        {"version_id": model_version_id}
    )
    if version is None:
        return jsonify({"error": "version_not_found"}), 404
    if version.get("status") != "ready":
        return (
            jsonify(
                {
                    "error": "version_not_ready",
                    "status": version.get("status"),
                    "detail": "Wait for training to finish before predicting.",
                }
            ),
            409,
        )
    if version.get("framework") != "pytorch":
        return (
            jsonify(
                {
                    "error": "wrong_framework",
                    "detail": "Use the ml-training predict route for non-pytorch models.",
                }
            ),
            400,
        )

    # ── Heavy imports are deferred so the route module loads on a host
    # without torch (the test fixture stubs the predict path entirely).
    import torch
    from PIL import Image
    from torchvision import transforms

    from ..archs import build as build_arch
    from ..services import model_storage

    model_folder = current_app.config["MODEL_FOLDER"]
    try:
        class_index = model_storage.load_class_index(model_folder, model_version_id)
        meta = model_storage.load_meta(model_folder, model_version_id)
    except FileNotFoundError:
        # Mongo says ready but disk is gone — orphaned sidecars / wiped volume.
        return jsonify({"error": "artefacts_missing"}), 410

    arch = meta.get("arch")
    input_size = int(meta.get("input_size", 224))
    pretrained = bool(meta.get("pretrained", False))
    num_classes = len(class_index)
    if arch is None or num_classes == 0:
        return jsonify({"error": "corrupt_meta"}), 500

    try:
        model = build_arch(
            arch=arch,
            num_classes=num_classes,
            input_size=input_size,
            pretrained=False,  # weights are loaded from state_dict next
        )
        state_path = model_storage.model_state_path(model_folder, model_version_id)
        # `weights_only=True` is the secure default in torch 2.4+; falls back
        # cleanly on older builds where the kwarg doesn't exist.
        try:
            state = torch.load(state_path, map_location="cpu", weights_only=True)
        except TypeError:
            state = torch.load(state_path, map_location="cpu")
        model.load_state_dict(state)
        model.eval()
    except Exception as exc:
        return (
            jsonify({"error": "model_load_failed", "detail": str(exc)[:300]}),
            500,
        )

    # ── Decode + transform the uploaded image ────────────────────────────
    try:
        raw = file.read()
        if not raw:
            return jsonify({"error": "validation_error", "detail": "Empty image."}), 400
        img = Image.open(io.BytesIO(raw))
        if img.mode != "RGB":
            img = img.convert("RGB")
    except Exception as exc:
        return jsonify({"error": "image_decode_failed", "detail": str(exc)[:200]}), 400

    eval_tx = transforms.Compose(
        [
            transforms.Resize(int(input_size * 1.15)),
            transforms.CenterCrop(input_size),
            transforms.ToTensor(),
            transforms.Normalize(_IMAGENET_MEAN, _IMAGENET_STD),
        ]
    )
    x = eval_tx(img).unsqueeze(0)  # add batch dim

    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1).squeeze(0)

    # Order indices by descending probability and slice to top-K. `topk`
    # guarantees the indices are in sorted order and only allocates K slots,
    # which is cheaper than argsort on a 1000-class network.
    k = min(_TOP_K, num_classes)
    top_probs, top_indices = torch.topk(probs, k)

    ranked = [
        {
            "class": class_index.get(int(idx.item()), str(int(idx.item()))),
            "probability": float(p.item()),
        }
        for p, idx in zip(top_probs, top_indices)
    ]

    return (
        jsonify(
            {
                "class": ranked[0]["class"],
                "probs": ranked,
                "version_id": model_version_id,
                "arch": arch,
                "input_size": input_size,
            }
        ),
        200,
    )
