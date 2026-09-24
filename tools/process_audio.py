#!/usr/bin/env python3
"""One-off tool used by the audio builder to turn ElevenLabs raw takes in art/audio/raw/
into the final game files in public/audio/. Not part of the build; safe to delete.

Usage: python tools/process_audio.py
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "audio" / "raw"
OUT = ROOT / "public" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

# key -> (is_loop, crossfade_seconds, target_lufs, channels, bitrate)
SFX_ONE_SHOT = [
    "knock", "doorbell", "door_open", "cash", "tip", "deal", "reject",
    "cut_crunch", "bump", "break", "bag_full", "bag_empty", "day_end",
    "level_up", "achievement", "dog_bark", "sprinkler_hit", "gnome_break",
    "click", "hover",
]
SFX_LOOP = {
    "reel_loop": 0.35, "push_loop": 0.4, "zt_loop": 0.4, "trimmer_loop": 0.3,
    "blower_loop": 0.4, "truck_loop": 0.4, "birds_ambience": 1.0, "rain_ambience": 1.2,
}
MUSIC_LOOP = {
    "music_title": 1.2, "music_hub": 1.5, "music_mow": 1.5,
}

TRIM = "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:stop_periods=1:stop_duration=0.3:stop_threshold=-45dB:detection=peak"


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if r.returncode != 0:
        print("FAILED:", " ".join(cmd))
        print(r.stderr[-2000:])
        sys.exit(1)
    return r.stdout


def duration(path: Path) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(out.strip())


def process_one_shot(key: str):
    src = RAW / f"{key}_raw.mp3"
    dst = OUT / f"{key}.mp3"
    if not src.exists():
        print(f"MISSING raw: {src}")
        return
    af = (
        f"{TRIM},"
        "afade=t=in:d=0.008,"
        "areverse,afade=t=in:d=0.02,areverse,"
        "loudnorm=I=-16:TP=-1.5:LRA=11"
    )
    run(["ffmpeg", "-y", "-i", str(src), "-af", af, "-ac", "1", "-ar", "44100", "-b:a", "96k", str(dst)])
    print(f"ok  {key}.mp3  ({dst.stat().st_size} bytes)")


def process_loop(key: str, crossfade: float, mono: bool, bitrate: str, lufs: int):
    src = RAW / f"{key}_raw.mp3"
    dst = OUT / f"{key}.mp3"
    if not src.exists():
        print(f"MISSING raw: {src}")
        return
    tmp = RAW / f"{key}_trimmed.wav"
    run(["ffmpeg", "-y", "-i", str(src), "-af", f"{TRIM},loudnorm=I={lufs}:TP=-1.5:LRA=11", str(tmp)])
    d = duration(tmp)
    c = max(0.08, min(crossfade, d / 3.2))
    mid_end = d - c
    if mid_end <= c:
        # very short clip: skip crossfade, just fade ends softly
        af = "afade=t=in:d=0.02,areverse,afade=t=in:d=0.05,areverse"
        run(["ffmpeg", "-y", "-i", str(tmp), "-af", af, "-ac", "1" if mono else "2", "-ar", "44100", "-b:a", bitrate, str(dst)])
    else:
        filt = (
            f"[0:a]atrim=0:{c:.3f},asetpts=PTS-STARTPTS[head];"
            f"[0:a]atrim={mid_end:.3f}:{d:.3f},asetpts=PTS-STARTPTS[tail];"
            f"[0:a]atrim={c:.3f}:{mid_end:.3f},asetpts=PTS-STARTPTS[mid];"
            f"[tail][head]acrossfade=d={c:.3f}:c1=tri:c2=tri[seam];"
            f"[mid][seam]concat=n=2:v=0:a=1[out]"
        )
        run([
            "ffmpeg", "-y", "-i", str(tmp), "-filter_complex", filt, "-map", "[out]",
            "-ac", "1" if mono else "2", "-ar", "44100", "-b:a", bitrate, str(dst),
        ])
    tmp.unlink(missing_ok=True)
    print(f"ok  {key}.mp3  ({dst.stat().st_size} bytes, loop {d - c:.2f}s, crossfade {c:.2f}s)")


def main():
    for key in SFX_ONE_SHOT:
        process_one_shot(key)
    for key, cf in SFX_LOOP.items():
        process_loop(key, cf, mono=True, bitrate="96k", lufs=-16)
    for key, cf in MUSIC_LOOP.items():
        process_loop(key, cf, mono=False, bitrate="128k", lufs=-18)

    total = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"\nTotal public/audio size: {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
