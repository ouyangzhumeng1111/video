"""Narration: offline Kokoro v1.1-zh (sid 60, low calm male voice).

Each line is synthesised, trimmed, fitted inside its segment window and
placed on a 60 s timeline. Writes vo.wav (48 kHz mono), vo_timing.json and
subtitle files (SRT + ASS). Every placed line is transcribed back with
SenseVoice as a pronunciation check.
"""
import json
import os
import re
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

sys.path.insert(0, os.path.dirname(__file__))
from narration import SEGMENTS, TTS_OVERRIDE  # noqa: E402
from tts_common import cer, load_asr, load_tts, transcribe  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "output")
SR_OUT = 48000
TOTAL = 60.0
SID = 60
BASE_SPEED = 0.94  # a touch slower than default: calm, room to breathe

# (lead-in after segment start, latest end before next segment) per segment
LEAD = [0.9, 0.55, 0.55, 0.55, 0.45, 0.55, 0.55, 1.1]
TAIL_GAP = 0.35


def trim(x, sr, thr=0.012, pad=0.04):
    env = np.convolve(np.abs(x), np.ones(int(0.01 * sr)) / int(0.01 * sr), "same")
    idx = np.where(env > thr)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


def pauses(x, sr, min_len=0.1, thr=0.015):
    """Return centres (s) of silent gaps inside the clip."""
    win = int(0.01 * sr)
    env = np.convolve(np.abs(x), np.ones(win) / win, "same")
    quiet = env < thr
    gaps, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) / sr >= min_len and i > 0 and j < len(quiet):
                gaps.append(((i + j) / 2) / sr)
            i = j
        else:
            i += 1
    return gaps


def split_cues(text):
    """Split a narration line into subtitle chunks at punctuation, merging
    very short pieces. Returns list of chunk strings (punctuation removed)."""
    parts = [p for p in re.split(r"[，。？！、]", text) if p.strip()]
    out = []
    for p in parts:
        if out and (len(out[-1]) + len(p) <= 12 or len(p) <= 3):
            out[-1] = out[-1] + " " + p
        else:
            out.append(p)
    return out


def fmt_srt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def fmt_ass(t):
    cs = int(round(t * 100))
    return f"{cs // 360000:d}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def main():
    os.makedirs(OUT, exist_ok=True)
    tts = load_tts()
    asr = load_asr()
    sr = tts.sample_rate
    track = np.zeros(int(TOTAL * sr), dtype=np.float32)
    timing, cues = [], []
    for i, (t0, t1, _cap, line) in enumerate(SEGMENTS):
        start = t0 + LEAD[i]
        avail = t1 - TAIL_GAP - start
        say, speed = TTS_OVERRIDE.get(i + 1, (line, BASE_SPEED))
        for _ in range(4):
            x = np.array(tts.generate(say, sid=SID, speed=speed).samples, dtype=np.float32)
            x = trim(x, sr)
            dur = len(x) / sr
            if dur <= avail:
                break
            speed *= dur / avail * 1.02
        # gentle fades at the clip edges
        f = int(0.015 * sr)
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
        a = int(start * sr)
        track[a:a + len(x)] += x[: len(track) - a]
        pad = np.concatenate([np.zeros(int(0.4 * sr), np.float32), x, np.zeros(int(0.4 * sr), np.float32)])
        hyp = transcribe(asr, pad, sr)
        c = cer(line, hyp)
        timing.append({"seg": i + 1, "start": round(start, 3), "end": round(start + dur, 3), "speed": round(speed, 3), "text": line, "asr": hyp, "cer": round(c, 3)})
        print(f"seg {i + 1}: {start:6.2f}–{start + dur:6.2f}s (window ends {t1 - TAIL_GAP:.2f}) speed {speed:.2f} cer {c:.2f} | {hyp}")

        # subtitle cues aligned to detected pauses
        chunks = split_cues(line)
        gaps = pauses(x, sr)
        total_chars = sum(len(c.replace(" ", "")) for c in chunks)
        bounds, used, acc = [], -1, 0
        for ch in chunks[:-1]:
            acc += len(ch.replace(" ", ""))
            expect = dur * acc / total_chars
            cand = [(abs(g - expect), k) for k, g in enumerate(gaps) if k > used]
            if cand and min(cand)[0] < 0.6:
                _, k = min(cand)
                used = k
                bounds.append(gaps[k])
            else:
                bounds.append(expect)
        edges = [0.0] + bounds + [dur]
        for k, ch in enumerate(chunks):
            cues.append((start + edges[k], start + edges[k + 1] + (0.15 if k == len(chunks) - 1 else 0.0), ch))

    # level: normalise speech RMS (active parts) to about -20 dBFS, peak-safe
    act = track[np.abs(track) > 0.01]
    rms = np.sqrt(np.mean(act ** 2)) if len(act) else 1.0
    track *= 10 ** (-20 / 20) / rms
    peak = np.max(np.abs(track))
    if peak > 0.89:
        track *= 0.89 / peak
    y = resample_poly(track, SR_OUT, sr).astype(np.float32)
    wavfile.write(os.path.join(OUT, "vo.wav"), SR_OUT, y)

    with open(os.path.join(OUT, "vo_timing.json"), "w", encoding="utf-8") as fh:
        json.dump(timing, fh, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT, "narration.srt"), "w", encoding="utf-8") as fh:
        for n, (a, b, s) in enumerate(cues, 1):
            fh.write(f"{n}\n{fmt_srt(a)} --> {fmt_srt(b)}\n{s}\n\n")
    ass_head = """[Script Info]
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
    with open(os.path.join(OUT, "narration.ass"), "w", encoding="utf-8") as fh:
        fh.write(ass_head)
        for a, b, s in cues:
            style = "VOLight" if a >= 55.9 else "VO"  # brand card is warm white
            fh.write(f"Dialogue: 0,{fmt_ass(a)},{fmt_ass(b)},{style},,0,0,0,,{{\\fad(120,120)}}{s}\n")
    print("wrote vo.wav, vo_timing.json, narration.srt/.ass;", len(cues), "cues")


if __name__ == "__main__":
    main()
