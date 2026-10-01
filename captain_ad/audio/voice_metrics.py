"""Objective read on how a line is delivered, for picking takes without listening:
what was said (faster-whisper ASR, character error rate against the script), how fast,
how loud, how high and how strained (share of energy above 1.5 kHz rises when a voice
is pushed into a shout).

  python3 voice_metrics.py <wav> [<wav> ...] --text "船长！快跳！要炸了！"
"""
import re
import sys

import librosa
import numpy as np

_asr = None


def asr(path):
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel
        _asr = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = _asr.transcribe(path, language="zh", beam_size=5, initial_prompt="以下是普通话的句子。")
    return "".join(s.text for s in segs)


def words(path):
    """[(word, start, end)] from the same ASR model."""
    asr(path)  # loads the model
    segs, _ = _asr.transcribe(path, language="zh", beam_size=5, word_timestamps=True, initial_prompt="以下是普通话的句子。")
    return [(w.word, w.start, w.end) for seg in segs for w in seg.words]


def hanzi(t):
    return re.sub(r"[^一-鿿A-Za-z]", "", t).upper()


def cer(ref, hyp):
    r, h = hanzi(ref), hanzi(hyp)
    d = np.arange(len(h) + 1)
    for i, rc in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (rc != hc))
    return d[len(h)] / max(1, len(r))


def metrics(path, text):
    y, sr = librosa.load(path, sr=24000, mono=True)
    yt, _ = librosa.effects.trim(y, top_db=35)
    dur = len(yt) / sr
    rms = librosa.feature.rms(y=yt)[0]
    voiced = rms > rms.max() * 0.1
    loud = 20 * np.log10(np.sqrt((yt ** 2).mean()) + 1e-9)
    f0, vflag, _ = librosa.pyin(yt, fmin=60, fmax=600, sr=sr)
    f0 = f0[vflag] if vflag.any() else np.array([np.nan])
    S = np.abs(librosa.stft(yt)) ** 2
    freqs = librosa.fft_frequencies(sr=sr)
    hf = S[freqs > 1500].sum() / S.sum()
    said = asr(path)
    return {"dur": round(dur, 2), "cps": round(len(hanzi(text)) / dur, 1), "dBFS": round(loud, 1),
            "f0_med": round(float(np.nanmedian(f0)), 0), "f0_p90": round(float(np.nanpercentile(f0, 90)), 0),
            "hf%": round(100 * hf, 1), "voiced%": round(100 * voiced.mean(), 0), "cer": round(cer(text, said), 2), "asr": said}


if __name__ == "__main__":
    args = sys.argv[1:]
    i = args.index("--text")
    text = args[i + 1]
    for p in args[:i] + args[i + 2:]:
        print(p.split("/")[-1], metrics(p, text))
