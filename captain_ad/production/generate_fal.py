"""AI footage pipeline for 《船长的底牌》 via fal.ai (needs FAL_KEY in the environment).

Stages (each cached on disk; delete a file to regenerate just that item):
  refs      character / prop reference images      -> footage/refs/<NAME>_<n>.png
  keys      per-shot keyframe using the references -> footage/keys/<SHOT>_<n>.png
  video     image-to-video per shot                -> footage/clips/<SHOT>.mp4
  lipsync   dialogue shots, driven by audio/lines  -> footage/clips/<SHOT>_ls.mp4
  upscale   4K upscale of the chosen clip          -> footage/4k/<SHOT>.mp4

Usage:
  python3 generate_fal.py refs              # then review footage/refs, keep the best as <NAME>.png
  python3 generate_fal.py keys [S01 S02 ..] # candidates; keep the best as footage/keys/<SHOT>.png
  python3 generate_fal.py video [shots]
  python3 generate_fal.py lipsync [shots]
  python3 generate_fal.py upscale [shots]
  python3 generate_fal.py all

Model endpoints live in ENDPOINTS so they can be swapped as fal's catalogue
changes (check https://fal.ai/models before a run).
"""
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
FOOT = os.path.join(ROOT, "footage")
SHOTS = json.load(open(os.path.join(HERE, "shots.json"), encoding="utf-8"))

ENDPOINTS = {
    "t2i": "fal-ai/bytedance/seedream/v4/text-to-image",   # reference sheets
    "edit": "fal-ai/nano-banana/edit",                      # keyframes with character refs
    "i2v": "fal-ai/kling-video/v2.1/master/image-to-video",  # motion
    "lipsync": "fal-ai/sync-lipsync/v2",                    # dialogue shots
    "upscale": "fal-ai/topaz/upscale/video",                # 1080p -> 4K
}
NEG = "cartoon, anime, 3d render, plastic skin, distorted hands, extra fingers, text, subtitles, watermark, logo, modern clothing (except the laptop), blurry face"
N_CANDIDATES = 2

REF_PROMPTS = {
    "CAPTAIN": "character reference portrait, three-quarter view, neutral expression, {CAPTAIN}, wearing {CAPTAIN_HAT}, on the deck of a ship at dusk",
    "BOSS": "character reference portrait, three-quarter view, menacing half-smile, {BOSS}, black sails behind",
    "MATE": "character reference portrait, three-quarter view, earnest expression, {MATE}, ship rigging behind",
    "GUNNER": "character reference portrait, {GUNNER}, cannon deck behind",
    "PROPS": "product-style photo on weathered wood: {BAG} next to {LAPTOP}, lid closed",
}


SHORT = {  # inline handles used inside shot prompts
    "CAPTAIN_HAT": "the captain's battered black tricorn hat",
    "CAPTAIN": "the captain (East Asian man in his mid-40s, short black beard, worn wine-red frock coat)",
    "BOSS": "the pirate boss (huge bearded man in a black leather greatcoat, scar through his left eyebrow)",
    "MATE": "the first mate (tall, very thin young East Asian man, dark blue waistcoat, red neckerchief)",
    "GUNNER": "a scruffy young pirate gunner with a faded red bandana",
    "BAG": "a black roll-top waterproof dry bag",
    "LAPTOP": "a modern slim space-grey laptop",
    "MERCHANT_SHIP": "the merchant ship",
    "PIRATE_SHIP": "the black-sailed pirate galleon",
}


def fmt(s):
    """Expand {NAME} to the full character bible and bare NAME to its short handle."""
    import re
    s = s.format(**SHOTS["characters"])
    for k in sorted(SHORT, key=len, reverse=True):
        s = re.sub(rf"\b{k}\b", SHORT[k], s)
    return s


def fal():
    import fal_client  # pip install fal-client
    if not os.environ.get("FAL_KEY"):
        sys.exit("FAL_KEY is not set: add it as an environment variable in the environment settings")
    return fal_client


def run(endpoint, args, tries=3):
    fc = fal()
    for k in range(tries):
        try:
            t0 = time.time()
            res = fc.subscribe(endpoint, arguments=args, with_logs=False)
            print(f"  {endpoint} ok in {time.time() - t0:.0f}s")
            return res
        except Exception as e:  # network / queue hiccups
            print(f"  {endpoint} failed ({e}); retry {k + 1}/{tries}")
            time.sleep(5 * (k + 1))
    raise RuntimeError(endpoint)


def download(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    urllib.request.urlretrieve(url, path)
    return path


def upload(path):
    return fal().upload_file(path)


def first_url(res, key):
    v = res[key]
    if isinstance(v, list):
        v = v[0]
    return v["url"] if isinstance(v, dict) else v


def stage_refs():
    for name, p in REF_PROMPTS.items():
        for n in range(N_CANDIDATES):
            out = os.path.join(FOOT, "refs", f"{name}_{n}.png")
            if os.path.exists(out):
                continue
            print("ref", name, n)
            res = run(ENDPOINTS["t2i"], {"prompt": fmt(p) + ", " + SHOTS["style"], "image_size": {"width": 1536, "height": 2048}, "num_images": 1, "seed": 100 + n})
            download(first_url(res, "images"), out)


def chosen(kind, name):
    """The reviewed pick (<name>.png) or, failing that, candidate 0."""
    d = os.path.join(FOOT, kind)
    for f in (f"{name}.png", f"{name}_0.png"):
        if os.path.exists(os.path.join(d, f)):
            return os.path.join(d, f)
    return None


def shots_for(ids, kinds):
    return [s for s in SHOTS["shots"] if s["kind"] in kinds and (not ids or s["id"] in ids)]


def stage_keys(ids):
    for s in shots_for(ids, ("ai", "ai_lipsync")):
        refs = [chosen("refs", c) for c in s["chars"] if c in REF_PROMPTS]
        refs += [chosen("refs", "PROPS")] if any(c in ("BAG", "LAPTOP") for c in s["chars"]) else []
        refs = [upload(r) for r in refs if r]
        for n in range(N_CANDIDATES):
            out = os.path.join(FOOT, "keys", f"{s['id']}_{n}.png")
            if os.path.exists(out):
                continue
            prompt = fmt(s["image"]) + ". Keep every character's face, hair and costume exactly as in the reference images. 16:9 widescreen frame. " + SHOTS["style"]
            print("key", s["id"], n)
            args = {"prompt": prompt, "num_images": 1, "aspect_ratio": "16:9"}
            if refs:
                args["image_urls"] = refs
                res = run(ENDPOINTS["edit"], args)
            else:
                res = run(ENDPOINTS["t2i"], {"prompt": prompt, "image_size": {"width": 2048, "height": 1152}, "num_images": 1, "seed": 200 + n})
            download(first_url(res, "images"), out)


def stage_video(ids):
    for s in shots_for(ids, ("ai", "ai_lipsync")):
        out = os.path.join(FOOT, "clips", f"{s['id']}.mp4")
        if os.path.exists(out):
            continue
        key = chosen("keys", s["id"])
        if not key:
            print("no keyframe for", s["id"]); continue
        print("video", s["id"])
        res = run(ENDPOINTS["i2v"], {"prompt": fmt(s["motion"]) + ", cinematic, realistic motion, " + SHOTS["style"], "image_url": upload(key), "duration": "5", "negative_prompt": NEG, "cfg_scale": 0.5})
        download(first_url(res, "video"), out)


def stage_lipsync(ids):
    for s in shots_for(ids, ("ai_lipsync",)):
        clip = os.path.join(FOOT, "clips", f"{s['id']}.mp4")
        line = os.path.join(ROOT, "audio", "lines", f"{s['id']}.wav")
        out = os.path.join(FOOT, "clips", f"{s['id']}_ls.mp4")
        if os.path.exists(out) or not (os.path.exists(clip) and os.path.exists(line)):
            continue
        print("lipsync", s["id"])
        res = run(ENDPOINTS["lipsync"], {"video_url": upload(clip), "audio_url": upload(line), "sync_mode": "cut_off"})
        download(first_url(res, "video"), out)


def stage_upscale(ids):
    for s in shots_for(ids, ("ai", "ai_lipsync")):
        src = os.path.join(FOOT, "clips", f"{s['id']}_ls.mp4")
        src = src if os.path.exists(src) else os.path.join(FOOT, "clips", f"{s['id']}.mp4")
        out = os.path.join(FOOT, "4k", f"{s['id']}.mp4")
        if os.path.exists(out) or not os.path.exists(src):
            continue
        print("upscale", s["id"])
        res = run(ENDPOINTS["upscale"], {"video_url": upload(src), "upscale_factor": 2})
        download(first_url(res, "video"), out)


if __name__ == "__main__":
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    ids = sys.argv[2:]
    stages = {"refs": lambda: stage_refs(), "keys": lambda: stage_keys(ids), "video": lambda: stage_video(ids),
              "lipsync": lambda: stage_lipsync(ids), "upscale": lambda: stage_upscale(ids)}
    for name in (stages if stage == "all" else [stage]):
        stages[name]()
