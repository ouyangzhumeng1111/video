# 《船长的底牌》TradeMind SDR · 电影感反转广告（约 55 秒，4K）

加勒比海冒险风格的真人写实广告：海盗劫船，中国船长冒死冲回火药舱，抢出来的不是金币，而是装着 TradeMind SDR 的笔记本；海盗头目最后不开炮，只想问账号怎么开。

## 成片

| 文件 | 说明 |
|---|---|
| `output/captain_4k.mp4` | **4K 成片**（3840×2160，24 fps，HEVC/H.265 约 13 Mbps，烧录中文字幕，-16 LUFS）|
| `output/captain_4k_master.mp4` | 4K 母版（H.264 约 75 Mbps、520 MB，超过 GitHub 单文件 100 MB 上限，不入库；`assemble.py --res 2160 --subs --out captain_4k_master.mp4` 可重新生成）|
| `output/captain_preview_720p.mp4` | 720p 预览，方便手机上看 |
| `output/captain_animatic_1080p.mp4` | 早期动态分镜（文字板 + 完整声音），保留作对照 |

## 分工：Runway 做画面，其余本地完成

| 部分 | 怎么做的 |
|---|---|
| 人物定妆（船长、头目、大副、海盗手下、防水包+笔记本） | Runway Gen-4 Image；船长丢帽后的造型用 Gen-4 Image Turbo 以原定妆图为参考生成，保证同一张脸 |
| 33 个镜头的关键帧 | Runway Gen-4 Image Turbo，带 `@Captain / @Boss / @Mate / @Gunner / @Props` 参考图保持长相服装一致；无人物的空镜用 Gen-4 Image |
| 27 个动作镜头 | Runway Gen-4 Turbo 图生视频；S10、S24 首版有穿帮（多出一个人、笔记本裂开），改用 Gen-4.5 重做 |
| 6 个对口型台词镜头（S07、S15、S23、S27、S29、S33） | Runway Characters：关键帧建成角色，用已录好的台词音频驱动口型，再按剪辑时间线裁切 |
| 其余台词镜头 | 改成不露嘴型的拍法：S02 过肩从头目背后拍、S28 大副背身、S31 手下侧脸半掩在炮身后、S09 远景 |
| 台词配音、配乐音效、屏幕界面与品牌落版、剪辑合成 | 本地（CosyVoice3、程序化声音、HTML 渲染、ffmpeg） |
| 放大到 4K | 本地 Real-ESRGAN（general-x4v3，BSD-3）在 CPU 上逐帧放大，混入 35% 普通插值避免皮肤发蜡 |

## Runway 积分（预算 1000）

| 步骤 | 积分 |
|---|---|
| 定妆图（含船长重做、无帽版） | 100 |
| 关键帧（每镜 2 张候选；丢帽后的 14 个镜头重做） | 190 |
| 动作镜头（Gen-4 Turbo 27 个 + Gen-4.5 重做 2 个） | 348 |
| 对口型（Characters，每镜 2 积分） | 14 |
| 两次生成失败（Runway 内部错误）| 2 |
| **合计** | **654，余 346** |

原方案（Gen-4.5 全部动作 + Seedance 对口型 + Magnific 4K）估算约 5150 积分，超出预算，所以改为上面的组合。余下的积分可以用来重做不满意的镜头（Gen-4 Turbo 每秒 5 积分，Gen-4.5 每秒 12 积分）。

## 剧情与人物

- 船长、大副（船员）都是中国人；海盗头目为魁梧的欧洲面孔，海盗手下戴红头巾。人物设定在 `production/shots.json` 的 `characters`。
- 帽子是伏笔：S07 头目摘走船长的帽子戴上，此后船长一直不戴帽子，结尾头目喊“帽子还你！聊聊！”。
- 笔记本在 S24 之前一直装在防水包里；笔记本外壳没有任何品牌标志（定妆图上的苹果标志已手工去掉）。

## 重新生成 / 修改某个镜头

```bash
pip install numpy soundfile pillow requests scipy
pip install torch --index-url https://download.pytorch.org/whl/cpu      # 4K 放大用
cd captain_ad/production
python3 generate_runway.py budget                  # 估算积分
python3 generate_runway.py keys S12                # 关键帧（已选定的 footage/keys/S12.png 存在时跳过，删掉即重做）
python3 generate_runway.py video S12               # Gen-4 Turbo；加 --model gen4.5 用更好的模型
python3 generate_runway.py talk S27                # 对口型镜头
python3 ../audio/sound_design.py                   # 配乐、音效、台词摆位（output/*.wav）
python3 assemble.py --res 1080 --proxy --subs --out captain_review_1080p.mp4   # 快速审片
python3 ../render/upscale.py S12                   # 本地放大到 4K（约 3 秒一帧）
python3 assemble.py --res 2160 --subs --out captain_4k_master.mp4             # 4K 母版
# 入库用的 4K：HEVC 两遍编码到 ~92 MB（ffmpeg -c:v libx265 -b:v 12800k -tag:v hvc1，pass=1 / pass=2）
```

需要环境变量 `RUNWAYML_API_SECRET`（在云环境设置里加，不要发在聊天里）。每一步都有缓存：删掉某个镜头的文件就只重做那一个。每次生成的任务号、模型、种子、提示词记在 `footage/raw/*.json` 和 `footage/keys/*.json`，运行日志在 `output/runway_log.txt`。

## 目录

```
production/  shots.json 分镜数据（含每个台词镜头的拍法 sync）；SHOTLIST.md 可读分镜；
             generate_runway.py Runway 生成流程；generate_fal.py fal.ai 备选流程；
             retime.py 按台词长度调整镜头时长；assemble.py 剪辑合成
audio/       make_voices.py 角色音色参考；make_dialogue.py 台词演绎；sound_design.py 配乐+音效+台词摆位
render/      inserts.* 4K 屏幕镜头与品牌落版；upscale.py 本地 4K 放大
footage/     refs/ 选定的定妆图；keys/ 选定的关键帧；clips/ Runway 镜头（入库，重做要花积分）；
             4k/、raw/、models/ 为可重新生成的中间文件（不入库）
output/      成片、审片版、插入镜头
```

## 说明

- 屏幕里的界面是示意，数据都是示例（示例客户 A 等）；有真实软件截图后可以替换 `render/inserts.js` 里的界面。
- 品牌落版要求黑底，而附件 logo 是深蓝色，直接放在黑底上看不清，所以放在一块暖白底板上，颜色未改。如果有白色反白版 logo，可以直接替换。
- 声音都是程序生成或 Apache-2.0 模型生成，没有第三方版权素材；画面为 Runway 生成。
- 也可以不用 Runway，改用 fal.ai（`FAL_KEY`），流程见 `production/generate_fal.py`。
