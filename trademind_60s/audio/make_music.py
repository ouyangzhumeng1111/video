"""Procedural score + sound design for the 60 s film (48 kHz stereo).

Arc per the brief: low, restrained electronic ambience -> rhythm enters as the
business chain unfolds -> strings join -> bright, confident resolution on the
brand (D minor world resolving to D major as the brand card appears).

Writes output/music.wav and output/sfx.wav (separate stems for the mix).
"""
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline as TL  # noqa: E402

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "output")
rng = np.random.default_rng(7)
_tl = TL.load() if os.path.exists(os.path.join(OUT, "timeline.json")) else {"old": TL.OLD, "new": TL.OLD, "total": 60.0}
B = _tl["new"]  # segment boundaries on the edit timeline
T = _tl["total"]
N = int(SR * T)


def o2n(t):
    return TL.warp(t, _tl["old"], _tl["new"])


HIT = o2n(56.0)  # brand reveal: music resolves as the frame turns warm white


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos"), x, axis=0)


def saw(freq, n, phase0=None):
    """PolyBLEP sawtooth; freq may be scalar or per-sample array."""
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    dt = f / SR
    ph = (np.cumsum(dt) + (rng.random() if phase0 is None else phase0)) % 1.0
    y = 2.0 * ph - 1.0
    m1 = ph < dt
    x = ph[m1] / dt[m1]
    y[m1] -= x + x - x * x - 1.0
    m2 = ph > 1.0 - dt
    x = (ph[m2] - 1.0) / dt[m2]
    y[m2] -= x * x + x + x + 1.0
    return y


def env_ar(n, a, r, sustain_end=None):
    """Linear-ish attack, hold, cosine release. a, r in seconds."""
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    nr = max(1, int(r * SR))
    if nr < n:
        e[-nr:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nr))
    return e


def place(buf, sig, t0, pan=0.0):
    a = int(round(t0 * SR))
    if a >= len(buf):
        return
    if a < 0:
        sig = sig[-a:]
        a = 0
    sig = sig[: len(buf) - a]
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        buf[a:a + len(sig), 0] += sig * l * 1.414
        buf[a:a + len(sig), 1] += sig * r * 1.414
    else:
        buf[a:a + len(sig)] += sig


# ------------------------------------------------------------------ harmony
D2, F2, G2, A2, Bb2, C2 = 38, 41, 43, 45, 46, 36
CH = {
    "Dm": (D2, [50, 53, 57, 64]),
    "Bb": (Bb2, [50, 53, 58, 60]),
    "F": (F2, [53, 57, 60, 67]),
    "C": (C2 + 12, [52, 55, 60, 62]),
    "Gm": (G2, [50, 55, 58, 62]),
    "D": (D2, [50, 54, 57, 64]),
}
SECTIONS = [  # (start, end, chord cycle) on the edit timeline
    (B[2], B[4], ["Dm", "Bb", "F", "C"]),
    (B[4], B[5], ["Bb", "C", "Dm", "F"]),
    (B[5], B[6], ["Gm", "Bb", "F", "C"]),
    (B[6], HIT - 3.2, ["Bb", "C", "Dm", "C"]),
]
PROG = [(0.0, o2n(9.5), "Dm"), (o2n(9.5), B[2], "Bb")]
for a, b, cyc in SECTIONS:
    t, k = a, 0
    while t < b - 0.25:
        PROG.append((t, min(b, t + 2.0), cyc[k % len(cyc)]))
        t += 2.0
        k += 1
PROG += [(HIT - 3.2, HIT - 1.6, "Bb"), (HIT - 1.6, HIT, "C"), (HIT, T, "D")]
MEL = {"Gm": 74, "Bb": 74, "F": 72, "C": 76, "Dm": 77, "D": 78}
MELODY = [(a, MEL[c]) for a, b, c in PROG if a >= B[5] - 1e-6]


def chord_at(tt):
    for a, b, c in PROG:
        if a <= tt < b:
            return c
    return "D"


def main():
    os.makedirs(OUT, exist_ok=True)
    mus = np.zeros((N, 2))
    wet_send = np.zeros((N, 2))
    sfx = np.zeros((N, 2))
    tt = np.arange(N) / SR

    # ---------------------------------------------------------- pads
    for a, b, c in PROG:
        bass, notes = CH[c]
        rel = 0.9 if c != "D" else 0.4
        dur = b - a + rel
        n = int(dur * SR)
        amp = 0.05 if a < B[2] else 0.055 if a < B[4] else 0.06
        voices = np.zeros((n, 2))
        for k, m in enumerate(notes):
            for d, side in ((-7, 0), (0, None), (7, 1)):
                f = hz(m) * 2 ** (d / 1200)
                s = saw(f, n)
                if side is None:
                    voices += s[:, None] * 0.5
                else:
                    voices[:, side] += s
        if c == "D":  # brighter, wider voicing for the resolution
            for m in (62 + 12, 66 + 12, 69 + 12):
                s = saw(hz(m), n) + saw(hz(m) * 2 ** (6 / 1200), n)
                voices += s[:, None] * 0.35
        e = env_ar(n, 1.2 if a < B[2] else 0.5, rel + 0.2)
        dark = lp(voices, 520 if a < B[2] else 800)
        bright = lp(voices, 2600 if c != "D" else 5200)
        bmix = np.clip((a - B[1]) / (HIT - B[1]), 0.05, 0.55) if c != "D" else 0.9
        sig = ((1 - bmix) * dark + bmix * bright) * e[:, None] * amp
        if c == "D":
            sig *= 1.6
        place(mus, sig, a)
        place(wet_send, sig * 0.8, a)
        # sub
        sub = np.sin(2 * np.pi * hz(bass - 12 if bass > 40 else bass) * np.arange(n) / SR)
        sub = np.tanh(sub * 1.5) * env_ar(n, 0.4, rel) * (0.10 if a < B[2] else 0.12)
        place(mus, sub, a)

    # opening swell: low drone D1 + A1 with slow LFO
    n = int((B[2] + 0.5) * SR)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.12 * np.arange(n) / SR)
    drone = (np.sin(2 * np.pi * hz(26) * np.arange(n) / SR) * 0.6 + lp(saw(hz(33), n), 300) * 0.4) * lfo
    drone *= env_ar(n, 2.5, 2.0) * 0.12
    place(mus, drone, 0.0)
    # air / shimmer bed
    air = hp(rng.standard_normal((N, 2)), 5000) * 0.004
    air *= (0.4 + 0.6 * np.clip(tt / B[2], 0, 1))[:, None] * (1 - np.clip((tt - HIT) / 0.4, 0, 1) * 0.6)[:, None]
    mus += air

    # ---------------------------------------------------------- arpeggio
    step = 0.125
    t0 = B[1]
    k = 0
    pluck_len = int(0.35 * SR)
    ke = np.exp(-np.arange(pluck_len) / (0.11 * SR))
    while t0 < HIT - 0.1:
        ch = CH[chord_at(t0)][1]
        if t0 < B[2] and k % 2:  # eighths before the rhythm enters
            t0 += step
            k += 1
            continue
        m = ch[[0, 2, 1, 3, 2, 1][k % 6]] + 12
        s = saw(hz(m), pluck_len) * ke
        bright = 900 if t0 < B[2] else 1400 + 1800 * np.clip((t0 - B[2]) / (HIT - B[2]), 0, 1)
        s = lp(s, bright)
        acc = 1.0 if k % 4 == 0 else 0.7
        lvl = 0.018 if t0 < B[2] else 0.026 if t0 < B[4] else 0.03
        if t0 > HIT - 3.0:
            lvl *= 1 + (t0 - (HIT - 3.0)) / 3
        place(mus, s * lvl * acc, t0, pan=0.35 * np.sin(k * 0.7))
        place(wet_send, s * lvl * 0.9, t0)
        t0 += step
        k += 1

    # ---------------------------------------------------------- drums
    kick_n = int(0.45 * SR)
    kt = np.arange(kick_n) / SR
    kf = 45 + 75 * np.exp(-kt / 0.035)
    kick = np.sin(2 * np.pi * np.cumsum(kf) / SR) * np.exp(-kt / 0.16)
    kick = np.tanh(kick * 1.4) * 0.32
    beat = B[2]
    while beat < HIT - 0.45:  # drop out half a beat before the hit
        half = beat < B[4] - 1e-6
        if (not half) or abs((beat - B[2]) % 1.0) < 1e-6:
            place(mus, kick * (0.8 if half else 0.9), beat)
        beat += 0.5
    # hats
    hat_n = int(0.06 * SR)
    for i in range(int((HIT - 0.5 - B[3]) / 0.125)):
        th = B[3] + i * 0.125
        if th < B[5] and i % 2:
            continue
        h = hp(rng.standard_normal(hat_n), 7000) * np.exp(-np.arange(hat_n) / (0.012 * SR))
        lvl = (0.02 if i % 2 == 0 else 0.012) * (1.0 if th < B[6] else 1.25)
        place(mus, h * lvl, th, pan=0.3 if i % 2 else -0.2)
    # clap on 2 & 4 from 37 s
    clap_n = int(0.25 * SR)
    for i in range(int((HIT - 0.5 - (B[5] + 0.5)) / 1.0)):
        tc = B[5] + 0.5 + i * 1.0
        c = bp(rng.standard_normal(clap_n), 900, 3500) * np.exp(-np.arange(clap_n) / (0.05 * SR)) * 0.05
        place(mus, c, tc)
        place(wet_send, c * 1.2, tc)

    # ---------------------------------------------------------- strings
    for a, b, c in PROG:
        if a < B[4] - 1e-6:
            continue
        bass, notes = CH[c]
        dur = b - a + 1.0
        n = int(dur * SR)
        tn = np.arange(n) / SR
        sec = np.zeros((n, 2))
        for m in notes:
            for v in range(4):
                vib = 1 + 0.0025 * np.sin(2 * np.pi * (5.2 + v * 0.3) * tn + v)
                det = 2 ** ((v - 1.5) * 5 / 1200)
                s = saw(hz(m + 12) * det * vib, n)
                sec[:, v % 2] += s
        e = env_ar(n, 0.9, 1.1)
        lvl = 0.012 + 0.012 * np.clip((a - B[4]) / (HIT - B[4]), 0, 1)
        if c == "D":
            lvl *= 1.6
        sig = lp(sec, 3200) * e[:, None] * lvl
        place(mus, sig, a)
        place(wet_send, sig * 1.2, a)
    # melody line (high strings) from 37 s
    for i, (a, m) in enumerate(MELODY):
        b = MELODY[i + 1][0] if i + 1 < len(MELODY) else T
        dur = b - a + 0.8
        n = int(dur * SR)
        tn = np.arange(n) / SR
        s = np.zeros(n)
        for v in range(5):
            vib = 1 + 0.003 * np.sin(2 * np.pi * 5.5 * tn + v * 1.3) * np.clip(tn / 0.6, 0, 1)
            s += saw(hz(m) * 2 ** ((v - 2) * 4 / 1200) * vib, n)
        lvl = 0.016 if a < HIT - 3.3 else 0.022
        if a >= HIT - 1e-6:
            lvl = 0.03
        sig = lp(s, 4200) * env_ar(n, 0.7 if a < HIT - 0.1 else 0.15, 1.0) * lvl
        place(mus, sig, a, pan=0.1)
        place(wet_send, sig * 1.5, a)

    # ---------------------------------------------------------- riser + impact
    rs, re_ = HIT - 4.6, HIT
    n = int((re_ - rs) * SR)
    noise = rng.standard_normal((n, 2))
    bands = [(200, 500), (400, 1000), (800, 2000), (1500, 3500), (3000, 7000), (6000, 14000)]
    prog = np.linspace(0, 1, n) ** 1.6
    riser = np.zeros((n, 2))
    for j, (lo, hi) in enumerate(bands):
        w = np.clip(1 - np.abs(prog * (len(bands) - 1) - j), 0, 1)
        riser += bp(noise, lo, hi) * w[:, None]
    riser *= (prog ** 1.5)[:, None] * 0.06
    riser[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))[:, None]
    place(mus, riser, rs)
    # impact at the brand reveal
    n = int(3.8 * SR)
    ti = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(32 + 38 * np.exp(-ti / 0.12)) / SR) * np.exp(-ti / 1.3) * 0.35
    hit = lp(rng.standard_normal(n), 2500) * np.exp(-ti / 0.18) * 0.12
    shimmer = sum(np.sin(2 * np.pi * hz(m) * ti + j) * (0.02 / (1 + j * 0.3)) for j, m in enumerate([86, 90, 93, 98, 102]))
    shimmer = shimmer * np.exp(-ti / 1.6) * (1 + 0.3 * np.sin(2 * np.pi * 6 * ti))
    place(mus, boom + hit, HIT)
    place(mus, shimmer, HIT, pan=0.2)
    place(wet_send, (hit + shimmer) * 1.5, HIT)

    # ---------------------------------------------------------- SFX stem
    def whoosh(t_c, dur=0.9, lvl=0.05, up=True, pan0=-0.6, pan1=0.6):
        n = int(dur * SR)
        x = rng.standard_normal(n)
        p = np.linspace(0, 1, n)
        out = np.zeros(n)
        for j, (lo, hi) in enumerate([(150, 400), (300, 900), (700, 2000), (1500, 4500), (3500, 9000)]):
            pos = p if up else 1 - p
            w = np.clip(1 - np.abs(pos * 4 - j), 0, 1)
            out += bp(x, lo, hi) * w
        out *= np.sin(np.pi * p) ** 1.5 * lvl
        pans = np.linspace(pan0, pan1, n)
        st = np.stack([out * np.cos((pans + 1) * np.pi / 4), out * np.sin((pans + 1) * np.pi / 4)], 1) * 1.414
        place(sfx, st, t_c - dur / 2)

    for tc, lvl in [(2.6, 0.06), (4.1, 0.05), (6.0, 0.03), (13.05, 0.055), (21.0, 0.045), (29.0, 0.04), (37.0, 0.04), (45.0, 0.04), (52.95, 0.05)]:
        whoosh(o2n(tc), 0.8, lvl, up=True, pan0=-0.5 + rng.random() * 0.2, pan1=0.5)

    def chime(t_c, base=88, lvl=0.03, dec=0.5, pan=0.0):
        n = int(1.2 * SR)
        ti = np.arange(n) / SR
        s = sum(np.sin(2 * np.pi * hz(base + d) * ti) * g for d, g in [(0, 1.0), (7, 0.5), (12, 0.35), (19, 0.15)])
        s *= np.exp(-ti / dec) * np.clip(ti / 0.004, 0, 1) * lvl
        place(sfx, s, t_c, pan)
        place(wet_send, s * 0.8, t_c)

    def tick(t_c, lvl=0.025, pan=0.0, f=2400):
        n = int(0.05 * SR)
        ti = np.arange(n) / SR
        s = np.sin(2 * np.pi * f * ti) * np.exp(-ti / 0.006) * lvl + bp(rng.standard_normal(n), 2000, 8000) * np.exp(-ti / 0.003) * lvl * 0.6
        place(sfx, s, t_c, pan)

    # ignition of the gold light in the plant
    n = int(1.6 * SR)
    ti = np.arange(n) / SR
    ign = sum(np.sin(2 * np.pi * hz(m) * ti * (1 + 0.01 * ti)) for m in (74, 81, 86)) * np.clip(ti / 0.5, 0, 1) * np.exp(-np.clip(ti - 0.5, 0, None) / 0.5) * 0.012
    place(sfx, ign, o2n(4.85))
    place(wet_send, ign * 1.5, o2n(4.85))
    # opening low swell
    n = int(3.0 * SR)
    ti = np.arange(n) / SR
    place(sfx, np.sin(2 * np.pi * 41.2 * ti) * np.sin(np.pi * ti / 3.0) ** 2 * 0.08, 0.0)

    for i in range(5):
        tick(o2n(18.7 + i * 0.1), 0.02, pan=0.5)
    for tc in (19.35, 19.57, 19.79):
        chime(o2n(tc), 93, 0.012, 0.25, pan=0.4)
    for i in range(3):
        tick(o2n(23.3 + i * 0.3), 0.018, pan=0.4)
    chime(o2n(27.3), 86, 0.025, 0.6, pan=0.3)
    for tc in (31.3, 31.6, 31.9, 33.7):
        tick(o2n(tc), 0.018, pan=-0.2)
    tick(o2n(35.15), 0.04, pan=0.4, f=1800)
    chime(o2n(36.5), 91, 0.028, 0.6, pan=0.6)
    tick(o2n(46.8), 0.035, pan=-0.3, f=1800)
    tick(o2n(47.65), 0.02, pan=0.5)
    tick(o2n(48.8), 0.035, pan=0.2, f=1800)
    chime(o2n(50.5), 88, 0.025, 0.5, pan=0.2)
    chime(o2n(51.2), 93, 0.022, 0.6, pan=-0.3)

    # ---------------------------------------------------------- reverb
    ir_n = int(2.6 * SR)
    ti = np.arange(ir_n) / SR
    ir = rng.standard_normal((ir_n, 2)) * np.exp(-ti / 0.55)[:, None]
    ir = lp(ir, 5000)
    ir[: int(0.02 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    wet = np.stack([fftconvolve(wet_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
    mus += wet * 0.35

    # ending fade (last 1.1 s) and gentle start
    fade = np.ones(N)
    fe = int(1.1 * SR)
    fade[-fe:] = np.cos(np.linspace(0, np.pi / 2, fe)) ** 2
    mus *= fade[:, None]
    sfx *= fade[:, None]

    for name, x in (("music.wav", mus), ("sfx.wav", sfx)):
        pk = np.max(np.abs(x))
        if pk > 0.95:
            x = x * (0.95 / pk)
        wavfile.write(os.path.join(OUT, name), SR, x.astype(np.float32))
        print(name, "peak", round(float(pk), 3))


if __name__ == "__main__":
    main()
