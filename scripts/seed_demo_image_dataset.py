"""Seed a tiny image dataset for the DL demo.

Synthesises 30 colour-tinted PNGs across 3 classes — small enough to
upload through the existing `/datasets/image-upload` route without a
real Fashion-MNIST mirror, large enough that ImageFolder can
train/val-split it and a tiny_resnet has something to learn.

Usage:
  python scripts/seed_demo_image_dataset.py <output.zip>

The resulting zip can be uploaded from the Data page (Image Dataset
upload) or pushed directly with curl:

  curl -fsS -H "Authorization: Bearer $JWT" \\
       -F file=@/tmp/demo.zip \\
       http://localhost:8000/datasets/image-upload
"""

from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

# Three classes with distinguishable shapes + tints so a fresh CNN can
# actually learn the difference within 1-2 epochs on the 1660 Super.
CLASSES: dict[str, tuple[tuple[int, int, int], str]] = {
    "circle": ((220, 80, 80), "circle"),
    "square": ((80, 180, 100), "square"),
    "triangle": ((90, 130, 220), "triangle"),
}

PER_CLASS = 10
IMG_SIZE = 64


def _make_image(color: tuple[int, int, int], shape: str, seed: int) -> bytes:
    """Render a single training sample with mild stochastic placement so
    each class has *some* intra-class variation — a perfectly identical
    set would let the model hit 100% by memorising one pixel."""
    img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), color=(245, 245, 240))
    draw = ImageDraw.Draw(img)
    # Cheap deterministic jitter from the seed; no random module needed.
    jx = (seed * 7) % 12 - 6
    jy = (seed * 11) % 12 - 6
    pad = 10
    box = (pad + jx, pad + jy, IMG_SIZE - pad + jx, IMG_SIZE - pad + jy)
    if shape == "circle":
        draw.ellipse(box, fill=color)
    elif shape == "square":
        draw.rectangle(box, fill=color)
    elif shape == "triangle":
        x0, y0, x1, y1 = box
        draw.polygon([(x0, y1), ((x0 + x1) // 2, y0), (x1, y1)], fill=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main(output_path: str) -> None:
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for class_name, (color, shape) in CLASSES.items():
            for i in range(PER_CLASS):
                payload = _make_image(color, shape, seed=i)
                zf.writestr(f"{class_name}/{class_name}_{i:02d}.png", payload)
    print(
        f"[seed] wrote {out} · {len(CLASSES)} classes × {PER_CLASS} images = "
        f"{len(CLASSES) * PER_CLASS} total"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("usage: seed_demo_image_dataset.py <output.zip>\n")
        sys.exit(2)
    main(sys.argv[1])
