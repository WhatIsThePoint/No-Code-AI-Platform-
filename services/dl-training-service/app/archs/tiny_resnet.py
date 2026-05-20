"""ResNet-9 — the canonical small residual network for fast image-classification
demos. Channels 64→128→256, two residual blocks, global pool, FC head.

Trains a CIFAR-10-class problem to ~90 % accuracy in ~5 epochs at batch=64,
input=64 on a single GPU — the demo sweet spot. No torchvision dependency
because we want a model that's fully owned in-tree (so the report can show
the architecture diagram without "see torchvision source").

Parameter count: ~2.7 M.
"""

from __future__ import annotations

import torch.nn as nn


def _conv_block(in_c: int, out_c: int, pool: bool = False) -> nn.Sequential:
    layers: list[nn.Module] = [
        nn.Conv2d(in_c, out_c, kernel_size=3, padding=1, bias=False),
        nn.BatchNorm2d(out_c),
        nn.ReLU(inplace=True),
    ]
    if pool:
        layers.append(nn.MaxPool2d(2))
    return nn.Sequential(*layers)


class _ResidualBlock(nn.Module):
    """Two 3×3 convs with a skip connection. No projection — channels are
    held constant inside each block, so the skip is identity."""

    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = _conv_block(channels, channels)
        self.conv2 = _conv_block(channels, channels)

    def forward(self, x):
        return x + self.conv2(self.conv1(x))


class TinyResNet(nn.Module):
    def __init__(self, num_classes: int, in_channels: int = 3):
        super().__init__()
        self.stem = _conv_block(in_channels, 64)
        self.layer1 = _conv_block(64, 128, pool=True)
        self.res1 = _ResidualBlock(128)
        self.layer2 = _conv_block(128, 256, pool=True)
        self.layer3 = _conv_block(256, 256, pool=True)
        self.res2 = _ResidualBlock(256)
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(0.2),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        x = self.stem(x)
        x = self.layer1(x)
        x = self.res1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.res2(x)
        return self.head(x)


def build(num_classes: int, input_size: int, pretrained: bool, in_channels: int = 3):
    # Same `pretrained` no-op rationale as LeNet — there's no canonical
    # ResNet-9 ImageNet checkpoint, and the model is light enough that
    # from-scratch is the realistic path for the demo workloads anyway.
    del input_size, pretrained
    return TinyResNet(num_classes=num_classes, in_channels=in_channels)
