"""AI footage pipeline for 《船长的底牌》 on Runway (needs RUNWAYML_API_SECRET in the environment).

Built to land the whole film on about 1000 credits: Runway does the pictures, everything
else (voices, music, inserts, 4K, edit) is local.

Stages (each cached on disk; delete a file to regenerate just that item):
  refs     Gen-4 Image character / prop sheets                     -> footage/refs/<NAME>_<n>.png
  keys     keyframe per shot: Gen-4 Image Turbo with the characters as
           @Captain / @Boss / @Mate / @Gunner / @Props references,
           plain Gen-4 Image (720p) for shots with nobody in them    -> footage/keys/<SHOT>_<n>.png
  video    Gen-4 Turbo image-to-video, every shot whose sync is not
           "avatar" (dialogue shots staged wide, from behind or in profile) -> footage/clips/<SHOT>.mp4
  talk     dialogue shots with sync "avatar": the keyframe becomes a Runway
           Character and speaks the recorded line (audio/lines/<SHOT>.wav),
           cut so the line lands where the edit expects it          -> footage/clips/<SHOT>_ls.mp4

Every generation is kept in footage/raw/<SHOT>_<n>.mp4 with a .json sidecar (task id,
model, seed, prompt, in-point). Reviewed picks: save the best candidate as
footage/refs/<NAME>.png or footage/keys/<SHOT>.png, or copy a take over footage/clips/.

Usage:
  python3 generate_runway.py budget              # credit estimate, rates from docs.dev.runwayml.com/guides/pricing
  python3 generate_runway.py check               # prompt lengths; request bodies too while the balance is 0
  python3 generate_runway.py refs
  python3 generate_runway.py keys [S01 S02 ..]
  python3 generate_runway.py video [shots] [--takes N] [--model gen4.5]
  python3 generate_runway.py talk [shots]
  python3 generate_runway.py all

Model ids and rates live in MODELS / RATE so they can be swapped as Runway's catalogue
changes (check docs.dev.runwayml.com/guides/models and /guides/pricing before a run).
"""
import base64
import io
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time

import numpy as np
import requests
import soundfile as sf
from PIL import Image

from generate_fal import FOOT, NEG, REF_PROMPTS, ROOT, SHORT, SHOTS, chosen, fmt, shots_for

API = "https://api.dev.runwayml.com"
VERSION = "2024-11-06"
MODELS = {
    "sheet": "gen4_image",          # reference sheets, and keyframes with nobody in them
    "key": "gen4_image_turbo",      # keyframes with 1-3 tagged references
    "video": "gen4_turbo",          # motion; pass --model gen4.5 to upgrade a shot
    "avatar": "gwm1_avatars",       # lip-synced dialogue from a keyframe + the recorded line
}
RATE = {  # credits, from https://docs.dev.runwayml.com/guides/pricing (checked 2026-10-01)
    "gen4_image_1080p": 8, "gen4_image_720p": 5, "gen4_image_turbo": 2,
    "gen4_turbo": 5, "gen4.5": 12,  # per second
    "gwm1_avatars_start": 2, "gwm1_avatars_per6s": 2,
}
TAGS = {"CAPTAIN": "Captain", "BOSS": "Boss", "MATE": "Mate", "GUNNER": "Gunner", "PROPS": "Props"}
N_KEYS = 2          # candidates per keyframe with references (Turbo is cheap); 1 for plain shots
LEAD = 0.5          # silence before the line in the avatar's audio
HANDLE = 0.25       # extra seconds kept after each shot
FPS = SHOTS["fps"]
LINES = json.load(open(os.path.join(ROOT, "audio", "lines", "lines.json"), encoding="utf-8"))


# ---------------------------------------------------------------- API plumbing

def headers():
    key = os.environ.get("RUNWAYML_API_SECRET")
    if not key:
        sys.exit("RUNWAYML_API_SECRET is not set: add it as an environment variable in the environment settings")
    return {"Authorization": f"Bearer {key}", "X-Runway-Version": VERSION}


def api(method, path, body=None, tries=4):
    for k in range(tries):
        try:
            r = requests.request(method, API + path, headers=headers(), json=body, timeout=120)
        except requests.RequestException as e:
            print(f"  {path}: {e}; retry {k + 1}/{tries}")
            time.sleep(2 ** (k + 1))
            continue
        if r.status_code == 429 or r.status_code >= 500:
            print(f"  {path}: HTTP {r.status_code}; retry {k + 1}/{tries}")
            time.sleep(2 ** (k + 2))
            continue
        return r
    raise RuntimeError(f"{method} {path} kept failing")


def organization():
    return api("GET", "/v1/organization").json()


def need_credits(estimate):
    bal = organization().get("creditBalance", 0)
    print(f"balance {bal} credits, this step about {estimate:.0f}")
    if bal < estimate:
        sys.exit("Not enough Runway credits: buy more at https://dev.runwayml.com (Billing), then run again.")


def data_uri(path, max_bytes):
    """Inline a local file; images over the limit are re-encoded as JPEG."""
    ext = os.path.splitext(path)[1].lower()
    raw = open(path, "rb").read()
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".wav": "audio/wav", ".mp4": "video/mp4"}[ext]
    if ext == ".png" and len(raw) > max_bytes:
        buf = io.BytesIO()
        Image.open(path).convert("RGB").save(buf, "JPEG", quality=93)
        raw, mime = buf.getvalue(), "image/jpeg"
    if len(raw) > max_bytes:
        return upload(path)
    return f"data:{mime};base64," + base64.b64encode(raw).decode()


def upload(path):
    j = api("POST", "/v1/uploads", {"filename": os.path.basename(path), "type": "ephemeral"}).json()
    if "uploadUrl" not in j:
        raise RuntimeError(f"upload refused: {j}")
    with open(path, "rb") as fh:
        requests.post(j["uploadUrl"], data=j["fields"], files={"file": (os.path.basename(path), fh)}, timeout=600).raise_for_status()
    return j["runwayUri"]


IMG = lambda p: data_uri(p, 3_300_000)    # 5 MB data URI limit after base64
MEDIA = lambda p: data_uri(p, 11_000_000)  # 16 MB for audio / video


def submit(path, body):
    r = api("POST", path, body)
    if r.status_code != 200:
        raise RuntimeError(f"{path} {r.status_code}: {r.text[:800]}")
    return r.json()["id"]


def run_jobs(jobs, model):
    """jobs: list of (label, endpoint, body, on_done(urls, task)). Keeps the tier's concurrency busy;
    anything over it is queued by Runway as THROTTLED."""
    conc = organization().get("tier", {}).get("models", {}).get(model, {}).get("maxConcurrentGenerations", 1)
    todo, live, failed = list(jobs), {}, []
    while todo or live:
        while todo and len(live) < conc:
            label, path, body, done = todo.pop(0)
            try:
                tid = submit(path, body)
            except RuntimeError as e:
                print(f"  {label}: {e}"); failed.append(label); continue
            live[tid] = (label, done, time.time())
            print(f"  {label}: task {tid}")
        time.sleep(6)
        for tid in list(live):
            label, done, t0 = live[tid]
            t = api("GET", f"/v1/tasks/{tid}").json()
            st = t.get("status")
            if st == "SUCCEEDED":
                del live[tid]
                cost = t.get("cost", {}).get("credits", "?")
                print(f"  {label}: done in {time.time() - t0:.0f}s ({cost} credits)")
                try:
                    done(t["output"], t)
                except Exception as e:  # keep the other tasks going; the output stays fetchable by task id
                    failed.append(label)
                    print(f"  {label}: saving task {tid} failed: {e}")
            elif st in ("FAILED", "CANCELLED"):
                del live[tid]
                failed.append(label)
                print(f"  {label}: {st} {t.get('failureCode', '')} {t.get('failure', '')}")
    if failed:
        print("failed:", " ".join(failed), "(moderation failures are billed; reword before retrying)")
    return failed


def download(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(path + ".part", "wb") as fh:
            for chunk in r.iter_content(1 << 20):
                fh.write(chunk)
    if path.endswith(".png"):  # outputs may come back as JPEG/WebP
        Image.open(path + ".part").convert("RGB").save(path)
        os.remove(path + ".part")
    else:
        os.replace(path + ".part", path)
    return path


def sidecar(path, **kw):
    json.dump(kw, open(os.path.splitext(path)[0] + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def sh(cmd):
    subprocess.run(cmd, check=True)


def media_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


# ---------------------------------------------------------------- prompts

RUNWAY_REF = {  # Gen-4 Image drifted on these with the shared prompts (full body, wrong face)
    "CAPTAIN": "chest-up character reference portrait, three-quarter view, the face large and sharp in frame: a Chinese man "
               "in his mid-40s with Han Chinese features and dark brown eyes, short neatly trimmed black "
               "beard with a few grey hairs, weathered tanned skin, tired intelligent eyes, {CAPTAIN_HAT}, worn wine-red wool "
               "frock coat with tarnished brass buttons over a cream linen shirt, the captain of a merchant sailing ship, "
               "deck and rigging softly out of focus at dusk",
}


def ref_body(name, n):
    ratio = "1440:1080" if name == "PROPS" else "1080:1440"
    prompt = fmt(RUNWAY_REF.get(name, REF_PROMPTS[name])) + ", " + SHOTS["style"]
    return {"model": MODELS["sheet"], "promptText": prompt, "ratio": ratio, "seed": 100 + n}


HAT_TAKEN = next(x["t"] for x in SHOTS["shots"] if x["id"] == "S07")  # the boss takes the captain's hat here
NOHAT_PROMPT = ("chest-up character reference portrait of @Captain, the same man with the same face, beard and wine-red frock "
                "coat, now bareheaded with no hat, short black hair slightly dishevelled, soot on his cheek, on the deck of a "
                "ship at dusk. ")


def ref_path(s, name, pick):
    """Reference sheet for a character in shot s: after S07 the captain has lost his hat."""
    if name == "CAPTAIN" and s["t"] > HAT_TAKEN and pick("refs", "CAPTAIN_NOHAT"):
        return pick("refs", "CAPTAIN_NOHAT")
    return pick("refs", name)


def tagged(text, tags):
    """fmt() with referenced characters written as @Tag so Gen-4 binds them to the reference images."""
    text = text.format(**SHOTS["characters"])
    for name, tag in tags.items():
        text = re.sub(rf"\b{name}\b", f"@{tag}", text)
    return fmt(text)


def shot_refs(s, pick):
    """Up to three reference images for a shot, characters first, props if room."""
    names = [c for c in s["chars"] if c in TAGS and c != "PROPS"]
    if any(c in ("BAG", "LAPTOP") for c in s["chars"]):
        names.append("PROPS")
    return [n for n in names if pick("refs", n)][:3]


def key_body(s, n, pick=chosen):
    names = shot_refs(s, pick)
    tags = {k: TAGS[k] for k in names if k != "PROPS"}
    prompt = tagged(s["image"], tags)
    if "PROPS" in names:
        prompt += ". The dry bag and laptop look exactly like @Props"
    if "LAPTOP" in s["chars"]:
        prompt += "; the laptop is unbranded, plain lid, no logo"
    elif "BAG" in s["chars"]:
        prompt += "; the bag is rolled shut, the laptop is hidden inside it and not visible"
    if "CAPTAIN" in tags and s["t"] > HAT_TAKEN:
        prompt += ". @Captain is bareheaded, no hat (the pirate boss took it)"
    if tags:
        prompt += ". " + ", ".join(f"@{t}" for t in tags.values()) + " keep the exact face, hair and costume of the reference"
    prompt += ". 16:9 widescreen film frame. " + SHOTS["style"]
    if names:
        return {"model": MODELS["key"], "promptText": prompt, "ratio": "1920:1080", "seed": 200 + n,
                "referenceImages": [{"uri": IMG(ref_path(s, k, pick)), "tag": TAGS[k]} for k in names]}
    return {"model": MODELS["sheet"], "promptText": prompt, "ratio": "1280:720", "seed": 200 + n}


def key_cost(body):
    return RATE["gen4_image_turbo"] if body["model"] == "gen4_image_turbo" else RATE["gen4_image_720p"]


def video_secs(s):
    return min(10, max(2, math.ceil(s["dur"] + HANDLE)))


def video_body(s, key, take, model):
    prompt = fmt(s["motion"]) + ". Cinematic live-action, realistic physical motion, steady anamorphic framing. " + SHOTS["style"]
    return {"model": model, "promptImage": [{"uri": IMG(key), "position": "first"}], "promptText": prompt,
            "ratio": "1280:720", "duration": video_secs(s), "seed": 300 + take}


def avatar_secs(s):
    return LEAD - s["line"].get("offset", 0.15) + s["dur"] + HANDLE


def avatar_cost(s):
    return RATE["gwm1_avatars_start"] + RATE["gwm1_avatars_per6s"] * math.ceil(avatar_secs(s) / 6)


def needs(s, stage):
    if s["kind"] not in ("ai", "ai_lipsync"):
        return False
    return (s.get("sync") == "avatar") == (stage == "talk")


# ---------------------------------------------------------------- stages

def stage_refs():
    jobs = []
    for name in REF_PROMPTS:
        for n in range(N_KEYS):
            out = os.path.join(FOOT, "refs", f"{name}_{n}.png")
            if not os.path.exists(out) and not chosen("refs", name):
                jobs.append((f"ref {name}_{n}", "/v1/text_to_image", ref_body(name, n),
                             lambda urls, t, out=out: download(urls[0], out)))
    if chosen("refs", "CAPTAIN") and not os.path.exists(os.path.join(FOOT, "refs", "CAPTAIN_NOHAT.png")):
        for n in range(N_KEYS):  # derived from the chosen sheet so the face carries over
            out = os.path.join(FOOT, "refs", f"CAPTAIN_NOHAT_{n}.png")
            if not os.path.exists(out):
                body = {"model": MODELS["key"], "promptText": NOHAT_PROMPT + SHOTS["style"], "ratio": "1080:1440", "seed": 150 + n,
                        "referenceImages": [{"uri": IMG(chosen("refs", "CAPTAIN")), "tag": "Captain"}]}
                jobs.append((f"ref CAPTAIN_NOHAT_{n}", "/v1/text_to_image", body, lambda urls, t, out=out: download(urls[0], out)))
    if jobs:
        need_credits(sum(RATE["gen4_image_turbo"] if j[2]["model"] == MODELS["key"] else RATE["gen4_image_1080p"] for j in jobs))
        for model in {b["model"] for _, _, b, _ in jobs}:
            run_jobs([j for j in jobs if j[2]["model"] == model], model)


def stage_keys(ids):
    jobs, cost = {}, {}
    for s in shots_for(ids, ("ai", "ai_lipsync")):
        if os.path.exists(os.path.join(FOOT, "keys", f"{s['id']}.png")):
            continue  # a reviewed pick exists
        for n in range(N_KEYS):
            out = os.path.join(FOOT, "keys", f"{s['id']}_{n}.png")
            body = key_body(s, n)
            if os.path.exists(out) or (n and body["model"] != MODELS["key"]):
                continue
            jobs.setdefault(body["model"], []).append(
                (f"key {s['id']}_{n}", "/v1/text_to_image", body,
                 lambda urls, t, out=out, b=body: (download(urls[0], out), sidecar(out, task=t["id"], model=b["model"], prompt=b["promptText"]))))
            cost[body["model"]] = cost.get(body["model"], 0) + key_cost(body)
    if jobs:
        need_credits(sum(cost.values()))
        for model, js in jobs.items():
            run_jobs(js, model)


def stage_video(ids, n_takes=None, model=None):
    model = model or MODELS["video"]
    jobs, cost = [], 0
    for s in shots_for(ids, ("ai", "ai_lipsync")):
        if not needs(s, "video"):
            continue
        key = chosen("keys", s["id"])
        if not key:
            print("no keyframe for", s["id"]); continue
        for k in range(n_takes or 1):
            raw = os.path.join(FOOT, "raw", f"{s['id']}_{model}_{k}.mp4")
            if os.path.exists(raw) or (not n_takes and os.path.exists(os.path.join(FOOT, "clips", f"{s['id']}.mp4"))):
                continue
            body = video_body(s, key, k, model)
            cost += body["duration"] * RATE[model]

            def done(urls, t, s=s, raw=raw, body=body):
                download(urls[0], raw)
                sidecar(raw, task=t["id"], model=body["model"], seed=body["seed"], prompt=body["promptText"],
                        key=os.path.basename(chosen("keys", s["id"])), inpoint=0.0)
                clip = os.path.join(FOOT, "clips", f"{s['id']}.mp4")
                if not os.path.exists(clip):
                    os.makedirs(os.path.dirname(clip), exist_ok=True)
                    sh(["cp", raw, clip])
            jobs.append((f"video {s['id']}_{k}", "/v1/image_to_video", body, done))
    if jobs:
        need_credits(cost)
        run_jobs(jobs, model)


def envelope(x, sr, hop=0.01):
    n = int(sr * hop)
    x = x[: len(x) // n * n].reshape(-1, n)
    return np.sqrt((x ** 2).mean(1) + 1e-9)


def speech_start(clip, line_wav, default):
    """Where the recorded line begins inside a rendered clip: cross-correlate the clip's own
    audio envelope with the line's. Falls back to `default`."""
    try:
        with tempfile.TemporaryDirectory() as d:
            a = os.path.join(d, "a.wav")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "quiet", "-i", clip, "-vn", "-ac", "1", "-ar", "16000", a], check=True)
            g, sr = sf.read(a, dtype="float32")
    except subprocess.CalledProcessError:
        return default, 0.0
    ln, lsr = sf.read(line_wav, dtype="float32")
    if ln.ndim > 1:
        ln = ln.mean(1)
    eg, el = np.log(envelope(g, sr)), np.log(envelope(ln, lsr))
    eg, el = eg - eg.mean(), el - el.mean()
    if len(eg) <= len(el):
        return default, 0.0
    c = np.correlate(eg, el, "valid")
    c = c / (np.sqrt(np.convolve(eg ** 2, np.ones(len(el)), "valid") * (el ** 2).sum()) + 1e-9)
    i = int(c.argmax())
    return (i * 0.01, float(c[i])) if c[i] > 0.35 else (default, float(c[i]))


def line_audio(s, path):
    """The recorded line with LEAD seconds of silence in front, padded to cover the whole shot."""
    x, sr = sf.read(os.path.join(ROOT, "audio", "lines", f"{s['id']}.wav"), dtype="float32")
    y = np.zeros(int(max(avatar_secs(s), LEAD + len(x) / sr) * sr) + 1, np.float32)
    y[int(LEAD * sr): int(LEAD * sr) + len(x)] = x
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, y, sr, subtype="PCM_16")
    return path


def make_avatar(s, key):
    body = {"name": f"captain_ad_{s['id']}", "referenceImage": IMG(key), "imageProcessing": "none",
            "personality": "A character in a cinematic short film. Stay in character.",
            "voice": {"type": "runway-live-preset", "presetId": "vincent"}}
    r = api("POST", "/v1/avatars", body)
    if r.status_code != 200:
        raise RuntimeError(f"/v1/avatars {r.status_code}: {r.text[:800]}")
    aid = r.json()["id"]
    for _ in range(100):
        a = api("GET", f"/v1/avatars/{aid}").json()
        if a["status"] == "READY":
            return aid
        if a["status"] == "FAILED":
            raise RuntimeError(f"avatar for {s['id']} failed: {a.get('failureReason')}")
        time.sleep(6)
    raise RuntimeError(f"avatar for {s['id']} never became ready")


def stage_talk(ids):
    todo = [s for s in shots_for(ids, ("ai_lipsync",)) if needs(s, "talk")
            and not os.path.exists(os.path.join(FOOT, "clips", f"{s['id']}_ls.mp4"))]
    todo = [s for s in todo if chosen("keys", s["id"]) or print("no keyframe for", s["id"])]
    if not todo:
        return
    need_credits(sum(avatar_cost(s) for s in todo))
    jobs, avatars = [], []
    try:
        for s in todo:
            key = chosen("keys", s["id"])
            aid = make_avatar(s, key)
            avatars.append(aid)
            wav = line_audio(s, os.path.join(FOOT, "raw", f"{s['id']}_line.wav"))
            body = {"model": MODELS["avatar"], "avatar": {"type": "custom", "avatarId": aid},
                    "speech": {"type": "audio", "audio": MEDIA(wav)}}

            def done(urls, t, s=s, key=key, aid=aid):
                raw = os.path.join(FOOT, "raw", f"{s['id']}_avatar.mp4")
                download(urls[0], raw)
                # the avatar speaks our audio verbatim, so the line sits at LEAD; the measurement is a sanity check
                at, score = speech_start(raw, os.path.join(ROOT, "audio", "lines", f"{s['id']}.wav"), LEAD)
                inpoint = max(0.0, LEAD - s["line"].get("offset", 0.15))
                sidecar(raw, task=t["id"], model=MODELS["avatar"], avatar=aid, key=os.path.basename(key),
                        speech_at=at, match=round(score, 3), inpoint=round(inpoint, 3))
                out = os.path.join(FOOT, "clips", f"{s['id']}_ls.mp4")
                os.makedirs(os.path.dirname(out), exist_ok=True)
                sh(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{inpoint:.3f}", "-i", raw, "-t", f"{s['dur'] + HANDLE:.3f}",
                    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", out])
                print(f"    {s['id']}: line at {at:.2f}s (match {score:.2f}), in-point {inpoint:.2f}s")
            jobs.append((f"talk {s['id']}", "/v1/avatar_videos", body, done))
        run_jobs(jobs, MODELS["avatar"])
    finally:
        for aid in avatars:  # the Characters are only scaffolding for these renders
            api("DELETE", f"/v1/avatars/{aid}")


# ---------------------------------------------------------------- planning

def budget():
    shots = shots_for([], ("ai", "ai_lipsync"))
    keys = sum(N_KEYS * RATE["gen4_image_turbo"] if shot_refs(s, lambda kind, name: True) else RATE["gen4_image_720p"]
               for s in shots)
    rows = [
        ("keys", keys),
        ("video", sum(video_secs(s) * RATE["gen4_turbo"] for s in shots if needs(s, "video"))),
        ("talk", sum(avatar_cost(s) for s in shots if needs(s, "talk"))),
    ]
    for name, c in rows:
        print(f"  {name:6s} {c:5.0f} credits")
    total = sum(c for _, c in rows)
    print(f"  {'total':6s} {total:5.0f} credits  (reference sheets not included; re-rolls extra)")
    return total


def check():
    """Every prompt measured against its model's limit locally. With a zero balance the request
    bodies are also sent: Runway validates a body before it checks credits, so an accepted body
    comes back as 'not enough credits' and nothing is spent."""
    with tempfile.TemporaryDirectory() as d:
        img = os.path.join(d, "probe.png")
        Image.new("RGB", (1280, 720), (40, 60, 90)).save(img)
        pick = lambda kind, name: img  # stand-in for every reference sheet
        bodies = []
        for s in shots_for([], ("ai", "ai_lipsync")):
            bodies.append((s["id"], key_body(s, 0, pick)))
            if needs(s, "video"):
                bodies.append((s["id"], video_body(s, img, 0, MODELS["video"])))
        bad = [f"{i} {b['model']} {len(b['promptText'])}" for i, b in bodies if len(b["promptText"]) > 1000]
        print("prompt lengths:", "ok" if not bad else "too long: " + ", ".join(bad))
        if organization().get("creditBalance", 0) > 0:
            print("credits are on the account; skipping API probes (they would start real tasks)")
            return
        for path, (i, b) in [("/v1/text_to_image", bodies[0]), ("/v1/image_to_video", bodies[1])]:
            r = api("POST", path, b)
            print(f"  {i} {b['model']:18s}", "body ok" if "enough credits" in r.text else f"HTTP {r.status_code}: {r.text[:600]}")


if __name__ == "__main__":
    args = sys.argv[1:]
    opts = {}
    for flag in ("--takes", "--model"):
        if flag in args:
            i = args.index(flag); opts[flag] = args[i + 1]; del args[i:i + 2]
    stage = args[0] if args else "all"
    ids = args[1:]
    n_takes = int(opts["--takes"]) if "--takes" in opts else None
    if stage == "check":
        check()
    elif stage == "budget":
        budget()
    else:
        stages = {"refs": stage_refs, "keys": lambda: stage_keys(ids),
                  "video": lambda: stage_video(ids, n_takes, opts.get("--model")), "talk": lambda: stage_talk(ids)}
        for name in (stages if stage == "all" else [stage]):
            stages[name]()
