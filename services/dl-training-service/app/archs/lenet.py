"""LeNet-style classifier for the smallest demo bucket (28–32 px inputs).

Faithful to the classical 1989 architecture in spirit, with two concessions
to practical reuse:

* The first conv accepts both 1-channel (Fashion-MNIST) and 3-channel
  (CIFAR-10) inputs — the wrapper in `archs/__init__.py` adapts `in_channels`
  rather than forcing a grayscale conversion at the dataset layer.
* An `AdaptiveAvgPool2d(1)` sits before the fully-connected head so the same
  module handles 28 px, 32 px and 64 px without recomputing FC sizes.

Parameter count is ~60 k — trains in seconds on the 1660 Super, perfect for
an "is the pipeline wired up?" smoke test on stage.
"""

from __future__ import annotations

import torch.nn as nn


class LeNet(nn.Module):
    def __init__(self, num_classes: int, in_channels: int = 3):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(in_channels, 6, kernel_size=5, padding=2),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
            nn.Conv2d(6, 16, kernel_size=5),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),
        )
        # Adaptive pool flattens any spatial input down to 1×1 so the FC head
        # is input-size agnostic — same module works at 28 / 32 / 64 px.
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(16, 120),
            nn.ReLU(inplace=True),
            nn.Linear(120, 84),
            nn.ReLU(inplace=True),
            nn.Linear(84, num_classes),
        )

    def forward(self, x):
        x = self.features(x)
        x = self.pool(x)
        return self.classifier(x)


def build(num_classes: int, input_size: int, pretrained: bool, in_channels: int = 3):
    # `pretrained` is accepted for API symmetry with the other archs but is a
    # no-op here — there are no canonical pretrained weights for LeNet, and
    # for a 60k-param model from-scratch training converges in <1 minute on
    # MNIST-class data anyway.
    del input_size, pretrained
    return LeNet(num_classes=num_classes, in_channels=in_channels)
