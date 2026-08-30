#!/usr/bin/env python3
"""
generate_portrait.py

Converts a photo into a dot-matrix portrait SVG: a grid of colored dots
sized by local brightness, that reveal row-by-row on load (matching the
style of the reference portrait.svg).

Usage:
    python3 generate_portrait.py input.png output.svg --cols 60 --circle

Options:
    --cols N        number of dot columns (rows auto-computed to keep aspect) [default 60]
    --circle        crop the portrait into a circle (like a profile photo)
    --invert        make brighter areas = smaller dots instead of larger
    --bg COLOR      background hex color, default #000000
    --row-delay S   seconds between each row's reveal animation start [default 0.025]
"""
import argparse
import base64
from io import BytesIO
from PIL import Image, ImageOps, ImageEnhance


def build_svg(img: Image.Image, cols: int, circle: bool, invert: bool,
              bg: str, row_delay: float, min_radius_frac: float = 0.35,
              gamma: float = 1.0) -> str:
    img = img.convert("RGB")
    w, h = img.size
    cell = w / cols
    rows = max(1, round(h / cell))
    cell_h = h / rows

    if circle:
        # crop to a centered square first
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
        w = h = side
        cell = w / cols
        rows = cols
        cell_h = cell

    small = img.resize((cols, rows), Image.LANCZOS)
    px = small.load()

    out_w, out_h = 1016, 1016  # match reference canvas size
    scale_x = out_w / cols
    scale_y = out_h / rows

    style = [
        "@keyframes rv{from{opacity:0}to{opacity:1}}",
        ".rw{animation:rv 0.45s ease-out both}",
    ]
    for r in range(rows):
        style.append(f".r{r}{{animation-delay:{r*row_delay:.3f}s}}")

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {out_w} {out_h}" '
        f'width="{out_w}" height="{out_h}" role="img" aria-label="dot-matrix portrait">'
        f'<style>{"".join(style)}</style>'
        f'<rect width="{out_w}" height="{out_h}" fill="{bg}"/>'
    ]

    if circle:
        cx = cy = out_w / 2
        r = out_w / 2
        parts.append(f'<clipPath id="clip"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>')
        parts.append('<g clip-path="url(#clip)">')

    for ry in range(rows):
        cy_out = (ry + 0.5) * scale_y
        for cx_i in range(cols):
            r_, g_, b_ = px[cx_i, ry]
            brightness = (0.299 * r_ + 0.587 * g_ + 0.114 * b_) / 255
            brightness = brightness ** (1 / gamma)  # gamma>1 lifts shadows
            if invert:
                brightness = 1 - brightness
            max_r = min(scale_x, scale_y) / 2
            # floor so shadow/dark-red areas still get a visible, colored dot
            # instead of vanishing into the black background
            radius = max_r * (min_radius_frac + (1 - min_radius_frac) * brightness)
            if r_ + g_ + b_ < 6:
                continue  # only skip truly pure-black pixels
            cx_out = (cx_i + 0.5) * scale_x
            color = f"#{r_:02x}{g_:02x}{b_:02x}"
            parts.append(
                f'<circle class="rw r{ry}" cx="{cx_out:.1f}" cy="{cy_out:.1f}" '
                f'r="{radius:.2f}" fill="{color}"/>'
            )

    if circle:
        parts.append("</g>")
    parts.append("</svg>")
    return "".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--cols", type=int, default=60)
    ap.add_argument("--circle", action="store_true")
    ap.add_argument("--invert", action="store_true")
    ap.add_argument("--bg", default="#000000")
    ap.add_argument("--row-delay", type=float, default=0.025)
    ap.add_argument("--min-radius", type=float, default=0.35,
                     help="fraction of max dot size used as a floor, keeps shadows visible (0-1)")
    ap.add_argument("--gamma", type=float, default=1.6,
                     help=">1 lifts shadow detail so dark photos don't render as mostly-empty grid")
    ap.add_argument("--saturation", type=float, default=1.25)
    ap.add_argument("--contrast", type=float, default=1.15)
    ap.add_argument("--brightness", type=float, default=1.15)
    args = ap.parse_args()

    img = Image.open(args.input)
    img = ImageOps.exif_transpose(img)  # respect phone camera rotation

    if args.saturation != 1.0:
        img = ImageEnhance.Color(img).enhance(args.saturation)
    if args.contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(args.contrast)
    if args.brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(args.brightness)

    svg = build_svg(img, args.cols, args.circle, args.invert, args.bg,
                     args.row_delay, args.min_radius, args.gamma)

    with open(args.output, "w") as f:
        f.write(svg)
    print(f"Wrote {args.output} ({len(svg)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
