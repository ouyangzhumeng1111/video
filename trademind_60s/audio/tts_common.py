"""Shared helpers: offline Kokoro v1.1-zh TTS + SenseVoice ASR (sherpa-onnx)."""
import os
import numpy as np
import sherpa_onnx

MODELS = os.environ.get(
    "TTS_MODELS",
    "/tmp/claude-0/-home-user-video/8d846da8-c112-5831-8e25-f3d66e59fb96/scratchpad/tts",
)
KOKORO = f"{MODELS}/kokoro-multi-lang-v1_1"
SENSE = f"{MODELS}/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"


def load_tts():
    d = KOKORO
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=f"{d}/model.onnx",
                voices=f"{d}/voices.bin",
                tokens=f"{d}/tokens.txt",
                data_dir=f"{d}/espeak-ng-data",
                dict_dir=f"{d}/dict",
                lexicon=f"{d}/lexicon-us-en.txt,{d}/lexicon-zh.txt",
            ),
            num_threads=4,
        ),
        rule_fsts=f"{d}/phone-zh.fst,{d}/date-zh.fst,{d}/number-zh.fst",
        max_num_sentences=1,
    )
    return sherpa_onnx.OfflineTts(cfg)


def load_asr():
    return sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=f"{SENSE}/model.int8.onnx",
        tokens=f"{SENSE}/tokens.txt",
        num_threads=4,
        use_itn=True,
        language="auto",
    )


def transcribe(asr, samples, sr):
    s = asr.create_stream()
    s.accept_waveform(sr, samples)
    asr.decode_stream(s)
    return s.result.text


def f0_median(x, sr):
    """Crude autocorrelation pitch estimate (Hz) over voiced frames."""
    win, hop = int(0.04 * sr), int(0.01 * sr)
    lo, hi = int(sr / 300), int(sr / 60)
    f0s = []
    for i in range(0, len(x) - win, hop):
        fr = x[i:i + win] * np.hanning(win)
        if np.sqrt(np.mean(fr ** 2)) < 0.02:
            continue
        ac = np.correlate(fr, fr, "full")[win - 1:]
        if ac[0] <= 0:
            continue
        seg = ac[lo:hi]
        k = int(np.argmax(seg)) + lo
        if ac[k] / ac[0] > 0.45:
            f0s.append(sr / k)
    return float(np.median(f0s)) if f0s else 0.0


def cer(ref, hyp):
    import re
    norm = lambda s: re.sub(r"[\s，。、？！：·,.?!:]", "", s).lower()
    r, h = norm(ref), norm(hyp)
    d = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / max(1, len(r))
