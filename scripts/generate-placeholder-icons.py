"""
Privremena ikona i splash (korak 13c): narančasti orb na tamnoj pozadini.
Pokretanje: python3 scripts/generate-placeholder-icons.py  (treba Pillow).
Boje iz palete u src/core/theme/tokens.ts (ink950, flame300/400/600).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
BACKGROUND = (0x0B, 0x0B, 0x10, 255)  # ink950
CORE = (0xFF, 0xE2, 0xB8)  # svijetla jezgra
MID = (0xFF, 0x9F, 0x43)  # flame400
EDGE = (0xC2, 0x5E, 0x00)  # flame600


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def orb(size: int, radius_ratio: float, glow: bool = True, mono: bool = False) -> Image.Image:
    """Kvadratna slika s orbom u sredini na prozirnoj pozadini."""
    scale = 4  # supersampling za glatke rubove
    big = size * scale
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    cx = cy = big / 2
    radius = big * radius_ratio / 2

    if glow:
        halo = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        draw = ImageDraw.Draw(halo)
        r = radius * 1.35
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*MID, 110))
        halo = halo.filter(ImageFilter.GaussianBlur(radius * 0.35))
        image.alpha_composite(halo)

    disc = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(disc)
    steps = 160
    # Koncentrični krugovi od ruba prema jezgri (jezgra malo iznad središta, kao plamen).
    for i in range(steps):
        t = i / (steps - 1)
        r = radius * (1 - t)
        oy = -radius * 0.18 * t
        if mono:
            color = (255, 255, 255, 255)
        elif t < 0.55:
            color = (*lerp(EDGE, MID, t / 0.55), 255)
        else:
            color = (*lerp(MID, CORE, (t - 0.55) / 0.45), 255)
        draw.ellipse((cx - r, cy + oy - r, cx + r, cy + oy + r), fill=color)
    image.alpha_composite(disc)
    return image.resize((size, size), Image.LANCZOS)


def on_background(size: int, radius_ratio: float) -> Image.Image:
    base = Image.new("RGBA", (size, size), BACKGROUND)
    base.alpha_composite(orb(size, radius_ratio))
    return base


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    on_background(1024, 0.5).save(OUT / "icon.png")
    # Android adaptive: sigurna zona je središnjih 66 %.
    orb(512, 0.42).save(OUT / "android-icon-foreground.png")
    Image.new("RGBA", (512, 512), BACKGROUND).save(OUT / "android-icon-background.png")
    orb(432, 0.42, glow=False, mono=True).save(OUT / "android-icon-monochrome.png")
    orb(512, 0.6).save(OUT / "splash-icon.png")
    on_background(48, 0.6).save(OUT / "favicon.png")


if __name__ == "__main__":
    main()
