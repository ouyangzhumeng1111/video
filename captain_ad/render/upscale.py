"""Local 4K for the Runway clips: Real-ESRGAN general-x4v3 (SRVGGNetCompact, BSD-3) on CPU.

The strong-denoise and weak-denoise weights are interpolated (DENOISE, as Real-ESRGAN's
--denoise_strength does) and 35% of a plain bicubic upscale is mixed back in, so edges get
sharper without the waxy skin a full-strength pass gives AI footage. bf16 on AMX: ~3 s a frame.

  python3 upscale.py [S01 S02 ..]   -> footage/4k/<SHOT>.mp4 (3840x2160, 24 fps, only the frames the edit uses)

Weights: footage/models/realesr-general-x4v3.pth and realesr-general-wdn-x4v3.pth from the
Real-ESRGAN v0.2.5.0 release.
"""
import json
import os
import subprocess
import sys
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
FOOT = os.path.join(ROOT, "footage")
SHOTS = json.load(open(os.path.join(ROOT, "production", "shots.json"), encoding="utf-8"))
W, H, FPS, HANDLE = 3840, 2160, SHOTS["fps"], 0.25
DENOISE = 0.3   # 0 keeps grain/texture, 1 is the full-strength general model
MIX = 0.65      # share of the AI upscale against plain bicubic


class SRVGGNetCompact(nn.Module):
    def __init__(self, feat=64, conv=32, scale=4):
        super().__init__()
        self.scale = scale
        layers = [nn.Conv2d(3, feat, 3, 1, 1), nn.PReLU(feat)]
        for _ in range(conv):
            layers += [nn.Conv2d(feat, feat, 3, 1, 1), nn.PReLU(feat)]
        layers.append(nn.Conv2d(feat, 3 * scale * scale, 3, 1, 1))
        self.body = nn.ModuleList(layers)
        self.up = nn.PixelShuffle(scale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        return self.up(out) + F.interpolate(x, scale_factor=self.scale, mode="nearest")


def load():
    def weights(name):
        sd = torch.load(os.path.join(FOOT, "models", name), map_location="cpu")
        return sd.get("params_ema", sd.get("params", sd))
    strong, weak = weights("realesr-general-x4v3.pth"), weights("realesr-general-wdn-x4v3.pth")
    net = SRVGGNetCompact()
    net.load_state_dict({k: DENOISE * strong[k] + (1 - DENOISE) * weak[k] for k in strong})
    return net.eval().to(memory_format=torch.channels_last)


def frames(src, start, dur):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", src], capture_output=True, text=True, check=True).stdout.strip().split(",")
    w, h = int(probe[0]), int(probe[1])
    p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", src, "-t", f"{dur:.3f}",
                          "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    while True:
        buf = p.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)


def upscale_clip(net, src, out, start, dur):
    enc = None
    n = 0
    t0 = time.time()
    for f in frames(src, start, dur):
        x = (torch.from_numpy(f.copy()).permute(2, 0, 1)[None].float() / 255).contiguous(memory_format=torch.channels_last)
        with torch.inference_mode(), torch.autocast("cpu", dtype=torch.bfloat16):  # AMX makes bf16 ~3x faster
            y = net(x).float()
        y = (MIX * y + (1 - MIX) * F.interpolate(x, scale_factor=4, mode="bicubic")).clamp(0, 1)
        img = (y[0].permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
        if enc is None:
            hh, ww = img.shape[:2]
            # x4 overshoots 4K; scale down to cover 3840x2160 and centre crop (avatar clips are 1088x704)
            vf = f"scale={W}:{H}:flags=lanczos:force_original_aspect_ratio=increase,crop={W}:{H}"
            enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                                    "-s", f"{ww}x{hh}", "-r", str(FPS), "-i", "-", "-vf", vf, "-c:v", "libx264",
                                    "-preset", "veryfast", "-crf", "12", "-pix_fmt", "yuv420p", out + ".part.mp4"], stdin=subprocess.PIPE)
        enc.stdin.write(img.tobytes())
        n += 1
    enc.stdin.close()
    enc.wait()
    os.replace(out + ".part.mp4", out)  # the assembler never sees a half-written clip
    print(f"  {os.path.basename(out)}: {n} frames in {time.time() - t0:.0f}s")


def main(ids):
    torch.set_num_threads(os.cpu_count())
    net = load()
    os.makedirs(os.path.join(FOOT, "4k"), exist_ok=True)
    for s in SHOTS["shots"]:
        if s["kind"] not in ("ai", "ai_lipsync") or (ids and s["id"] not in ids):
            continue
        out = os.path.join(FOOT, "4k", f"{s['id']}.mp4")
        src = os.path.join(FOOT, "clips", f"{s['id']}_ls.mp4")
        src = src if os.path.exists(src) else os.path.join(FOOT, "clips", f"{s['id']}.mp4")
        if os.path.exists(out) or not os.path.exists(src):
            continue
        upscale_clip(net, src, out, s.get("in", 0), s["dur"] + HANDLE)


if __name__ == "__main__":
    main(sys.argv[1:])
