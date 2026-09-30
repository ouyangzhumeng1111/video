"""Place CosyVoice narration takes on the narration-driven edit timeline.

Reads output/takes/*.wav + takes.json, builds output/timeline.json, then per
voice writes output/vo_<voice>.wav (48 kHz mono), narration_<voice>.srt/.ass
and vo_timing_<voice>.json.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import timeline  # noqa: E402
from make_vo import fmt_ass, fmt_srt, pauses, split_cues, trim  # noqa: E402
from narration import SEGMENTS  # noqa: E402

OUT = os.path.join(HERE, "..", "output")
TAKES = os.path.join(OUT, "takes")
SR_OUT = 48000
VOICES = ["male", "female"]

ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: VO,Noto Sans CJK SC Medium,38,&H00F0F4F6,&H000000FF,&H80180B03,&H64000000,0,0,0,0,100,100,1,0,1,1.6,1.2,2,80,80,46,1
Style: VOLight,Noto Sans CJK SC Medium,38,&H0046210B,&H000000FF,&H00E8F1F6,&H00000000,0,0,0,0,100,100,1,0,1,0,0,2,80,80,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def load_take(voice, i):
    x, sr = sf.read(os.path.join(TAKES, f"{voice}_{i}.wav"), dtype="float32")
    x = trim(x, sr, thr=0.01 * max(1e-3, np.max(np.abs(x))) / 0.5)
    f = int(0.012 * sr)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x, sr


def main():
    takes = {v: [load_take(v, i) for i in range(1, 9)] for v in VOICES}
    durs = [max(len(takes[v][i][0]) / takes[v][i][1] for v in VOICES) for i in range(8)]
    tl = timeline.build(durs)
    white_at = timeline.o2n(56.0, tl)  # brand card turns warm white here
    print("segments:", [round(b - a, 2) for a, b in zip(tl["new"], tl["new"][1:])], "total", tl["total"])
    for v in VOICES:
        sr = takes[v][0][1]
        track = np.zeros(int((tl["total"] + 0.5) * sr), np.float32)
        cues, timing = [], []
        for i, (x, _) in enumerate(takes[v]):
            line = SEGMENTS[i][3]
            start = tl["vo_start"][i]
            # even out line-to-line level (active-speech RMS)
            act = x[np.abs(x) > 0.02 * np.max(np.abs(x))]
            x = x * (0.1 / max(1e-6, np.sqrt(np.mean(act ** 2))))
            a = int(start * sr)
            track[a:a + len(x)] += x
            dur = len(x) / sr
            timing.append({"seg": i + 1, "start": round(start, 3), "end": round(start + dur, 3), "text": line})
            chunks = split_cues(line)
            gaps = pauses(x / np.max(np.abs(x)) * 0.5, sr)
            total_chars = sum(len(c.replace(" ", "")) for c in chunks)
            bounds, used, acc = [], -1, 0
            for ch in chunks[:-1]:
                acc += len(ch.replace(" ", ""))
                expect = dur * acc / total_chars
                cand = [(abs(g - expect), k) for k, g in enumerate(gaps) if k > used]
                if cand and min(cand)[0] < 0.5:
                    _, k = min(cand)
                    used = k
                    bounds.append(gaps[k])
                else:
                    bounds.append(expect)
            edges = [0.0] + bounds + [dur]
            for k, ch in enumerate(chunks):
                cues.append((start + edges[k], start + edges[k + 1] + (0.2 if k == len(chunks) - 1 else 0.0), ch))
        peak = np.max(np.abs(track))
        track *= 0.89 / peak
        y = resample_poly(track, SR_OUT, sr).astype(np.float32)
        sf.write(os.path.join(OUT, f"vo_{v}.wav"), y, SR_OUT)
        with open(os.path.join(OUT, f"vo_timing_{v}.json"), "w", encoding="utf-8") as fh:
            json.dump(timing, fh, ensure_ascii=False, indent=2)
        with open(os.path.join(OUT, f"narration_{v}.srt"), "w", encoding="utf-8") as fh:
            for n, (a, b, s) in enumerate(cues, 1):
                fh.write(f"{n}\n{fmt_srt(a)} --> {fmt_srt(b)}\n{s}\n\n")
        with open(os.path.join(OUT, f"narration_{v}.ass"), "w", encoding="utf-8") as fh:
            fh.write(ASS_HEAD)
            for a, b, s in cues:
                style = "VOLight" if a >= white_at - 0.1 else "VO"
                fh.write(f"Dialogue: 0,{fmt_ass(a)},{fmt_ass(b)},{style},,0,0,0,,{{\\fad(100,100)}}{s}\n")
        print(v, "->", [(t["seg"], t["start"], t["end"]) for t in timing])


if __name__ == "__main__":
    main()
