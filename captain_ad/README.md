# 《船长的底牌》TradeMind SDR · 电影感反转广告（约 55 秒，4K）

加勒比海冒险风格的真人写实广告：海盗劫船，船长冒死冲回火药舱，抢出来的不是金币，而是装着 TradeMind SDR 的笔记本；海盗头目最后不开炮，只想问账号怎么开。

## 当前进度

| 部分 | 状态 |
|---|---|
| 分镜与生成提示词（35 个镜头，人物/道具设定统一） | ✅ `production/shots.json`、`production/SHOTLIST.md` |
| 角色台词配音（船长、海盗头目、大副、海盗手下，按剧本语气演绎） | ✅ `audio/lines/`（CosyVoice3，Apache-2.0） |
| 配乐与音效（紧张开场 → 抢劫快切 → 引线 → 奔跑 → 爆炸耳鸣 → 松气 → 希望主题 → 炮口 → 音乐急停 → 品牌） | ✅ `audio/sound_design.py` |
| 4K 笔记本屏幕镜头（TradeMind SDR 亮起，客户/商机/跟进都在） | ✅ `output/insert_ui_4k.mp4` |
| 4K 黑底品牌落版（TradeMind SDR · 生意的底气，带得走。+ logo） | ✅ `output/insert_end_4k.mp4` |
| 动态分镜（全部镜头卡好时间 + 完整声音，用于审节奏） | ✅ `output/captain_animatic_1080p.mp4` |
| 剪辑时间线按台词长度调整（J/L 剪辑，台词可跨到下一个反应镜头），全片约 55.6 秒 | ✅ `production/retime.py` |
| **AI 真人镜头（31 个）** | ⏳ 需要视频生成服务的 API Key |
| 4K 成片 | ⏳ 镜头到位后由 `assemble.py` 自动合成 |

## 需要您配置（一次）——用 Runway 生成真人镜头

1. 在对话里出现的插件卡片上启用 **Runway API Skills**（Runway 官方插件）。
2. 在会话标题栏的云环境菜单 → 编辑 → 环境变量，添加 **`RUNWAYML_API_SECRET`**，值为 Runway 开发者后台（dev.runwayml.com）生成的 API Key。不要把 Key 发在聊天里。
3. 网络允许域名：`runwayml.com`（含子域名，API 在 `api.dev.runwayml.com`）；生成结果的下载链接在 Runway 的 CDN 上，第一次下载如果被拦，我会告诉您要加的具体域名。
4. 新开一个会话（插件和环境变量在新会话生效），说「继续船长的底牌，用 Runway」。

用 Runway 的分工：Gen-4 Image 带人物参考图生成每个镜头的关键帧（Characters / References 保持船长、头目、大副长相服装一致）→ 图生视频 → Runway 放大到 4K。台词仍用已录好的配音；说话镜头用对口型处理，没有对口型能力时改用侧脸、背身或画外音拍法。

也可以不用 Runway，改用 fal.ai（`FAL_KEY`，允许 `fal.run`、`fal.ai`、`fal.media`），流程见下文 `generate_fal.py`。

## 生成流程（fal.ai 版本；Runway 版本会在新会话里按插件文档写成 generate_runway.py，步骤相同）

```bash
pip install fal-client
cd captain_ad/production
python3 generate_fal.py refs          # 人物定妆图，每人 2 张候选 → 挑最好的存为 footage/refs/<NAME>.png
python3 generate_fal.py keys          # 每个镜头的关键帧（带人物参考图，保证长相服装一致）
python3 generate_fal.py video         # 图生视频
python3 generate_fal.py lipsync       # 11 句台词对口型
python3 generate_fal.py upscale       # 放大到 4K
python3 assemble.py --res 2160 --out captain_4k.mp4 --subs
```

每一步都有缓存，删掉某个镜头的文件就只重做那一个。关键帧和成片我会逐个看过再往下走，重点镜头 S27（船长松气）会多生成几版挑最好的。

## 目录

```
production/  shots.json 分镜数据；SHOTLIST.md 可读分镜；generate_fal.py AI 生成流程；
             retime.py 按台词长度调整镜头时长；assemble.py 剪辑合成（动态分镜 / 4K 成片）
audio/       make_voices.py 角色音色参考；make_dialogue.py 台词演绎；sound_design.py 配乐+音效+台词摆位
render/      inserts.* 4K 屏幕镜头与品牌落版（render_inserts.mjs 渲染）
footage/     AI 生成的定妆图、关键帧、视频（不入库）
output/      动态分镜、4K 插入镜头、成片
```

## 说明

- 人物族裔与长相是我先定的（船长与大副为东亚面孔，海盗头目为魁梧的欧洲面孔），改 `shots.json` 里的 `characters` 即可，所有镜头会一起更新。
- 屏幕里的界面是示意，数据都是示例（示例客户 A 等）；有真实软件截图后可以替换 `render/inserts.js` 里的界面。
- 品牌落版要求黑底，而附件 logo 是深蓝色，直接放在黑底上看不清，所以放在一块暖白底板上，颜色未改。如果有白色反白版 logo，可以直接替换。
- 声音都是程序生成或 Apache-2.0 模型生成，没有第三方版权素材。
