"""Dialogue for 《原来，你对谁都这么说》, acted by Runway Seed Audio 1.0 (needs RUNWAYML_API_SECRET).

Each line is a directed scene prompt (who, where, how) — the same approach as captain_ad's
make_dialogue_runway.py. The salesman's second line uses his first take as @Audio1 so both
lines share one voice. Takes land in audio/takes/<LINE>_<n>.wav; score them with
captain_ad/audio/voice_metrics.py, then `pick` installs one as audio/lines/<LINE>.wav.

  python3 make_lines.py takes [L1 ..] [--n 2]   # 0.25 credits/s, 5 minimum each
  python3 make_lines.py score [L1 ..]
  python3 make_lines.py pick L1 0 [L3 1 ..]
"""
import json
import os
import subprocess
import sys

import librosa
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "..", "..")
sys.path.insert(0, os.path.join(REPO, "captain_ad", "production"))
sys.path.insert(0, os.path.join(REPO, "captain_ad", "audio"))
import generate_runway as g  # noqa: E402  (Runway plumbing: api, run_jobs, download, data URIs)
from voice_metrics import metrics, words  # noqa: E402

TAKES = os.path.join(HERE, "takes")
LINES = os.path.join(HERE, "lines")
DRY = "只有一个人的人声，干声，没有音乐、没有音效、没有环境声。"
LINE = {  # id: (who, text, direction)
    "L1": ("销售", "研究了贵司的业务，这份方案，是专门为您做的。",
           "一位三十岁左右的男销售，给客户发方案时的画外音，熟练、诚恳、流畅自信，正常业务交流的语速，不要演得虚伪"),
    "L2": ("采购甲", "这家挺用心，还专门给我做了方案。",
           "一位三十多岁的女采购，在展会休息区给同行发语音消息，像同事聊天，轻松，带点小得意"),
    "L3": ("采购丙", "连错别字都一样。",
           "一位三十岁左右的女采购，发语音消息，语气平淡、认真、没有起伏，像在陈述一个事实"),
    "L4": ("老板", "你到底定制了什么？",
           "一位四十多岁的男老板，给下属发语音消息，平静、克制、不发火，一字一字说清楚"),
    "L5": ("销售", "公司名……我都改了。",
           "@Audio1 里这个男销售，被老板问住了，有点委屈，先脱口而出“公司名”，停顿半拍，再小声补一句“我都改了”"),
    "L6": ("旁白", "先了解客户，再开口。",
           "一位成熟温和的女旁白，干净、温暖、不煽情，语速从容"),
    "L7": ("无人机工厂采购经理", "我们正在选连接器。发份规格书，技术看一下。",
           "一位四十岁左右的男采购经理，一边打字回复邮件一边随口念出来，干脆、务实、语速偏快，像在处理日常工作，每个字吐字清楚"),
}
REF = {"L5": "L1"}  # line -> line whose installed take is the voice reference


def take_path(lid, n):
    return os.path.join(TAKES, f"{lid}_{n}.wav")


def prompt(lid):
    who, text, how = LINE[lid]
    return f"{DRY}{how}：“{text}”"


def stage_takes(ids, n):
    jobs = []
    for lid in ids:
        refs = []
        if lid in REF:
            ref = os.path.join(LINES, f"{REF[lid]}.wav")
            if not os.path.exists(ref):
                print(f"{lid}: install {REF[lid]} first"); continue
            refs = [g.MEDIA(ref)]
        for k in range(n):
            out = take_path(lid, k)
            if os.path.exists(out):
                continue
            body = {"model": "seed_audio", "promptText": prompt(lid), "sampleRate": 48000, "outputFormat": "wav"}
            if refs:
                body["referenceAudios"] = refs
            jobs.append((f"line {lid}_{k}", "/v1/sound_effect", body,
                         lambda urls, t, out=out, p=body["promptText"]: (g.download(urls[0], out), g.sidecar(out, task=t["id"], prompt=p))))
    if jobs:
        g.need_credits(5 * len(jobs))
        g.run_jobs(jobs, "seed_audio")


def stage_score(ids):
    for lid in ids:
        k = 0
        while os.path.exists(take_path(lid, k)):
            m = metrics(take_path(lid, k), LINE[lid][1])
            print(f"{lid}_{k}", {a: (float(b) if isinstance(b, np.floating) else b) for a, b in m.items()})
            k += 1


MAX_GAP = {"L5": 0.4}  # 公司名……(half a beat)……我都改了
TEMPO = {}  # line -> rubberband tempo, for a take that drags (none needed now)


def voiced_starts(y, sr, ws):
    """ASR folds hesitations into the next word; move each word start to where its voice begins."""
    hop = 240
    _, v, _ = librosa.pyin(y, fmin=60, fmax=700, sr=sr, frame_length=1024, hop_length=hop)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0][:len(v)]
    v = v & (rms > rms.max() * 10 ** (-35 / 20))  # pYIN calls digital silence "voiced" at fmin
    out = []
    for w, s, e in ws:
        a, b = int(s * sr / hop), int(e * sr / hop)
        out.append((w, s + (int(np.argmax(v[a:b])) * hop / sr - 0.04 if v[a:b].any() else 0.0), e))
    return out


def install(lid, n):
    """Trim to the words (+ a short breath), cap pauses (MAX_GAP), mono 24 kHz, peak -1 dBFS;
    record word timings for the edit."""
    src = take_path(lid, n)
    y, sr = librosa.load(src, sr=24000, mono=True)
    ws = voiced_starts(y, sr, words(src))
    a = max(0, int((ws[0][1] - 0.12) * sr))
    b = min(len(y), int((ws[-1][2] + 0.2) * sr))
    if lid in MAX_GAP:  # drop the middle of any longer pause between words
        keep, cur, pieces = int(MAX_GAP[lid] * sr), a, []
        for (_, _, e0), (_, s1, _) in zip(ws, ws[1:]):
            if (s1 - e0) * sr > keep:
                pieces.append((cur, int(e0 * sr) + keep // 2)); cur = int(s1 * sr) - keep // 2
        pieces.append((cur, b))
        f = int(0.015 * sr)
        seg = y[pieces[0][0]:pieces[0][1]]
        for p0, p1 in pieces[1:]:
            nxt, r = y[p0:p1], np.linspace(0, 1, f)
            seg = np.concatenate([seg[:-f], seg[-f:] * (1 - r) + nxt[:f] * r, nxt[f:]])
        y, a = seg, 0
    else:
        y = y[a:b]
    y = y / (np.abs(y).max() + 1e-9) * 0.89
    out = os.path.join(LINES, f"{lid}.wav")
    sf.write(out, y, sr, subtype="PCM_16")
    if lid in TEMPO:
        tmp = out + ".tmp.wav"
        os.replace(out, tmp)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", f"rubberband=tempo={TEMPO[lid]}:formant=preserved",
                        "-ar", str(sr), "-ac", "1", out], check=True)
        os.remove(tmp)
        y, _ = sf.read(out)
    meta_p = os.path.join(LINES, "lines.json")
    meta = json.load(open(meta_p, encoding="utf-8")) if os.path.exists(meta_p) else {}
    meta[lid] = {"who": LINE[lid][0], "text": LINE[lid][1], "take": f"{lid}_{n}", "dur": round(len(y) / sr, 3),
                 "words": [(w, round(s, 3), round(e, 3)) for w, s, e in words(out)]}
    json.dump(meta, open(meta_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{lid}: take {n}, {meta[lid]['dur']}s", "".join(w for w, _, _ in meta[lid]["words"]))


if __name__ == "__main__":
    args = sys.argv[1:]
    n = 1
    if "--n" in args:
        i = args.index("--n"); n = int(args[i + 1]); del args[i:i + 2]
    stage, rest = args[0], args[1:]
    ids = [a for a in rest if a in LINE] or list(LINE)
    if stage == "takes":
        stage_takes(ids, n)
    elif stage == "score":
        stage_score(ids)
    elif stage == "pick":
        for lid, k in zip(rest[::2], rest[1::2]):
            install(lid, int(k))
