"""Edit timeline driven by the narration.

The picture was authored on an 8-segment, 60 s "design" timeline (OLD). Each
segment is re-cut to fit its narration line: lead-in + line + breath, rounded
up to the 120 BPM beat grid (0.5 s) with a per-segment minimum so the visuals
still read. Everything (picture, captions, music, SFX) maps design time to
edit time with the same piecewise-linear warp.

Writes output/timeline.json:
  old / new: segment boundaries (s), vo_start: narration entry per segment,
  total: film length (s).
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "output")
OLD = [0.0, 6.0, 13.0, 21.0, 29.0, 37.0, 45.0, 53.0, 60.0]
LEAD = [0.6, 0.45, 0.45, 0.45, 0.4, 0.45, 0.45, 0.8]
MIN_LEN = [5.0, 5.5, 6.0, 5.5, 6.0, 5.5, 6.0, 7.0]
BREATH = 0.6
BEAT = 0.5


def build(durations):
    """durations: narration length (s) per segment, 8 values."""
    new = [0.0]
    for i, d in enumerate(durations):
        need = LEAD[i] + d + BREATH
        seg = max(MIN_LEN[i], math.ceil(need / BEAT - 1e-9) * BEAT)
        if i == 7:
            seg = MIN_LEN[7]  # brand card: fixed, last 3 s static
            assert LEAD[7] + d <= seg - 0.5, "brand line too long for end card"
        new.append(round(new[-1] + seg, 3))
    tl = {"old": OLD, "new": new, "vo_start": [round(new[i] + LEAD[i], 3) for i in range(8)], "total": new[-1]}
    with open(os.path.join(OUT, "timeline.json"), "w") as fh:
        json.dump(tl, fh, indent=2)
    return tl


def load():
    with open(os.path.join(OUT, "timeline.json")) as fh:
        return json.load(fh)


def warp(t, src, dst):
    """Piecewise-linear map of time t from boundaries src to boundaries dst."""
    if t <= src[0]:
        return dst[0] + (t - src[0])
    for i in range(len(src) - 1):
        if t <= src[i + 1]:
            k = (t - src[i]) / (src[i + 1] - src[i])
            return dst[i] + k * (dst[i + 1] - dst[i])
    return dst[-1] + (t - src[-1])


def o2n(t, tl=None):
    tl = tl or load()
    return warp(t, tl["old"], tl["new"])
