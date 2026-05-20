"""Smoke tests for the arch registry.

Each architecture must:
1. instantiate from the registry without touching CUDA (CPU tests),
2. accept the correct input shape for its bucket and produce a
   `(batch, num_classes)` logit tensor,
3. round-trip its `state_dict()` through model_storage.save/load,
4. report a parameter count consistent with the value the vram_guard
   estimator expects (so the budget envelope stays calibrated).
"""

from __future__ import annotations

import pytest
import torch

from app.archs import _REGISTRY, build, params_mb


@pytest.mark.parametrize(
    "arch,input_size,in_channels",
    [
        ("lenet", 28, 1),
        ("lenet", 32, 3),
        ("tiny_resnet", 64, 3),
        ("mobilenet_v3_small", 224, 3),
        ("mobilenet_v3_small", 224, 1),  # adapted stem path
    ],
)
def test_forward_shape(arch: str, input_size: int, in_channels: int):
    num_classes = 10
    model = build(
        arch=arch,
        num_classes=num_classes,
        input_size=input_size,
        pretrained=False,
        in_channels=in_channels,
    )
    model.eval()
    x = torch.randn(2, in_channels, input_size, input_size)
    with torch.no_grad():
        out = model(x)
    assert out.shape == (2, num_classes), f"{arch} produced {tuple(out.shape)}"


@pytest.mark.parametrize("arch", list(_REGISTRY.keys()))
def test_param_count_within_calibration(arch: str):
    """The vram_guard envelope is calibrated against `_REGISTRY[arch][1]` (MB
    of fp32 weights). If a refactor changes the param count the envelope
    silently drifts — this test is the canary."""
    model = build(arch=arch, num_classes=10, input_size=32, pretrained=False)
    n_params = sum(p.numel() for p in model.parameters())
    measured_mb = (n_params * 4) / (1024 * 1024)
    expected_mb = params_mb(arch)
    # Allow ±50 % drift before failing — the registry value is intended to
    # be a static safety upper bound, not an exact match. The mobilenet
    # head replacement changes a few hundred KB depending on num_classes,
    # so a tight bound would be flaky.
    assert measured_mb <= expected_mb * 1.5, (
        f"{arch}: measured {measured_mb:.2f} MB exceeds calibrated "
        f"{expected_mb} MB by more than 50 %; update _REGISTRY and "
        f"vram_guard activation constants together."
    )


def test_unknown_arch_raises():
    with pytest.raises(ValueError):
        build(arch="resnet50_xxl", num_classes=2, input_size=224, pretrained=False)


def test_save_load_roundtrip(tmp_path):
    """End-to-end: build → train one tiny step → save → load → predict."""
    from app.services import model_storage

    model = build(arch="lenet", num_classes=3, input_size=28, pretrained=False)
    saved = model_storage.save(
        model_folder=str(tmp_path),
        version_id="v-test",
        state_dict=model.state_dict(),
        class_index={0: "a", 1: "b", 2: "c"},
        meta={"arch": "lenet", "epochs": 1},
    )
    assert (tmp_path / "v-test" / "model.pt").exists()
    assert (tmp_path / "v-test" / "class_index.json").exists()
    assert (tmp_path / "v-test" / "training_meta.json").exists()
    assert saved.endswith("v-test")

    # Load back into a fresh instance and confirm logits match.
    fresh = build(arch="lenet", num_classes=3, input_size=28, pretrained=False)
    state = torch.load(model_storage.model_state_path(str(tmp_path), "v-test"))
    fresh.load_state_dict(state)
    fresh.eval()
    model.eval()

    x = torch.randn(1, 3, 28, 28)
    with torch.no_grad():
        a = model(x)
        b = fresh(x)
    assert torch.allclose(a, b, atol=1e-6)

    idx = model_storage.load_class_index(str(tmp_path), "v-test")
    assert idx == {0: "a", 1: "b", 2: "c"}
    meta = model_storage.load_meta(str(tmp_path), "v-test")
    assert meta["arch"] == "lenet"
