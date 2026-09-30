"""Timbre reference clips for the four speaking roles.

Only the timbre is taken from these clips; CosyVoice3 performs every line from
a natural-language acting instruction. Sources (both Apache-2.0):
  captain  CosyVoice-300M-SFT stock speaker 中文男 (warm mid male)
  boss     Kokoro v1.1-zh sid 101 (deepest male), pitched down 1.5 semitones
  mate     Kokoro v1.1-zh sid 95 (younger, lighter male)
  gunner   Kokoro v1.1-zh sid 76 (rougher, higher male)
Writes audio/voices/<role>_ref.wav (24 kHz mono).
"""
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "trademind_60s", "audio"))
OUT = os.path.join(HERE, "voices")
TEXT = "海上的风向变了，我们今晚就得起航，把货安全送到港口。"


def pitch_shift(x, sr, semis):
    """Resample-based shift then time-restore by overlap-add (formants move a little; fine for a timbre cue)."""
    f = 2 ** (semis / 12)
    y = resample_poly(x, 1000, int(round(1000 * f)))  # slower & lower
    # WSOLA-lite: bring duration back to original by uniform frame dropping/duplication
    win, hop = int(0.04 * sr), int(0.01 * sr)
    n_out = len(x)
    out = np.zeros(n_out + win)
    norm = np.zeros(n_out + win)
    w = np.hanning(win)
    ratio = len(y) / len(x)
    for o in range(0, n_out, hop):
        i = int(o * ratio)
        if i + win > len(y):
            break
        out[o:o + win] += y[i:i + win] * w
        norm[o:o + win] += w
    return (out[:n_out] / np.maximum(norm[:n_out], 1e-3)).astype(np.float32)


def main():
    os.makedirs(OUT, exist_ok=True)
    from tts_common import load_tts
    tts = load_tts()
    for role, sid, semis in (("boss", 101, -1.5), ("mate", 95, 0.0), ("gunner", 76, 0.0)):
        a = tts.generate(TEXT, sid=sid, speed=1.0)
        x = np.array(a.samples, dtype=np.float32)
        if semis:
            x = pitch_shift(x, a.sample_rate, semis)
        x = resample_poly(x, 24000, a.sample_rate).astype(np.float32)
        sf.write(os.path.join(OUT, f"{role}_ref.wav"), x / np.max(np.abs(x)) * 0.7, 24000)
        print(role, round(len(x) / 24000, 2), "s")
    # captain: reuse the SFT 中文男 clip made for the TradeMind v2 narration
    cap = os.path.join(HERE, "..", "..", "trademind_60s", "audio", "voices", "male_ref.wav")
    x, sr = sf.read(cap, dtype="float32")
    sf.write(os.path.join(OUT, "captain_ref.wav"), x / np.max(np.abs(x)) * 0.7, sr)
    print("captain", round(len(x) / sr, 2), "s")


if __name__ == "__main__":
    main()
