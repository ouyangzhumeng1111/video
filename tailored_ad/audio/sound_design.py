"""Score, effects and dialogue for 《原来，你对谁都这么说》 (48 kHz stereo, all procedural).

Cue times come from output/events.json, exported from the picture (render/film.js) by
`node render.mjs events`, so the sound always follows the edit.

Music: a light office-comedy groove (marimba, plucked bass, shaker) that tightens when the
second buyer starts typing, stops dead on "连错别字都一样", stays out through the boss's
messages, comes back brighter with TradeMind SDR, and lands one last accent on the end card.

Writes output/music.wav, output/sfx.wav, output/dialogue.wav and output/mix.wav (-16 LUFS).
"""
import json
import os
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "output")
SR = 48000
DUR = 60.0
N = int(DUR * SR)
EV = json.load(open(os.path.join(OUT, "events.json"), encoding="utf-8"))
LINES = json.load(open(os.path.join(HERE, "lines", "lines.json"), encoding="utf-8"))
CUE = {e["name"]: e["t"] for e in EV if e["kind"] == "cue"}
rng = np.random.default_rng(5)


def tt(d):
    return np.arange(int(d * SR)) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x, axis=0)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "highpass", fs=SR, output="sos"), x, axis=0)


def place(buf, sig, t0, pan=0.0, gain=1.0):
    a = int(round(t0 * SR))
    if a >= len(buf) or len(sig) == 0:
        return
    if a < 0:
        sig, a = sig[-a:], 0
    sig = sig[: len(buf) - a] * gain
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
        buf[a:a + len(sig), 0] += sig * l
        buf[a:a + len(sig), 1] += sig * r
    else:
        buf[a:a + len(sig)] += sig


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def reverb(x, secs=1.2, wet=0.18):
    n = int(secs * SR)
    ir = rng.standard_normal((n, 2)) * np.exp(-np.arange(n) / (0.22 * SR))[:, None]
    ir = lp(ir, 6000)
    ir /= np.sqrt((ir ** 2).sum(0))
    from scipy.signal import fftconvolve
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet


# ------------------------------------------------------------- instruments
def pluck(f, d=0.6, bright=0.5, gain=1.0):
    """Karplus-Strong string: bass and ukulele."""
    n, p = int(d * SR), max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p)
    buf = lp(buf, 1000 + 7000 * bright, 1) if p > 12 else buf
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    out *= np.exp(-tt(d) / (d * 0.6))
    return out * gain


def mallet(f, d=0.5, gain=1.0):
    """Marimba-ish: fundamental + the 3.93x bar partial, fast decay."""
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.22) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.05)
    y *= np.minimum(1, t / 0.002)
    return y * gain


def bell(f, d=1.2, gain=1.0):
    t = tt(d)
    y = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (0.5 / k ** 0.5)) for k, a in ((1, 1), (2.76, 0.4), (5.4, 0.2), (8.9, 0.08)))
    return y * np.minimum(1, t / 0.003) * gain


def pad(freqs, d, attack=0.8, release=0.8, gain=1.0):
    t = tt(d)
    y = np.zeros(len(t))
    for f in freqs:
        for det in (-0.12, 0.0, 0.12):
            ph = rng.uniform(0, 1)
            y += 2 * ((f * 2 ** (det / 12) * t + ph) % 1) - 1
    y = lp(y / (len(freqs) * 3), 1800)
    env = np.minimum(1, t / attack) * np.minimum(1, (d - t) / release)
    return y * env * gain


def shaker(d=0.05, gain=1.0):
    y = hp(rng.standard_normal(int(d * SR)), 6000) * np.exp(-tt(d) / (d * 0.3))
    return y * gain


def clap(gain=1.0):
    y = np.zeros(int(0.18 * SR))
    for k, off in enumerate((0, 0.009, 0.019)):
        a = int(off * SR)
        n = int(0.16 * SR) - a
        burst = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (0.012 if k < 2 else 0.05))
        y[a:a + len(burst)] += burst
    return bp(y, 900, 5000) * gain


def kick(gain=1.0):
    t = tt(0.3)
    f = 50 + 70 * np.exp(-t / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * gain


CHORD = {"C": (48, [60, 64, 67]), "Am": (45, [57, 60, 64]), "F": (41, [53, 57, 60]), "G": (43, [55, 59, 62]),
         "D": (50, [62, 66, 69]), "A": (45, [57, 61, 64]), "Bm": (47, [59, 62, 66]), "Gm": (43, [55, 58, 62]), "G2": (43, [55, 59, 62])}


def groove1(t0, t1, tense_at):
    """112 bpm, C - Am - F - G: marimba arpeggios, plucked bass, off-beat shaker; from `tense_at`
    the marimba drops out and a pad swells over a pedal G until the stop."""
    buf = np.zeros((N, 2))
    beat = 60 / 112
    prog = ["C", "Am", "F", "G"]
    t, i = t0, 0
    while t < t1:
        bar = prog[(i // 4) % 4]
        root, tones = CHORD[bar]
        b = i % 4
        tense = t >= tense_at
        if tense:
            root, tones = CHORD["G"]
        place(buf, pluck(midi(root), 0.5, 0.35, 0.55), t, -0.1)
        if b in (1, 3):
            place(buf, pluck(midi(root + 7), 0.3, 0.35, 0.35), t + beat * 0.5, -0.1)
        if not tense:
            for k in (0, 1):  # 8th-note arpeggio up and back down the chord, a cheeky gap on the "and" of 4
                if b == 3 and k == 1:
                    continue
                step = (0, 1, 2, 1)[(b * 2 + k) % 4]
                place(buf, mallet(midi(tones[step] + 12), 0.45, 0.32), t + k * beat / 2, 0.25 if k else -0.25)
        place(buf, shaker(0.05, 0.18), t + beat / 2, 0.4)
        t += beat; i += 1
    sw = pad([midi(55), midi(62), midi(67)], t1 - tense_at + 0.1, attack=t1 - tense_at, release=0.02, gain=0.32)
    place(buf, sw, tense_at, 0)
    return buf


def groove2(t0, t1):
    """118 bpm, D - A - Bm - G: strummed plucks, bass, kick on 1/3, claps on 2/4, a bell hook."""
    buf = np.zeros((N, 2))
    beat = 60 / 118
    prog = ["D", "A", "Bm", "G2"]
    hook = [74, 76, 78, 81, 78, 76]
    t, i = t0, 0
    while t < t1:
        root, tones = CHORD[prog[(i // 4) % 4]]
        b = i % 4
        place(buf, pluck(midi(root - 12 + 12), 0.45, 0.3, 0.6), t, -0.05)
        if b in (0, 2):
            place(buf, kick(0.5), t)
        else:
            place(buf, clap(0.16), t, 0.1)
        for k in (0, 1):  # down / up strum on each 8th
            for j, n in enumerate(tones if k == 0 else tones[::-1]):
                place(buf, pluck(midi(n), 0.35, 0.7, 0.16), t + k * beat / 2 + j * 0.012, 0.3 - 0.3 * j)
        if (i // 4) % 2 == 1 and b < 3:
            place(buf, bell(midi(hook[(i + b) % len(hook)]), 0.8, 0.12), t + beat * 0.5, 0.35)
        place(buf, shaker(0.04, 0.12), t + beat * 0.25, -0.4); place(buf, shaker(0.04, 0.1), t + beat * 0.75, -0.4)
        t += beat; i += 1
    return buf


def ending(t0, hit):
    buf = np.zeros((N, 2))
    place(buf, pad([midi(62), midi(66), midi(69), midi(74)], DUR - t0, attack=0.6, release=1.2, gain=0.22), t0)
    for k, n in enumerate((74, 78, 81, 86)):
        place(buf, bell(midi(n), 1.6, 0.13), t0 + 0.9 + k * 0.42, 0.3 * (k - 1.5) / 1.5)
    for j, n in enumerate((50, 62, 66, 69, 74, 78)):  # the final light accent
        place(buf, pluck(midi(n), 1.6, 0.8, 0.32 if j else 0.6), hit + j * 0.01, 0.2 * (j - 2.5) / 2.5)
    place(buf, bell(midi(86), 2.0, 0.2), hit, 0.2)
    swell = hp(rng.standard_normal(int(0.9 * SR)), 5000) * (np.linspace(0, 1, int(0.9 * SR)) ** 3) * 0.05
    place(buf, swell, hit - 0.9, 0)
    return buf


# ----------------------------------------------------------------- effects
def layer(*parts):
    """Sum (signal, offset seconds) pairs into one buffer as long as the longest."""
    n = max(int(o * SR) + len(x) for x, o in parts)
    y = np.zeros(n)
    for x, o in parts:
        a = int(o * SR); y[a:a + len(x)] += x
    return y


def fx(name):
    if name == "ding":
        return layer((bell(midi(88), 0.9, 0.35), 0), (bell(midi(95), 0.8, 0.25), 0.09))
    if name == "tap":
        n = int(0.03 * SR)
        return hp(rng.standard_normal(n), 1500) * np.exp(-tt(0.03) / 0.004) * 0.35 + np.sin(2 * np.pi * 180 * tt(0.03)) * np.exp(-tt(0.03) / 0.008) * 0.3
    if name == "key":
        n = int(0.025 * SR)
        f = rng.uniform(2200, 3200)
        return bp(rng.standard_normal(n), f * 0.6, f) * np.exp(-tt(0.025) / 0.004) * 0.45
    if name == "swish":
        d = 0.28; t = tt(d)
        y = rng.standard_normal(len(t)) * np.sin(np.pi * t / d) ** 2
        return bp(y, 600, 5000) * 0.18
    if name == "pop":
        d = 0.09; t = tt(d)
        f = 820 * np.exp(-t / 0.05) + 380
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03) * 0.35
    if name == "blip":
        return np.sin(2 * np.pi * 1320 * tt(0.06)) * np.exp(-tt(0.06) / 0.02) * 0.18
    if name == "sent":
        d = 0.35; t = tt(d)
        y = bp(rng.standard_normal(len(t)), 1200, 7000) * (t / d) ** 2 * np.exp(-np.maximum(0, t - 0.25) / 0.03)
        return layer((y * 0.22, 0), (fx("pop"), 0.26))
    if name == "banner":
        return layer(*[(mallet(midi(n), 0.4, 0.22), k * 0.08) for k, n in enumerate((83, 88, 91))])
    if name == "chime":
        return layer((bell(midi(81), 1.4, 0.2), 0), (bell(midi(88), 1.2, 0.16), 0.12))
    if name == "tick":
        return np.sin(2 * np.pi * 2400 * tt(0.03)) * np.exp(-tt(0.03) / 0.006) * 0.16
    if name == "shutter":
        click = lambda: bp(rng.standard_normal(int(0.05 * SR)), 1500, 8000) * np.exp(-tt(0.05) / 0.008) * 0.5
        return layer((click(), 0.0), (click(), 0.07))
    if name == "rec":
        return np.concatenate([np.sin(2 * np.pi * 880 * tt(0.07)), np.zeros(int(0.03 * SR)), np.sin(2 * np.pi * 1175 * tt(0.08))]) * 0.12
    if name == "glow":
        t = tt(0.9)
        return sum(np.sin(2 * np.pi * f * t) for f in (1760, 2217, 2637)) * np.sin(np.pi * t / 0.9) ** 2 * 0.04
    raise KeyError(name)


# ---------------------------------------------------------------- dialogue
LEVEL = {"L1": 0.0, "L2": 0.0, "L3": -0.5, "L4": -0.5, "L5": -1.5, "L6": 0.5, "L7": -1.0}


def line_audio(e):
    x, sr = sf.read(os.path.join(HERE, "lines", f"{e['id']}.wav"), dtype="float32")
    x = resample_poly(x, SR, sr).astype(np.float64)
    a = int(e["from"] * SR); b = int(e["to"] * SR) if e["to"] else len(x)
    x = x[a:b]
    fade = int(0.012 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    act = x[np.abs(x) > 0.02 * np.abs(x).max()]
    x = x * (0.12 / np.sqrt(np.mean(act ** 2))) * 10 ** (LEVEL[e["id"]] / 20)
    if e["fx"] == "phone":  # a voice message played back on the phone
        x = bp(x, 170, 7500) * 1.15
    if e["fx"] == "voiceover":
        x = hp(x, 70)
    return x


def main():
    os.makedirs(OUT, exist_ok=True)
    stop = CUE["music_stop"]
    m1 = groove1(0.0, stop, tense_at=14.30)
    f = int(0.015 * SR); a = int(stop * SR)
    m1[a - f:a] *= np.linspace(1, 0, f)[:, None]; m1[a:] = 0
    m2 = groove2(CUE["music_in"], 55.0)
    b = int(55.0 * SR); m2[b - int(0.4 * SR):b] *= np.linspace(1, 0.3, int(0.4 * SR))[:, None]; m2[b:] *= 0
    mus = reverb(m1 + m2 + ending(55.0, CUE["music_hit"]), 1.4, 0.16)
    g0 = int((stop + 0.03) * SR)  # the stop is dead dry: no reverb tail into the silence
    mus[a:g0] *= np.linspace(1, 0, g0 - a)[:, None]; mus[g0:int(CUE["music_in"] * SR)] = 0
    e0 = int(59.6 * SR); mus[e0:] *= np.linspace(1, 0, N - e0)[:, None]

    sfx = np.zeros((N, 2))
    for e in EV:
        if e["kind"] == "sfx":
            place(sfx, fx(e["name"]), e["t"], rng.uniform(-0.15, 0.15), e["gain"])
    room = lp(rng.standard_normal((N, 2)), 400) * 0.0025  # the silence of the boss scene is a room, not digital black
    sfx += room

    dlg = np.zeros((N, 2))
    for e in EV:
        if e["kind"] == "line":
            place(dlg, line_audio(e), e["t"], 0.0)

    # music steps back under dialogue
    env = np.abs(dlg).max(1)
    k = int(0.03 * SR)
    env = np.convolve(env, np.ones(k) / k, "same")
    g = np.zeros_like(env); v = 0.0
    for i in range(0, N, 48):
        v = max(env[i], v * 0.982); g[i:i + 48] = v
    duck = 10 ** (-8.0 * np.clip(g / 0.04, 0, 1) / 20)
    mix = dlg * 1.3 + sfx * 0.85 + mus * 0.7 * duck[:, None]
    for name, x in (("music.wav", mus), ("sfx.wav", sfx), ("dialogue.wav", dlg)):
        sf.write(os.path.join(OUT, name), x.astype(np.float32), SR, subtype="FLOAT")
    pre = os.path.join(OUT, "mix_pre.wav")
    sf.write(pre, (mix * 0.9 / np.abs(mix).max()).astype(np.float32), SR, subtype="FLOAT")
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                          capture_output=True, text=True).stderr
    m = json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])
    ln = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", pre, "-af", ln, "-ar", "48000", "-c:a", "pcm_s24le",
                    os.path.join(OUT, "mix.wav")], check=True)
    os.remove(pre)
    print("wrote mix.wav; music stops at", stop, "re-enters at", CUE["music_in"], "hit at", CUE["music_hit"])


if __name__ == "__main__":
    main()
