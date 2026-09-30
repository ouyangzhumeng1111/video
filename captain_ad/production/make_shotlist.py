"""Render production/SHOTLIST.md from shots.json (+ recorded line lengths if present)."""
import json
import os

import generate_fal as g

HERE = os.path.dirname(os.path.abspath(__file__))
lines_path = os.path.join(HERE, "..", "audio", "lines", "lines.json")
lines = json.load(open(lines_path, encoding="utf-8")) if os.path.exists(lines_path) else {}
KIND = {"ai": "AI 生成", "ai_lipsync": "AI 生成 + 对口型", "render_ui": "后期界面插入（已制作）", "endcard": "品牌落版（已制作）"}

out = ["# 《船长的底牌》分镜与生成提示词", "",
       f"约 {g.SHOTS['duration']:.0f} 秒 · {g.SHOTS['fps']} fps · 成片 {g.SHOTS['resolution'][0]}×{g.SHOTS['resolution'][1]}", "",
       "## 人物与道具设定（每个镜头都复用，保证一致）", ""]
for k, v in g.SHOTS["characters"].items():
    out.append(f"- **{k}**：{v}")
out += ["", "## 统一画风（附加在每条提示词末尾）", "", f"> {g.SHOTS['style']}", "",
        f"负面提示词：`{g.NEG}`", "", "## 分镜", ""]
for s in g.SHOTS["shots"]:
    out.append(f"### {s['id']} · {s['t']:.1f}–{s['t'] + s['dur']:.1f}s · {KIND[s['kind']]}")
    out.append("")
    out.append(s["zh"])
    if "line" in s:
        ln = s["line"]
        rec = lines.get(s["id"])
        dur = f"（配音 {rec['dur']:.1f}s）" if rec else ""
        out.append("")
        out.append(f"**台词** {ln['who']}：「{ln['text']}」 —— {ln['emo']}{dur}")
    if "image" in s:
        out += ["", f"- 关键帧提示词：{g.fmt(s['image'])}", f"- 运动提示词：{g.fmt(s['motion'])}"]
    out.append("")
open(os.path.join(HERE, "SHOTLIST.md"), "w", encoding="utf-8").write("\n".join(out))
print("wrote SHOTLIST.md")
