"""Dialogue for 《船长的底牌》 acted by Runway's Seed Audio 1.0 (needs RUNWAYML_API_SECRET).

Each line is generated from a directed scene prompt (Chinese, who / where / how) with the
role's voice as @Audio1 (audio/voices/<role>_ref.wav), so timbre stays per character while
the delivery follows the direction: shouts, panting, a trembling voice. Takes are scored
by voice_metrics.py (ASR error, speed, pitch, effort) and kept in footage/voice_takes/.

The edit is not re-timed: a take longer than its slot (the length the previous recording
had, see retime.py) is tightened with rubberband, which only makes urgent lines more urgent.

  python3 make_dialogue_runway.py takes [S09 ..] [--n 2]   # generate takes (0.25 credits/s, 5 minimum each)
  python3 make_dialogue_runway.py score [S09 ..]           # metrics for every take
  python3 make_dialogue_runway.py pick S09 1 [S15 0 ..]    # install takes as audio/lines/<SHOT>.wav
"""
import json
import os
import subprocess
import sys

import librosa
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, os.path.join(ROOT, "production"))
import generate_runway as g  # noqa: E402
from voice_metrics import metrics, words  # noqa: E402

TAKES = os.path.join(ROOT, "footage", "voice_takes")
LINES = os.path.join(HERE, "lines")
SHOTS = json.load(open(os.path.join(ROOT, "production", "shots.json"), encoding="utf-8"))
S = {s["id"]: s for s in SHOTS["shots"]}
TAIL = 0.25
OFFSCREEN_DELAY = 0.35  # the distant shout starts this long after the end card cuts in (sound_design.py)

PERSONA = {
    "CAPTAIN": "@Audio1 里这个四十多岁的中国商船船长",
    "MATE": "@Audio1 里这个二十多岁的年轻大副",
    "BOSS": "@Audio1 里这个魁梧粗野的海盗头目",
    "GUNNER": "@Audio1 里这个粗犷的年轻海盗炮手",
}
DIRECTION = {  # scene + delivery; the line itself is appended in quotes
    "S02": "把弯刀抵在船长下巴上，贴着他的脸，压低嗓子、咬着牙，一字一顿地威胁，阴狠，带着随时动手的杀气",
    "S07": "把船长的帽子扣在自己头上，得意洋洋、带着嘲讽，故意拖长了慢悠悠地说",
    "S09": "看到火药引线马上就要烧到底，惊恐万分、声嘶力竭地冲着船上大喊，语速极快、气息急促、喊到快破音",
    "S15": "在浓烟弥漫的船舱里疯狂翻找，上气不接下气、大口喘着粗气，又急又慌，声音发抖、几乎崩溃",
    "S23": "刚从爆炸里逃出来，浑身发抖，声音发颤带着哭腔，又后怕又难以置信",
    "S27": "看到电脑屏幕亮起，如释重负，先长长吐出一口气，然后带着喘息、轻声哽咽地说",
    "S28": "指着身后燃烧沉没的商船，又急又委屈，带着哭腔冲着船长大喊",
    "S29": "抹去脸上的烟灰，重新找回了底气，坚定、温暖、带着笑意，越说越有力量，“TradeMind SDR”用英文读",
    "S31": "转动炮口对准小艇，急不可耐、扯着粗嗓子大声喊",
    "S33": "猛地一把按下手下的火把，急切又严肃，声如洪钟地大吼",
    "S35": "隔着海面远远地扯着嗓子吆喝，带点讨好",
}
LINE_REF = {  # boss_ref.wav is muffled (nothing above ~1.1 kHz) and Seed copies that; his earlier
    # recorded lines carry the same voice with full bandwidth, one menacing and one shouted
    "S02": "boss_menace_ref.wav", "S07": "boss_menace_ref.wav",
    "S33": "boss_shout_ref.wav", "S35": "boss_shout_ref.wav",
}
LEVEL = {  # dB against the dialogue reference level in sound_design.py
    "S02": -1.0, "S07": -1.0, "S09": 3.0, "S15": 1.0, "S23": -1.5, "S27": -4.0,
    "S28": 2.5, "S29": 0.0, "S31": 2.5, "S33": 3.0, "S35": 0.0,
}


def slot(s):
    """Longest line that fits without moving any cut (inverse of retime.py)."""
    ln = s["line"]
    if ln.get("offscreen"):
        return s["dur"] - OFFSCREEN_DELAY - 0.2
    return s["dur"] - ln.get("offset", 0.15) - TAIL + ln.get("spill", 0.0)


def prompt(s):
    ln = s["line"]
    return (f"只有一个人的人声，干声，没有音乐、没有音效、没有环境声。{PERSONA[ln['who']]}，"
            f"{DIRECTION[s['id']]}：“{ln['text']}”")


def take_path(sid, n):
    return os.path.join(TAKES, f"{sid}_{n}.wav")


def stage_takes(ids, n):
    jobs = []
    for sid in ids:
        s = S[sid]
        ref = os.path.join(HERE, "voices", LINE_REF.get(sid, f"{s['line']['who'].lower()}_ref.wav"))
        for k in range(n):
            out = take_path(sid, k)
            if os.path.exists(out):
                continue
            body = {"model": "seed_audio", "promptText": prompt(s), "referenceAudios": [g.MEDIA(ref)],
                    "sampleRate": 48000, "outputFormat": "wav"}
            jobs.append((f"line {sid}_{k}", "/v1/sound_effect", body,
                         lambda urls, t, out=out, p=body["promptText"]: (g.download(urls[0], out), g.sidecar(out, task=t["id"], prompt=p))))
    if jobs:
        g.need_credits(5 * len(jobs))
        g.run_jobs(jobs, "seed_audio")


def stage_score(ids):
    for sid in ids:
        k = 0
        while os.path.exists(take_path(sid, k)):
            m = metrics(take_path(sid, k), S[sid]["line"]["text"])
            fit = "fits" if m["dur"] <= slot(S[sid]) else f"x{m['dur'] / slot(S[sid]):.2f} to fit"
            print(f"{sid}_{k} slot {slot(S[sid]):.2f}s {fit}", {k2: v for k2, v in m.items()})
            k += 1


MAX_GAP = {  # longest pause kept inside a line (s): urgent lines run together, written beats stay
    "S02": 0.45, "S07": 0.2, "S09": 0.12, "S15": 0.25, "S23": 0.35, "S27": 0.5,
    "S28": 0.12, "S29": 0.3, "S31": 0.12, "S33": 0.12, "S35": 0.3,
}
MAX_TEMPO = 1.12  # beyond this a line keeps its pace and retime.py lengthens the shot instead


BREATH = {  # breath kept before the first and after the last voiced sound (s)
    "S15": (0.35, 0.25),   # panting into the line
    "S27": (0.7, 0.3),     # the long exhale of relief is the performance
}


def tighten(path, max_gap, breath=(0.12, 0.2)):
    """Shorten pauses, panting and exhales without touching a word. Word spans come from the ASR
    word timestamps; the first word's start is moved to where its voice actually begins (pYIN),
    since ASR folds a leading breath into it. Gaps between words longer than max_gap lose their
    middle; the ends keep `breath` seconds. Splices use 15 ms crossfades."""
    y, sr = librosa.load(path, sr=24000, mono=True)
    ws = [(int(a * sr), int(b * sr)) for _, a, b in words(path)]
    hop = 240
    a0, b0 = ws[0]
    _, voiced, _ = librosa.pyin(y[a0:b0], fmin=60, fmax=700, sr=sr, frame_length=1024, hop_length=hop)
    if voiced.any():
        ws[0] = (a0 + max(0, int(np.argmax(voiced)) * hop - int(0.05 * sr)), b0)
    start = max(0, ws[0][0] - int(breath[0] * sr))
    end = min(len(y), ws[-1][1] + int(breath[1] * sr))
    pieces, cur = [], start
    for (_, b), (a, _) in zip(ws, ws[1:]):
        if a - b > max_gap * sr:
            keep = int(max_gap * sr)
            pieces.append((cur, b + keep // 2))
            cur = a - (keep - keep // 2)
    pieces.append((cur, end))
    fade = int(0.015 * sr)
    out = y[pieces[0][0]:pieces[0][1]]
    for a, b in pieces[1:]:
        nxt = y[a:b]
        ramp = np.linspace(0, 1, fade)
        out = np.concatenate([out[:-fade], out[-fade:] * (1 - ramp) + nxt[:fade] * ramp, nxt[fade:]])
    return out, sr


def install(sid, n):
    """Tighten, mono 24 kHz, fit to the slot, peak -1 dBFS, write audio/lines/<sid>.wav."""
    y, sr = tighten(take_path(sid, n), MAX_GAP[sid], BREATH.get(sid, (0.12, 0.2)))
    pad = int(0.03 * sr)
    y = np.concatenate([np.zeros(pad), y, np.zeros(pad)])
    raw = os.path.join(LINES, f"{sid}_take.wav")
    sf.write(raw, y / (np.abs(y).max() + 1e-9) * 0.89, sr, subtype="PCM_16")
    dur, room = len(y) / sr, slot(S[sid])
    out = os.path.join(LINES, f"{sid}.wav")
    if dur > room and (dur / room <= MAX_TEMPO or S[sid]["line"].get("offscreen")):
        tempo = dur / room
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", f"rubberband=tempo={tempo:.4f}:formant=preserved",
                        "-ar", "24000", "-ac", "1", out], check=True)
    else:
        tempo = 1.0
        os.replace(raw, out)
    if os.path.exists(raw):
        os.remove(raw)
    lines = json.load(open(os.path.join(LINES, "lines.json"), encoding="utf-8"))
    x, _ = sf.read(out)
    lines[sid] = {"who": S[sid]["line"]["who"], "text": S[sid]["line"]["text"], "engine": "seed_audio",
                  "take": f"{sid}_{n}", "dur": round(len(x) / 24000, 3), "tempo": round(tempo, 3), "level_db": LEVEL[sid]}
    json.dump(lines, open(os.path.join(LINES, "lines.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{sid}: take {n}, {dur:.2f}s -> {lines[sid]['dur']}s (slot {room:.2f}s, tempo {tempo:.3f}), level {LEVEL[sid]:+} dB")


if __name__ == "__main__":
    args = sys.argv[1:]
    n = 2
    if "--n" in args:
        i = args.index("--n"); n = int(args[i + 1]); del args[i:i + 2]
    stage, rest = args[0], args[1:]
    ids = [a for a in rest if a in DIRECTION] or list(DIRECTION)
    if stage == "takes":
        stage_takes(ids, n)
    elif stage == "score":
        stage_score(ids)
    elif stage == "pick":
        for sid, k in zip(rest[::2], rest[1::2]):
            install(sid, int(k))
