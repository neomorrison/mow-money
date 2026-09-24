"""Convert raw kie.ai downloads (art/raw/) into the final game assets under public/img/.

Portraits and staff -> 512x512 WebP quality 82 (center-crop to square first if needed).
title_bg / hub_bg -> 1920x1080 WebP quality 80 (center-crop to 16:9 first if needed).
logo -> alpha-preserving WebP, transparent borders trimmed, max width 1200.
owner -> 512x512 WebP quality 82.

Run from the project root: python art/2d/convert.py
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "art", "raw")
PORTRAITS_OUT = os.path.join(ROOT, "public", "img", "portraits")
STAFF_OUT = os.path.join(ROOT, "public", "img", "staff")
IMG_OUT = os.path.join(ROOT, "public", "img")

os.makedirs(PORTRAITS_OUT, exist_ok=True)
os.makedirs(STAFF_OUT, exist_ok=True)
os.makedirs(IMG_OUT, exist_ok=True)


def find_raw(key: str) -> str:
    """Find the raw source file for a given output key, trying known extensions/aliases."""
    candidates = [key, f"{key}_anchor"]
    for cand in candidates:
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            p = os.path.join(RAW, cand + ext)
            if os.path.exists(p):
                return p
    raise FileNotFoundError(f"No raw file found for key '{key}' in {RAW}")


def center_crop_to_ratio(img: Image.Image, target_ratio: float) -> Image.Image:
    w, h = img.size
    current_ratio = w / h
    if abs(current_ratio - target_ratio) < 1e-3:
        return img
    if current_ratio > target_ratio:
        # too wide -> crop width
        new_w = int(h * target_ratio)
        x0 = (w - new_w) // 2
        return img.crop((x0, 0, x0 + new_w, h))
    else:
        # too tall -> crop height
        new_h = int(w / target_ratio)
        y0 = (h - new_h) // 2
        return img.crop((0, y0, w, y0 + new_h))


def make_square_webp(key: str, out_dir: str, size: int = 512, quality: int = 82):
    src = find_raw(key)
    img = Image.open(src).convert("RGB")
    img = center_crop_to_ratio(img, 1.0)
    img = img.resize((size, size), Image.LANCZOS)
    out_path = os.path.join(out_dir, f"{key}.webp")
    img.save(out_path, "WEBP", quality=quality)
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes) from {os.path.basename(src)}")


def make_wide_webp(key: str, width: int = 1920, height: int = 1080, quality: int = 80):
    src = find_raw(key)
    img = Image.open(src).convert("RGB")
    img = center_crop_to_ratio(img, width / height)
    img = img.resize((width, height), Image.LANCZOS)
    out_path = os.path.join(IMG_OUT, f"{key}.webp")
    img.save(out_path, "WEBP", quality=quality)
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes) from {os.path.basename(src)}")


def make_logo_webp(raw_name: str = "logo_alpha.png", max_width: int = 1200):
    src = os.path.join(RAW, raw_name)
    img = Image.open(src).convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    if w > max_width:
        new_h = int(h * (max_width / w))
        img = img.resize((max_width, new_h), Image.LANCZOS)
    out_path = os.path.join(IMG_OUT, "logo.webp")
    img.save(out_path, "WEBP", quality=90, lossless=False)
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes) from {raw_name}")


PORTRAIT_KEYS = [
    'p_retiree_1', 'p_retiree_2', 'p_perfectionist_1', 'p_perfectionist_2', 'p_family_1', 'p_family_2',
    'p_penny_1', 'p_penny_2', 'p_hoa_1', 'p_hoa_2', 'p_techie_1', 'p_techie_2', 'p_gardener_1', 'p_gardener_2',
    'p_eco_1', 'p_eco_2', 'p_landlord_1', 'p_landlord_2', 'p_dude_1', 'p_dude_2', 'p_veteran_1', 'p_veteran_2',
    'p_newcouple_1', 'p_newcouple_2', 'p_executive_1', 'p_executive_2',
    'p_facilities_1', 'p_parks_1', 'p_greenskeeper_1',
]
STAFF_PORTRAIT_KEYS = [f"s_{i}" for i in range(1, 11)]

if __name__ == "__main__":
    for key in PORTRAIT_KEYS:
        make_square_webp(key, PORTRAITS_OUT)
    for key in STAFF_PORTRAIT_KEYS:
        make_square_webp(key, STAFF_OUT)
    make_square_webp("owner", IMG_OUT)
    make_wide_webp("title_bg")
    make_wide_webp("hub_bg")
    make_logo_webp()
    print("done")
