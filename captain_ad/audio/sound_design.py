"""Score + sound design for 《船长的底牌》 (48 kHz stereo), all procedural.

Every event is anchored to a shot in production/shots.json (shot id + offset),
so re-timing the edit keeps picture and sound in sync. Beats follow the
script: tension open -> looting montage hits -> fuse -> running ostinato and
cross-cut riser -> explosion into tinnitus and near-silence -> breath and the
screen lighting up -> relief theme rises -> cannon tension -> music hard stop
-> brand sting + distant shout.

Writes output/music.wav, output/sfx.wav, output/dialogue.wav (lines placed,
with the boss's final shout pushed into the distance).
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "output")
SR = 48000
SHOTS = json.load(open(os.path.join(ROOT, "production", "shots.json"), encoding="utf-8"))
T = SHOTS["duration"]
N = int(T * SR)
S = {s["id"]: s for s in SHOTS["shots"]}
rng = np.random.default_rng(3)


def at(shot, off=0.0):
    return S[shot]["t"] + off


def end(shot):
    return S[shot]["t"] + S[shot]["dur"]


def lp(x, f, o=2):
    return sosfilt(butter(o, min(f, SR * 0.45), "low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, a, b, o=2):
    return sosfilt(butter(o, [a, min(b, SR * 0.45)], "band", fs=SR, output="sos"), x, axis=0)


def noise(sec):
    return rng.standard_normal(int(sec * SR))


def env(n, a, r):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:min(na, n)] = np.linspace(0, 1, min(na, n))
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def place(buf, sig, t0, pan=0.0, gain=1.0):
    a = int(round(t0 * SR))
    if a >= len(buf) or a + len(sig) <= 0:
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


def saw(f, n):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    ph = np.cumsum(f / SR) % 1.0
    return 2 * ph - 1


# ----------------------------------------------------------------- SFX kit
def shing(): n = tt(0.9); return (hp(noise(0.9), 3000) * np.exp(-n / 0.05) * 0.3 + sum(np.sin(2 * np.pi * f * n) * np.exp(-n / d) for f, d in ((2330, .5), (3710, .35), (5120, .25))) * 0.08)
def thump(f=55, d=0.35, lvl=0.8): n = tt(d * 3); return np.sin(2 * np.pi * np.cumsum(f + 60 * np.exp(-n / 0.03)) / SR) * np.exp(-n / d) * lvl
def hit(lvl=1.0):
    n = tt(1.6); out = lp(noise(1.6), 900) * np.exp(-n / 0.12) * 0.4; a = thump(48, 0.45, 0.9)
    out[:len(a)] += a[:len(out)]
    return out * lvl
def whoosh(d=0.6, lvl=0.25):
    x, p = noise(d), np.linspace(0, 1, int(d * SR))
    out = sum(bp(x, lo, hi) * np.clip(1 - abs(p * 4 - j), 0, 1) for j, (lo, hi) in enumerate(((200, 600), (400, 1200), (900, 2500), (2000, 5000), (4000, 10000))))
    return out * np.sin(np.pi * p) ** 1.5 * lvl
def scrape(d=0.7): x = bp(noise(d), 300, 2200); j = (rng.random(int(d * SR)) > 0.985) * 1.0; return (x * (0.4 + 0.6 * lp(j, 60) * 30) * env(int(d * SR), 0.02, 0.2) * 0.25)
def creak(d=0.8, f0=180):
    n = tt(d); f = f0 * (1 + 0.15 * np.sin(2 * np.pi * 3 * n) + 0.1 * rng.standard_normal(len(n)).cumsum() / len(n))
    return bp(saw(f, len(n)), 300, 1800) * env(len(n), 0.05, 0.2) * 0.12
def clink(n_=4):
    out = np.zeros(int(0.8 * SR))
    for k in range(n_):
        n = tt(0.3); s = sum(np.sin(2 * np.pi * f * n) for f in (3100 + 300 * k, 4700, 6900)) * np.exp(-n / 0.05) * 0.05
        a = int(k * 0.07 * SR); out[a:a + len(s)] += s[: len(out) - a]
    return out
def crackle(d, dens=30, lvl=0.08):
    x = np.zeros(int(d * SR))
    for _ in range(int(d * dens)):
        a = rng.integers(0, len(x) - 400); x[a:a + 300] += hp(rng.standard_normal(300), 1500) * np.exp(-np.arange(300) / 60) * rng.random()
    return x * lvl + lp(noise(d), 180) * 0.05
def waves(d, lvl=0.07):
    n = tt(d); m = 0.55 + 0.45 * np.sin(2 * np.pi * n / 5.3) * np.sin(2 * np.pi * n / 3.1 + 1)
    return lp(noise(d), 900) * m * lvl
def wind(d, lvl=0.05): n = tt(d); return bp(noise(d), 250, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * n / 4.7)) * lvl
def fuse(d):
    n = tt(d); ramp = np.clip(n / d, 0, 1)
    sz = hp(noise(d), 3500) * (0.5 + 0.5 * (rng.random(len(n)) > 0.7)) * (0.05 + 0.1 * ramp)
    return sz + crackle(d, 60, 0.06) * (0.5 + ramp)
def boom(d=5.0):
    n = tt(d)
    low = np.sin(2 * np.pi * np.cumsum(25 + 50 * np.exp(-n / 0.25)) / SR) * np.exp(-n / 1.4)
    body = lp(noise(d), 700) * np.exp(-n / 0.7)
    debris = crackle(d, 80, 0.25) * np.exp(-n / 1.2)
    return (low * 1.0 + body * 0.8 + debris) * 0.9
def ring(d=3.2): n = tt(d); return np.sin(2 * np.pi * 4200 * n) * np.exp(-n / 1.6) * env(len(n), 0.02, 0.6) * 0.05
def heartbeat(bpm, d, lvl=0.5):
    out, beat = np.zeros(int(d * SR)), 60 / bpm
    for k in range(int(d / beat)):
        for off, g in ((0, 1.0), (0.22, 0.6)):
            s = thump(45, 0.12, lvl * g); a = int((k * beat + off) * SR); out[a:a + len(s)] += s[: max(0, len(out) - a)]
    return out
def breath(d=1.2, inhale=True, lvl=0.12):
    n = tt(d); e = np.sin(np.pi * np.clip(n / d, 0, 1)) ** (1.5 if inhale else 0.8)
    return bp(noise(d), 500 if inhale else 350, 2600 if inhale else 1800) * e * lvl
def zipper(d=0.7):
    out = np.zeros(int(d * SR))
    for k in range(int(d * 90)):
        a = int(k / 90 * SR); c = hp(noise(0.004), 2500) * np.exp(-np.arange(int(0.004 * SR)) / 40) * 0.25; out[a:a + len(c)] += c[: len(out) - a]
    return out
def click(lvl=0.2): n = tt(0.06); return (hp(noise(0.06), 1500) * np.exp(-n / 0.004) + np.sin(2 * np.pi * 900 * n) * np.exp(-n / 0.01)) * lvl
def chime(lvl=0.05): n = tt(2.0); return sum(np.sin(2 * np.pi * f * n) * g for f, g in ((587.3, 1), (880, .6), (1174.7, .4), (1760, .15))) * np.exp(-n / 0.8) * np.clip(n / 0.01, 0, 1) * lvl


# ------------------------------------------------------------ music kit
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def pad(notes, d, cut=1200, a=0.8, r=1.0, lvl=0.04):
    n = int(d * SR); x = np.zeros((n, 2))
    for m in notes:
        for det, ch in ((-6, 0), (6, 1), (0, None)):
            s = saw(hz(m) * 2 ** (det / 1200), n)
            if ch is None: x += s[:, None] * 0.5
            else: x[:, ch] += s
    return lp(x, cut) * env(n, a, r)[:, None] * lvl
def braam(root, d=2.5, lvl=0.12):
    n = int(d * SR); x = sum(saw(hz(root + o) * (1 + 0.003 * k), n) for k, o in enumerate((0, 0, 12, 7)))
    return np.tanh(lp(x, 500) * 2.5) * env(n, 0.08, 1.2) * lvl
def pulse_line(t0, t1, bpm, notes, lvl=0.05, cut=900):
    out = np.zeros((int((t1 - t0 + 1) * SR), 2)); step = 60 / bpm / 2
    k, t = 0, 0.0
    while t < t1 - t0:
        n = int(0.18 * SR); s = lp(saw(hz(notes[k % len(notes)]), n), cut) * np.exp(-np.arange(n) / (0.07 * SR)) * lvl
        a = int(t * SR); out[a:a + n, 0] += s; out[a:a + n, 1] += s * 0.9
        t += step; k += 1
    return out
def riser(d, lvl=0.08):
    x, p = noise(d), np.linspace(0, 1, int(d * SR)) ** 1.8
    out = sum(bp(x, lo, hi) * np.clip(1 - abs(p * 5 - j), 0, 1) for j, (lo, hi) in enumerate(((150, 400), (300, 900), (700, 2000), (1500, 4000), (3000, 8000), (6000, 14000))))
    return out * p * lvl


def reverb(x, secs=2.2, wet=0.3):
    n = int(secs * SR); ir = rng.standard_normal((n, 2)) * np.exp(-tt(secs) / (secs / 5))[:, None]
    ir = lp(ir, 5000); ir[: int(0.015 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0, keepdims=True))
    return x + np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1) * wet


def main():
    os.makedirs(OUT, exist_ok=True)
    sfx, mus = np.zeros((N, 2)), np.zeros((N, 2))

    # ambience bed: sea, wind, distant fire; muffled after the blast, back later
    bed = np.stack([waves(T) + wind(T), waves(T) + wind(T)], 1) + np.stack([crackle(T, 12, 0.04)] * 2, 1)
    duck = np.ones(N)
    b0, b1 = int(at("S21", 0.15) * SR), int(at("S23", 0.8) * SR)
    duck[b0:b1] = 0.15
    duck = lp(duck, 3)
    sfx += bed * duck[:, None]

    # 0-5 s: blade, creak, low drone, heartbeat
    place(sfx, shing(), at("S01", 0.05), 0.2, 0.9)
    place(sfx, creak(1.2, 160), at("S01", 0.6), -0.4)
    place(mus, pad([26, 33, 38], end("S03") + 0.5, cut=380, a=1.5, lvl=0.06), 0.0)
    place(mus, heartbeat(70, end("S03") - 0.3, 0.35), 0.3)
    place(mus, braam(26, 1.6, 0.08), at("S03"))  # the glance
    # 5-11 s: looting montage, a hit + whoosh on every cut
    for sid, extra in (("S04", scrape(0.75)), ("S05", creak(0.7, 320)), ("S06", thump(70, 0.25, 0.5))):
        place(mus, hit(0.55), at(sid))
        place(sfx, whoosh(0.4, 0.18), at(sid, -0.2), 0.4)
        place(sfx, extra, at(sid, 0.05))
    place(sfx, clink(6), at("S04", 0.1), -0.3)
    place(mus, pad([26, 33, 41], end("S07") - at("S04"), cut=600, a=0.2, lvl=0.05), at("S04"))
    place(sfx, whoosh(0.5, 0.22), at("S08", -0.1), -0.5)          # torch toss
    place(sfx, thump(90, 0.12, 0.3), at("S08", 0.25))
    fuse_t0 = at("S08", 0.35)
    place(sfx, fuse(at("S21") - fuse_t0), fuse_t0, 0.2, 1.0)
    place(mus, braam(29, 2.4, 0.1), at("S08", 0.3))
    # 11-25 s: running ostinato, cross-cut acceleration, riser into the blast
    run0, run1 = at("S09"), at("S21")
    place(mus, pulse_line(run0, at("S16"), 132, [38, 38, 45, 41, 38, 38, 46, 45], 0.05, 1100), run0)
    place(mus, pulse_line(at("S16"), run1, 168, [38, 45, 50, 45], 0.06, 1800), at("S16"))
    place(mus, heartbeat(120, run1 - at("S13"), 0.4), at("S13"))
    for sid in ("S12", "S13"):
        place(sfx, crackle(0.5, 200, 0.2), at(sid, 0.1), -0.3)
        place(sfx, thump(80, 0.2, 0.4), at(sid, 0.2))
    place(sfx, clink(5), at("S14", 0.1), 0.3)
    for sid in ("S16", "S17", "S18"):
        place(mus, hit(0.45), at(sid))
    place(sfx, whoosh(0.5, 0.2), at("S19", -0.15))
    place(mus, riser(at("S21") - at("S19")), at("S19"))
    place(mus, braam(26, 2.2, 0.14), at("S20"))                   # the leap
    # 25 s: explosion -> tinnitus and breath
    place(sfx, boom(5.0), at("S21"), 0.0, 1.0)
    place(sfx, ring(3.4), at("S21", 0.2))
    place(sfx, breath(1.1, True, 0.1), at("S22", 0.2)); place(sfx, breath(1.4, False, 0.09), at("S22", 1.2))
    # 27-34 s: bag, laptop, the held breath, screen lights up
    place(sfx, zipper(0.7), at("S24", 0.15), 0.2)
    place(sfx, click(0.15), at("S24", 1.2))
    place(sfx, breath(0.9, True, 0.11), at("S25", 0.05))
    place(sfx, chime(0.05), at("S26", 0.42))
    place(mus, pad([50, 57, 62, 66], end("S26") - at("S26") + 0.6, cut=2600, a=0.6, lvl=0.025), at("S26", 0.4))
    # 34-42 s: relief theme rises (D major, warm), carries the captain's line
    th0 = at("S27", 0.8)
    for k, chord in enumerate(([50, 54, 57, 62], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61], [50, 54, 57, 62])):
        d = (end("S29") - th0) / 5
        place(mus, pad(chord, d + 0.8, cut=1800 + 500 * k, a=0.6, r=0.8, lvl=0.035 + 0.006 * k), th0 + k * d)
    place(mus, pulse_line(at("S29", 0.4), end("S29"), 120, [62, 66, 69, 74], 0.03, 3000), at("S29", 0.4))
    # 42-47 s: cannon tension, then hard stop
    place(sfx, creak(1.0, 90), at("S31", 0.1), 0.4, 1.6)
    place(mus, pulse_line(at("S30"), end("S33"), 150, [38, 39, 38, 39], 0.05, 900), at("S30"))
    place(mus, heartbeat(96, end("S33") - at("S32"), 0.35), at("S32"))
    stop = end("S33")
    # 49 s: brand sting
    place(mus, thump(38, 0.9, 0.7), at("S35"))
    place(mus, chime(0.04), at("S35", 0.05), 0.1)
    place(mus, pad([38, 45, 50, 54, 57], end("S35") - at("S35"), cut=2200, a=0.05, r=1.4, lvl=0.035), at("S35"))

    mus = reverb(mus, 2.4, 0.3)
    # music hard stop on the stare: 60 ms fade, dead silence until the brand sting
    a, f, b = int(stop * SR), int(0.06 * SR), int(at("S35") * SR)
    mus[a:a + f] *= np.linspace(1, 0, f)[:, None]
    mus[a + f:b] = 0
    sfx = reverb(sfx, 1.2, 0.12)

    # dialogue: lines at their shots; final shout pushed into the distance
    dlg = np.zeros((N, 2))
    lines_dir = os.path.join(HERE, "lines")
    for s in SHOTS["shots"]:
        p = os.path.join(lines_dir, f"{s['id']}.wav")
        if "line" not in s or not os.path.exists(p):
            continue
        x, sr = sf.read(p, dtype="float32")
        x = resample_poly(x, SR, sr)
        act = x[np.abs(x) > 0.02 * np.abs(x).max()]
        x = x * (0.12 / np.sqrt(np.mean(act ** 2)))
        start = s["t"] + s["line"].get("offset", 0.15)
        if s["line"].get("offscreen"):
            x = lp(hp(x, 400), 2500) * 0.8
            wet = reverb(np.stack([x, x], 1), 2.8, 0.9)
            place(dlg, wet, start + 0.6)
        else:
            place(dlg, x, start, 0.0)
    for name, x in (("music.wav", mus), ("sfx.wav", sfx), ("dialogue.wav", dlg)):
        # float stems keep their relative balance; the mix normalises loudness
        sf.write(os.path.join(OUT, name), x.astype(np.float32), SR, subtype="FLOAT")
        print(name, "peak", round(float(np.abs(x).max()), 3))


if __name__ == "__main__":
    main()
