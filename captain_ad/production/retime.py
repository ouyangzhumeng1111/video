"""Fit the edit to the recorded dialogue.

A dialogue shot grows when its line (plus lead-in and a short tail) is longer
than the designed slot; every later shot shifts. The brand card keeps its 3 s.
The designed duration is kept as dur_design so the script can be re-run.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "shots.json")
LINES = os.path.join(HERE, "..", "audio", "lines", "lines.json")
TAIL = 0.25
OFFSET = {"S27": 0.35}  # the relief line lands after the eyes close


def main():
    d = json.load(open(P, encoding="utf-8"))
    lines = json.load(open(LINES, encoding="utf-8")) if os.path.exists(LINES) else {}
    t = 0.0
    for s in d["shots"]:
        s.setdefault("dur_design", s["dur"])
        dur = s["dur_design"]
        if "line" in s:
            # prelap (<0): the line starts before its cut; spill: it may run on
            # over the following non-dialogue shot(s) — standard J/L cuts
            s["line"]["offset"] = s["line"].get("prelap", OFFSET.get(s["id"], 0.15))
            rec = lines.get(s["id"])
            if rec and not s["line"].get("offscreen"):
                need = s["line"]["offset"] + rec["dur"] + TAIL - s["line"].get("spill", 0.0)
                dur = max(dur, round(need, 2))
        s["t"], s["dur"] = round(t, 3), round(dur, 3)
        t += dur
    d["duration"] = round(t, 3)
    json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    grown = [(s["id"], s["dur_design"], s["dur"]) for s in d["shots"] if s["dur"] > s["dur_design"] + 1e-6]
    print("duration", d["duration"], "grown shots:", grown)


if __name__ == "__main__":
    main()
