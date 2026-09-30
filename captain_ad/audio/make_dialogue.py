"""Perform every dialogue line with Fun-CosyVoice3-0.5B (Apache-2.0).

Each line in production/shots.json carries who speaks and an acting note
(emo). The role's timbre comes from audio/voices/<role>_ref.wav; the acting
comes from the instruction. Several takes per line are transcribed with
SenseVoice; the most accurate take is kept (ties -> the one closest to the
shot length). Writes audio/lines/<shot>.wav (24 kHz) + lines.json.

Env: COSYVOICE_SRC, COSYVOICE_MODEL (see trademind_60s/README.md), TTS_MODELS.
"""
import json
import os
import sys
import types

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ["COSYVOICE_SRC"]
sys.path += [SRC, os.path.join(SRC, "third_party/Matcha-TTS"), os.path.join(HERE, "..", "..", "trademind_60s", "audio")]
_w = types.ModuleType("wetext")


class _N:
    def __init__(self, *a, **k):
        pass

    def normalize(self, t):
        return t


_w.Normalizer = _N
sys.modules["wetext"] = _w

import scipy.signal as ss  # noqa: E402
import torch  # noqa: E402
from cosyvoice.cli.cosyvoice import AutoModel  # noqa: E402
from cosyvoice.utils.common import set_all_random_seed  # noqa: E402
from tts_common import cer, load_asr, transcribe  # noqa: E402

torch.set_num_threads(os.cpu_count() or 4)
OUT = os.path.join(HERE, "lines")
VOICE = {"CAPTAIN": "captain", "BOSS": "boss", "MATE": "mate", "GUNNER": "gunner"}
SEEDS = [1, 7, 23]
# synthesis-only text tweaks: breath marks for the key relief line
SAY = {"S27": "[breath]还好……[breath]账号还在。"}


def main():
    os.makedirs(OUT, exist_ok=True)
    shots = json.load(open(os.path.join(HERE, "..", "production", "shots.json"), encoding="utf-8"))["shots"]
    cv = AutoModel(model_dir=os.environ["COSYVOICE_MODEL"])
    asr = load_asr()
    sr = cv.sample_rate
    result = {}
    for s in shots:
        if "line" not in s:
            continue
        ln = s["line"]
        ref = os.path.join(HERE, "voices", VOICE[ln["who"]] + "_ref.wav")
        instr = f"You are a helpful assistant. 请用{ln['emo']}的语气说这句话。<|endofprompt|>"
        takes = []
        for seed in SEEDS:
            for text in dict.fromkeys([SAY.get(s["id"], ln["text"]), ln["text"]]):
                set_all_random_seed(seed)
                w = torch.cat([j["tts_speech"] for j in cv.inference_instruct2(text, instr, ref, stream=False)], 1).squeeze(0).numpy()
                x16 = ss.resample_poly(w, 16000, sr).astype(np.float32)
                pad = np.concatenate([np.zeros(6400, np.float32), x16, np.zeros(6400, np.float32)])
                hyp = transcribe(asr, pad, 16000)
                c = cer(ln["text"], hyp)
                d = len(w) / sr
                takes.append((c, abs(d - s["dur"]), seed, text, w, hyp))
                print(f"{s['id']} {ln['who']:7s} seed {seed:2d} {d:5.2f}s (slot {s['dur']}) cer {c:.2f} | {hyp}", flush=True)
        c, _, seed, text, w, hyp = min(takes, key=lambda x: (round(x[0], 2), x[1]))
        sf.write(os.path.join(OUT, f"{s['id']}.wav"), w, sr)
        result[s["id"]] = {"who": ln["who"], "text": ln["text"], "said": text, "seed": seed, "dur": round(len(w) / sr, 3), "cer": round(c, 3), "asr": hyp}
        print(f"{s['id']}: keep seed {seed} ({len(w) / sr:.2f}s)", flush=True)
    json.dump(result, open(os.path.join(OUT, "lines.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
