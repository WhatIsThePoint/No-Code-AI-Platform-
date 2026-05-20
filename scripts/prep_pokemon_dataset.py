"""Prepare a Kaggle-style Pokemon image dataset for the DL pipeline.

Input layout (flat images + CSV with type labels):
    <input_dir>/
        pokemon.csv         columns: Name, Type1, Type2 (Type2 may be blank)
        images/
            pikachu.png
            charmander.png
            ...

Output (an in-place zip ready for /datasets/image-upload):
    <output.zip>:
        <type1>/
            pikachu.png
            ...
        <type2>/
            ...

Default split: classify by `Type1` (primary type). Pokemon with very rare
primary types are dropped — fewer than `min_per_class` images would
either fail ImageFolder's split or produce a zero-shot validation fold.

Usage:
    python3 scripts/prep_pokemon_dataset.py <input_dir> <output.zip>
                                            [--min-per-class 5]
                                            [--label-col Type1]
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}


def _slugify_name(name: str) -> str:
    """Pokemon names sometimes have spaces / special chars. Match the
    image filename's normalisation rule (lowercase, strip non-alnum)
    so we can find the file regardless of how Kaggle saved it."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _index_images(images_dir: Path) -> dict[str, Path]:
    """Map slugified-stem → path. Multiple images per Pokemon (e.g.
    forme variants in some Kaggle dumps) collapse to one entry — we
    pick the first match deterministically by sorting first."""
    out: dict[str, Path] = {}
    for p in sorted(images_dir.iterdir()):
        if p.is_file() and p.suffix.lower() in _IMAGE_EXTS:
            slug = _slugify_name(p.stem)
            out.setdefault(slug, p)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", help="Folder containing pokemon.csv + images/")
    parser.add_argument("output_zip")
    parser.add_argument(
        "--min-per-class",
        type=int,
        default=5,
        help="Drop classes with fewer than N images (avoids degenerate splits).",
    )
    parser.add_argument(
        "--label-col",
        default="Type1",
        help="CSV column to use as the class label (Type1 or Type2).",
    )
    args = parser.parse_args()

    src = Path(args.input_dir).resolve()
    csv_path = src / "pokemon.csv"
    images_dir = src / "images"

    if not csv_path.is_file():
        sys.exit(f"missing CSV: {csv_path}")
    if not images_dir.is_dir():
        sys.exit(f"missing images dir: {images_dir}")

    image_index = _index_images(images_dir)
    if not image_index:
        sys.exit(f"no images found under {images_dir}")

    # Plan: bucket by class first so we can apply min_per_class before
    # writing anything to disk.
    by_class: dict[str, list[tuple[Path, str]]] = defaultdict(list)
    matched = 0
    unmatched: list[str] = []

    with csv_path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if args.label_col not in reader.fieldnames:
            sys.exit(
                f"CSV has no column {args.label_col!r}; available: {reader.fieldnames}"
            )
        # Find the name column. Kaggle dumps use 'Name', 'name', or 'Pokemon'.
        name_col = None
        for candidate in ("Name", "name", "Pokemon", "pokemon"):
            if candidate in reader.fieldnames:
                name_col = candidate
                break
        if name_col is None:
            sys.exit(f"could not find a name column in CSV (got {reader.fieldnames})")

        for row in reader:
            name = (row.get(name_col) or "").strip()
            label = (row.get(args.label_col) or "").strip()
            if not name or not label:
                continue
            slug = _slugify_name(name)
            img = image_index.get(slug)
            if img is None:
                unmatched.append(name)
                continue
            # Lowercase the class folder so ImageFolder produces stable indices
            # regardless of CSV casing (Fire vs fire vs FIRE).
            by_class[label.lower()].append((img, f"{slug}{img.suffix.lower()}"))
            matched += 1

    if not by_class:
        sys.exit("no labelled images matched the CSV — check name/Type columns")

    # Apply the min_per_class filter and report.
    kept = {c: files for c, files in by_class.items() if len(files) >= args.min_per_class}
    dropped = sorted(set(by_class) - set(kept))
    if not kept:
        sys.exit(
            f"no class has >= {args.min_per_class} images; "
            f"the largest is {max(len(v) for v in by_class.values())}"
        )

    print(f"matched {matched} images across {len(by_class)} raw classes")
    if unmatched:
        # Show only the head — full list spam is unhelpful for 50+ misses.
        head = ", ".join(unmatched[:5])
        more = len(unmatched) - 5
        suffix = f" (+{more} more)" if more > 0 else ""
        print(f"unmatched (no image found): {head}{suffix}")
    if dropped:
        print(f"dropped (< {args.min_per_class} images): {', '.join(dropped)}")
    print(f"keeping {len(kept)} classes:")
    for c in sorted(kept, key=lambda c: -len(kept[c])):
        print(f"   {c:>14}  {len(kept[c])} imgs")

    out = Path(args.output_zip).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for cls, files in kept.items():
            for src_path, arcname in files:
                zf.write(src_path, arcname=f"{cls}/{arcname}")
    total = sum(len(v) for v in kept.values())
    print(f"\nwrote {out} · {len(kept)} classes × ~{total // len(kept)} avg images = {total} total")


if __name__ == "__main__":
    main()
