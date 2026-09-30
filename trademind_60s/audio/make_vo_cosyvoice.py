"""Narration takes with Fun-CosyVoice3-0.5B (Apache-2.0), natural-language
style control ("instruct2"): confident, brisk ad-narration delivery.

Voices: male timbre from CosyVoice-300M-SFT stock speaker "中文男" (reference
clip audio/voices/male_ref.wav), female timbre from the official zero-shot
prompt (audio/voices/female_ref.wav). The instruction drives the delivery;
the reference only sets the timbre.

For each line: N seeds x both voices -> every take transcribed with
SenseVoice; per line the seed with the best combined score (accuracy first,
then pitch liveliness) is kept for both voices, so the two voices share one
edit timeline. Writes output/takes/<voice>_<seg>.wav (24 kHz) and
output/takes/takes.json.

Env: COSYVOICE_SRC (CosyVoice code, e.g. the HF Space FunAudioLLM/Fun-CosyVoice3-0.5B),
     COSYVOICE_MODEL (Fun-CosyVoice3-0.5B dir), plus the TTS_MODELS dir used by tts_common.
"""
import json
import os
import sys
import time
import types

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ["COSYVOICE_SRC"]
sys.path += [SRC, os.path.join(SRC, "third_party/Matcha-TTS"), HERE]

# narration is plain text: no number/symbol normalisation needed (wetext stub)
_w = types.ModuleType("wetext")


class _Normalizer:
    def __init__(self, *a, **k):
        pass

    def normalize(self, text):
        return text


_w.Normalizer = _Normalizer
sys.modules["wetext"] = _w

import scipy.signal as ss  # noqa: E402
import torch  # noqa: E402
from cosyvoice.cli.cosyvoice import AutoModel  # noqa: E402
from cosyvoice.utils.common import set_all_random_seed  # noqa: E402
from narration import SEGMENTS  # noqa: E402
from tts_common import cer, load_asr, transcribe  # noqa: E402

torch.set_num_threads(os.cpu_count() or 4)
OUT = os.path.join(HERE, "..", "output", "takes")
VOICES = {"male": os.path.join(HERE, "voices", "male_ref.wav"), "female": os.path.join(HERE, "voices", "female_ref.wav")}
STYLE = "请用自信有力、语速偏快、节奏明快、富有感染力的广告旁白语气说这句话。"
BRAND = "请用明亮、有力量、充满信心的品牌口号语气说这句话，语速偏快。"
SPEED = {8: 1.05}  # default 1.15; the brand line lands a touch more deliberately
SEEDS = [1, 7]


def pitch_range(x16):
    win, hop, sr = 640, 160, 16000
    f = []
    for i in range(0, len(x16) - win, hop):
        fr = x16[i:i + win] * np.hanning(win)
        if np.sqrt(np.mean(fr ** 2)) < 0.02:
            continue
        ac = np.correlate(fr, fr, "full")[win - 1:]
        if ac[0] <= 0:
            continue
        k = int(np.argmax(ac[40:266])) + 40
        if ac[k] / ac[0] > 0.45:
            f.append(sr / k)
    if len(f) < 10:
        return 0.0
    st = 12 * np.log2(np.array(f) / np.median(f))
    return float(np.percentile(st, 95) - np.percentile(st, 5))


def main():
    os.makedirs(OUT, exist_ok=True)
    cv = AutoModel(model_dir=os.environ["COSYVOICE_MODEL"])
    asr = load_asr()
    sr = cv.sample_rate
    result = {"sample_rate": sr, "lines": {}}
    for i, (_t0, _t1, _cap, line) in enumerate(SEGMENTS, 1):
        instr = "You are a helpful assistant. " + (BRAND if i == 8 else STYLE) + "<|endofprompt|>"
        cands = []
        for seed in SEEDS:
            takes, score = {}, 0.0
            for v, ref in VOICES.items():
                set_all_random_seed(seed)
                t0 = time.time()
                w = torch.cat([j["tts_speech"] for j in cv.inference_instruct2(line, instr, ref, stream=False, speed=SPEED.get(i, 1.15))], 1).squeeze(0).numpy()
                x16 = ss.resample_poly(w, 16000, sr).astype(np.float32)
                pad = np.concatenate([np.zeros(6400, np.float32), x16, np.zeros(6400, np.float32)])
                hyp = transcribe(asr, pad, 16000)
                c, pr = cer(line, hyp), pitch_range(x16)
                takes[v] = (w, {"dur": round(len(w) / sr, 3), "cer": round(c, 3), "range_st": round(pr, 1), "asr": hyp})
                score += -10 * c + 0.05 * pr
                print(f"L{i} seed {seed} {v:6s} {len(w) / sr:5.2f}s cer {c:.3f} range {pr:4.1f}st ({time.time() - t0:4.1f}s) {hyp}", flush=True)
            cands.append((score, seed, takes))
        score, seed, takes = max(cands, key=lambda c: c[0])
        result["lines"][str(i)] = {"seed": seed, "text": line}
        for v, (w, m) in takes.items():
            sf.write(os.path.join(OUT, f"{v}_{i}.wav"), w, sr)
            result["lines"][str(i)][v] = m
        print(f"L{i}: keep seed {seed}", flush=True)
    with open(os.path.join(OUT, "takes.json"), "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
