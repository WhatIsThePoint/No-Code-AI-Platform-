"""Insert all rendered diagrams into finalReport.tex.

For each commented `\\begin{figure}...\\end{figure}` block in the report,
look up whether a matching PNG exists in `diagrams/`. If yes:
  - uncomment the block
  - rewrite the includegraphics path from `figures/placeholder_X` to `diagrams/X`
  - pick the sizing strategy based on the image's natural aspect ratio:
      * very wide (w/h >= 2.5)  -> wrap in pdflscape landscape page
      * very tall (h/w >= 1.6)  -> use height=0.9\\textheight, keepaspectratio
      * else                    -> keep existing width=...\\textwidth
If no PNG exists, leave the block commented (the 9 pending screenshots).

Run: python3 scripts/insert_diagrams.py
"""
from __future__ import annotations

import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT = ROOT / "finalReport.tex"
DIAGRAMS = ROOT / "diagrams"

ASPECT_LANDSCAPE = 2.5   # w/h above this -> landscape page
ASPECT_TALL = 1.6        # h/w above this -> height-based scaling


def png_dimensions(p: Path) -> tuple[int, int] | None:
    """Read width + height from a PNG header without external tools."""
    with p.open("rb") as f:
        signature = f.read(8)
        if signature != b"\x89PNG\r\n\x1a\n":
            return None
        f.read(4)  # IHDR length
        chunk_type = f.read(4)
        if chunk_type != b"IHDR":
            return None
        w, h = struct.unpack(">II", f.read(8))
        return w, h


def classify(dim: tuple[int, int]) -> str:
    w, h = dim
    if w / h >= ASPECT_LANDSCAPE:
        return "landscape"
    if h / w >= ASPECT_TALL:
        return "tall"
    return "normal"


def slug_from_path(includegraphics_arg: str) -> str:
    """`figures/placeholder_ch1_fig1` -> `ch1_fig1`."""
    base = includegraphics_arg.split("/")[-1]
    if base.startswith("placeholder_"):
        base = base[len("placeholder_"):]
    return base


# Match a commented figure block, including any preceding
# multi-line `% [FIGURE NEEDED: ... ]` annotation. Greedy-anchored on
# the trailing `% \end{figure}`.
FIGURE_BLOCK = re.compile(
    r"(?P<body>(?:[ \t]*%[^\n]*\n)+?[ \t]*%\s*\\end\{figure\}\n"
    r"(?:[ \t]*%\s*\\end\{landscape\}\n)?)",
    re.MULTILINE,
)


def uncomment(body: str) -> str:
    """Strip the leading '% ' (or '%') from each line of a commented block."""
    out = []
    for line in body.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("% "):
            # Preserve the original indentation, drop "% ".
            indent = line[: len(line) - len(stripped)]
            out.append(indent + stripped[2:])
        elif stripped.startswith("%"):
            indent = line[: len(line) - len(stripped)]
            out.append(indent + stripped[1:])
        else:
            out.append(line)
    return "".join(out)


def rewrite_includegraphics(block: str, slug: str, klass: str) -> str:
    """Adjust the \\includegraphics path + sizing inside an already-uncommented block."""
    # 1) Path: figures/placeholder_X (or figures/X) -> diagrams/X
    block = re.sub(
        r"figures/(?:placeholder_)?([A-Za-z0-9_]+)",
        rf"diagrams/{slug}",
        block,
    )
    # Width replacement is class-specific.
    if klass == "tall":
        block = re.sub(
            r"\[\s*width\s*=\s*[^\]]*\]",
            lambda _: r"[height=0.9\textheight, keepaspectratio]",
            block,
        )
    elif klass == "landscape":
        block = re.sub(
            r"\[\s*width\s*=\s*[^\]]*\]",
            lambda _: r"[width=0.95\linewidth, keepaspectratio]",
            block,
        )
    else:
        block = re.sub(
            r"\[\s*width\s*=\s*[0-9.]+\\textwidth\s*\]",
            lambda _: r"[width=0.85\textwidth, keepaspectratio]",
            block,
        )
    return block


def wrap_landscape(block: str) -> str:
    """Wrap an uncommented figure block in landscape (idempotent — skip if already wrapped)."""
    if "\\begin{landscape}" in block:
        return block
    # Find the \begin{figure}...\end{figure} pair and wrap it.
    m = re.search(r"(\\begin\{figure\}.*?\\end\{figure\})", block, re.DOTALL)
    if not m:
        return block
    wrapped = "\\begin{landscape}\n" + m.group(1) + "\n\\end{landscape}"
    return block[: m.start()] + wrapped + block[m.end():]


def unwrap_landscape(block: str) -> str:
    """If the block is currently wrapped in landscape but shouldn't be, remove it."""
    block = re.sub(r"\\begin\{landscape\}\s*\n", "", block)
    block = re.sub(r"\n\s*\\end\{landscape\}", "", block)
    return block


def main() -> None:
    src = REPORT.read_text()
    new = []
    cursor = 0
    inserted = 0
    skipped = 0
    landscape_count = 0
    tall_count = 0

    # We need to find both commented blocks AND already-uncommented landscape
    # blocks (the 2 we authored manually for general UC + DB schema).
    # Strategy: walk the file by commented block; for each, decide if any
    # `\includegraphics{figures/placeholder_X}` reference points at an existing PNG.
    for m in FIGURE_BLOCK.finditer(src):
        block_text = m.group(0)
        # Find every includegraphics path inside the commented block.
        path_match = re.search(
            r"figures/(?:placeholder_)?([A-Za-z0-9_]+)", block_text
        )
        if not path_match:
            new.append(src[cursor: m.end()])
            cursor = m.end()
            continue
        slug = path_match.group(1)
        if slug.startswith("placeholder_"):
            slug = slug[len("placeholder_"):]
        png = DIAGRAMS / f"{slug}.png"
        if not png.exists():
            # Pending — leave commented, unchanged.
            new.append(src[cursor: m.end()])
            cursor = m.end()
            skipped += 1
            continue

        # Existing PNG — uncomment, rewrite path, choose sizing.
        dim = png_dimensions(png)
        klass = classify(dim) if dim else "normal"
        uncommented = uncomment(block_text)
        uncommented = rewrite_includegraphics(uncommented, slug, klass)

        # Was the original block already wrapped in landscape?
        # The commented block can contain "% \begin{landscape}".
        # In that case `uncomment` already produced a real \begin{landscape}.
        was_landscape_block = "\\begin{landscape}" in uncommented

        if klass == "landscape" and not was_landscape_block:
            uncommented = wrap_landscape(uncommented)
            landscape_count += 1
        elif klass != "landscape" and was_landscape_block:
            uncommented = unwrap_landscape(uncommented)
        if klass == "landscape":
            landscape_count += 1 if not was_landscape_block else 0
        if klass == "tall":
            tall_count += 1

        # The `[FIGURE NEEDED: ... ]` annotation served as a writing note.
        # Now that the figure is in, drop it entirely (single or multi-line).
        uncommented = re.sub(
            r"^\s*\[FIGURE NEEDED:.*?\]\s*\n",
            "",
            uncommented,
            count=1,
            flags=re.DOTALL | re.MULTILINE,
        )

        new.append(src[cursor: m.start()])
        new.append(uncommented)
        cursor = m.end()
        inserted += 1

    new.append(src[cursor:])
    REPORT.write_text("".join(new))
    print(
        f"inserted={inserted}  skipped(pending)={skipped}  "
        f"landscape={landscape_count}  tall={tall_count}"
    )


if __name__ == "__main__":
    main()
