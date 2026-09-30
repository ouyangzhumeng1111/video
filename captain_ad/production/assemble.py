"""Cut 《船长的底牌》 from shots.json.

For each shot the best available source is used:
  footage/4k/<id>.mp4  >  footage/clips/<id>_ls.mp4 / <id>.mp4 (upscaled)
  >  footage/keys/<id>.png (slow push-in)  >  a text slate (animatic)
render_ui / endcard shots use the rendered 4K inserts in output/.
AI footage gets a light teal/amber grade and matching grain.

Audio: output/music.wav + sfx.wav + dialogue.wav from audio/sound_design.py,
music ducked under dialogue, loudness -16 LUFS / -1.5 dBTP.

  python3 assemble.py --res 1080 --out captain_animatic_1080p.mp4   # review cut
  python3 assemble.py --res 2160 --out captain_4k.mp4 --subs        # final (+ burned subtitles)
"""
import argparse
import json
import os
import subprocess

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "output")
FOOT = os.path.join(ROOT, "footage")
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc"
GRADE = "eq=contrast=1.06:saturation=0.92:gamma=0.97,colorbalance=rs=-0.03:gs=-0.01:bs=0.04:rh=0.05:gh=0.01:bh=-0.04"
WHO = {"CAPTAIN": "船长", "BOSS": "海盗头目", "MATE": "大副", "GUNNER": "海盗手下"}


def sh(cmd):
    subprocess.run(cmd, check=True)


def slate(s, w, h, path):
    im = Image.new("RGB", (w, h), (8, 12, 20))
    d = ImageDraw.Draw(im)
    k = w / 1920
    f1, f2, f3 = (ImageFont.truetype(FONT, int(v * k)) for v in (30, 44, 36))
    d.text((120 * k, 110 * k), f"{s['id']}  ·  {s['t']:.1f}–{s['t'] + s['dur']:.1f}s  ·  待生成镜头", font=f1, fill=(217, 179, 115))
    y = 220 * k
    txt = s["zh"]
    line = ""
    for ch in txt:  # wrap
        if d.textlength(line + ch, font=f2) > w - 240 * k:
            d.text((120 * k, y), line, font=f2, fill=(236, 230, 218)); y += 66 * k; line = ""
        line += ch
    d.text((120 * k, y), line, font=f2, fill=(236, 230, 218))
    if "line" in s:
        d.text((120 * k, y + 110 * k), f"{WHO[s['line']['who']]}：「{s['line']['text']}」", font=f3, fill=(255, 224, 160))
    im.save(path)


def source(s):
    if s["kind"] == "render_ui":
        return ("video", os.path.join(OUT, "insert_ui_4k.mp4"))
    if s["kind"] == "endcard":
        return ("video", os.path.join(OUT, "insert_end_4k.mp4"))
    for p in (f"4k/{s['id']}.mp4", f"clips/{s['id']}_ls.mp4", f"clips/{s['id']}.mp4"):
        if os.path.exists(os.path.join(FOOT, p)):
            return ("ai", os.path.join(FOOT, p))
    for p in (f"keys/{s['id']}.png", f"keys/{s['id']}_0.png"):
        if os.path.exists(os.path.join(FOOT, p)):
            return ("key", os.path.join(FOOT, p))
    return ("slate", None)


def segment(s, w, h, fps, crf, tmp):
    kind, src = source(s)
    out = os.path.join(tmp, f"{s['id']}.mp4")
    dur = f"{s['dur']:.3f}"
    enc = ["-an", "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p", "-r", str(fps), out]
    grain = f"noise=c0s={4 if h > 1500 else 3}:c0f=t"
    if kind in ("video", "ai"):
        vf = f"scale={w}:{h}:flags=lanczos:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}"
        vf += ("," + GRADE if kind == "ai" else "") + "," + grain
        sh(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(s.get("in", 0)), "-t", dur, "-i", src, "-vf", vf, "-t", dur] + enc)
    elif kind == "key":
        n = int(round(s["dur"] * fps))
        vf = f"scale={w * 2}:{h * 2}:flags=lanczos,zoompan=z='1+0.06*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={w}x{h}:fps={fps},{GRADE},{grain}"
        sh(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", src, "-vf", vf, "-frames:v", str(n)] + enc)
    else:
        png = os.path.join(tmp, f"{s['id']}.png")
        slate(s, w, h, png)
        sh(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", dur, "-i", png, "-vf", f"fps={fps}"] + enc)
    return out, kind


def mix(dur):
    def load(n):
        x, sr = sf.read(os.path.join(OUT, n), dtype="float32", always_2d=True)
        return x
    mus, sfx, dlg = load("music.wav"), load("sfx.wav"), load("dialogue.wav")
    n = int(dur * 48000)
    fit = lambda x: np.pad(x, ((0, max(0, n - len(x))), (0, 0)))[:n]
    mus, sfx, dlg = fit(mus), fit(sfx), fit(dlg)
    e = np.abs(dlg).max(1)
    k = int(0.02 * 48000)
    e = np.convolve(e, np.ones(k) / k, "same")
    a = np.zeros_like(e)
    v = 0.0
    for i in range(0, n, 48):  # slow release follower, decimated
        v = max(e[i], v * 0.985)
        a[i:i + 48] = v
    duck = 10 ** (-6.0 * np.clip(a / 0.05, 0, 1) / 20)
    x = dlg * 1.0 + sfx * 0.9 + mus * 0.8 * duck[:, None]
    x *= 0.95 / max(1e-6, np.abs(x).max())
    pre = os.path.join(OUT, "mix_premaster.wav")
    sf.write(pre, x, 48000, subtype="FLOAT")
    final = os.path.join(OUT, "mix_final.wav")
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", pre, "-af", "loudnorm=I=-16:TP=-1.5:LRA=14", "-ar", "48000", "-c:a", "pcm_s24le", final])
    return final


def subs(shots, path):
    head = ("[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: D,Noto Sans CJK SC Medium,40,&H00F2F2F2,&H000000FF,&H96000000,&H64000000,0,0,0,0,100,100,1,0,1,1.6,1.4,2,80,80,70,1\n\n"
            "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    lines = json.load(open(os.path.join(ROOT, "audio", "lines", "lines.json"), encoding="utf-8"))
    ts = lambda t: f"{int(t // 3600)}:{int(t // 60) % 60:02d}:{t % 60:05.2f}"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(head)
        for s in shots:
            if "line" in s and s["id"] in lines:
                a = s["t"] + s["line"].get("offset", 0.15) + (0.6 if s["line"].get("offscreen") else 0)
                b = a + lines[s["id"]]["dur"] + 0.2
                fh.write(f"Dialogue: 0,{ts(a)},{ts(b)},D,,0,0,0,,{{\\fad(80,80)}}{s['line']['text']}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", type=int, default=1080)
    ap.add_argument("--out", default=None)
    ap.add_argument("--subs", action="store_true")
    a = ap.parse_args()
    d = json.load(open(os.path.join(HERE, "shots.json"), encoding="utf-8"))
    h = a.res; w = h * 16 // 9; fps = d["fps"]
    tmp = os.path.join(OUT, f"seg_{h}")
    os.makedirs(tmp, exist_ok=True)
    kinds = {}
    with open(os.path.join(tmp, "list.txt"), "w") as fh:
        for s in d["shots"]:
            p, k = segment(s, w, h, fps, 12 if h > 1500 else 18, tmp)
            kinds[k] = kinds.get(k, 0) + 1
            fh.write(f"file '{os.path.basename(p)}'\n")
    pic = os.path.join(tmp, "picture.mp4")
    sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(tmp, "list.txt"), "-c", "copy", pic])
    audio = mix(d["duration"])
    out = os.path.join(OUT, a.out or (f"captain_{h}p.mp4"))
    vf = []
    if a.subs:
        ass = os.path.join(OUT, "dialogue_subs.ass")
        subs(d["shots"], ass)
        vf = ["-vf", f"ass={ass}"]
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", pic, "-i", audio, "-map", "0:v", "-map", "1:a"] + vf +
       ["-c:v", "libx264", "-preset", "slow", "-crf", "16" if h > 1500 else "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", "-shortest", out])
    print("wrote", out, "sources:", kinds)


if __name__ == "__main__":
    main()
