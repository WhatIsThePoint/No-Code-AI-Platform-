"""MobileNet-V3-Small — the demo-killer architecture.

Why this one, specifically:

* It's the only arch in the catalog that ships an ImageNet checkpoint we can
  reuse via `torchvision.models`. Transfer learning is what makes the 1660
  Super demo actually impressive — it lets a fresh tenant's 200-image
  dataset hit 80 %+ in ~2 minutes instead of from-scratch 20 minutes.
* ~2.5 M params, expects 224×224 RGB. Compatible with the `224` bucket in
  ALLOWED_INPUT_SIZES; smaller buckets still work because the conv stack is
  spatially flexible — torchvision adapts via the AdaptiveAvgPool head.
* The classifier head is replaced wholesale (not just final Linear) so a
  fresh num_classes goes through the same Dropout → Linear chain that
  ImageNet uses, keeping behaviour predictable.
"""

from __future__ import annotations

import torch.nn as nn


def build(num_classes: int, input_size: int, pretrained: bool, in_channels: int = 3):
    # Imported lazily so the slow torchvision import (downloads weights
    # metadata on first call) doesn't run at app startup — only when the
    # arch is actually requested.
    from torchvision.models import (
        MobileNet_V3_Small_Weights,
        mobilenet_v3_small,
    )

    weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
    model = mobilenet_v3_small(weights=weights)

    # Single-channel inputs (Fashion-MNIST etc.) need an adapted stem since
    # the ImageNet weights expect 3 channels. We replace conv0 in-place and
    # keep the rest of the network — surgically narrow change, no behavioural
    # surprises further down the stack.
    if in_channels != 3:
        old = model.features[0][0]
        model.features[0][0] = nn.Conv2d(
            in_channels=in_channels,
            out_channels=old.out_channels,
            kernel_size=old.kernel_size,
            stride=old.stride,
            padding=old.padding,
            bias=old.bias is not None,
        )

    # Replace just the final Linear, preserving the Dropout immediately
    # before it. `model.classifier[3]` is the output Linear in
    # mobilenet_v3_small's classifier Sequential.
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, num_classes)

    del input_size  # accepted by the factory contract; not needed here.
    return model
