"""Mix narration over music + SFX with ducking; output 48 kHz stereo WAV.

Usage: mix.py [vo.wav] [mix_premaster.wav]  (file names inside output/)

Loudness is finalised with ffmpeg loudnorm in build.sh (-16 LUFS, -1.5 dBTP).
"""
import os

import numpy as np
from scipy.io import wavfile

OUT = os.path.join(os.path.dirname(__file__), "..", "output")
SR = 48000


def load(name):
    sr, x = wavfile.read(os.path.join(OUT, name))
    assert sr == SR, (name, sr)
    if np.issubdtype(x.dtype, np.integer):  # PCM -> [-1, 1]
        x = x.astype(np.float32) / float(np.iinfo(x.dtype).max + 1)
    x = x.astype(np.float32)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    return x


def follower(x, att=0.03, rel=0.35):
    """Peak envelope with separate attack/release (seconds)."""
    a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    env = np.zeros_like(x)
    e = 0.0
    for i, v in enumerate(x):
        c = a if v > e else r
        e = c * e + (1 - c) * v
        env[i] = e
    return env


def main(vo_name="vo.wav", out_name="mix_premaster.wav"):
    vo, mus, sfx = load(vo_name), load("music.wav"), load("sfx.wav")
    n = max(len(vo), len(mus), len(sfx))
    pad = lambda x: np.pad(x, ((0, n - len(x)), (0, 0)))
    vo, mus, sfx = pad(vo), pad(mus), pad(sfx)

    # envelope on a decimated signal for speed, then upsample
    dec = 48
    v = np.abs(vo[:, 0])[: n // dec * dec].reshape(-1, dec).max(1)
    env = follower(v, att=0.05 / 1, rel=0.45)
    env = np.repeat(env, dec)
    env = np.pad(env, (0, n - len(env)), mode="edge")
    duck_db = -7.5 * np.clip(env / 0.08, 0, 1)  # up to -7.5 dB under speech
    duck = 10 ** (duck_db / 20)

    mix = vo * 1.0 + mus * 0.55 * duck[:, None] + sfx * 0.8
    pk = np.max(np.abs(mix))
    if pk > 0.97:
        mix *= 0.97 / pk
    wavfile.write(os.path.join(OUT, out_name), SR, mix.astype(np.float32))
    print("mix peak", round(float(pk), 3))


if __name__ == "__main__":
    import sys

    main(*sys.argv[1:3])
