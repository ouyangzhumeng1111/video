#!/usr/bin/env bash
# Rebuild the 60 s film end to end.
#   requirements: ffmpeg (libx264, libass), Noto Sans CJK SC, node 22, python3 with
#   numpy/scipy/sherpa-onnx, TTS/ASR models (see README), Chromium at $CHROMIUM
#   or /opt/pw-browsers/chromium.
set -euo pipefail
cd "$(dirname "$0")"
OUT=output
mkdir -p "$OUT/chunks"

# 1) audio: narration (TTS + ASR check), score, mix, loudness -16 LUFS / -1.5 dBTP
python3 audio/make_vo.py
python3 audio/make_music.py
python3 audio/mix.py
M=$(ffmpeg -hide_banner -nostats -i $OUT/mix_premaster.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
get() { echo "$M" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
ffmpeg -hide_banner -loglevel error -y -i $OUT/mix_premaster.wav \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -ar 48000 -c:a pcm_s24le $OUT/mix_final.wav

# 2) picture: two chunks rendered in parallel (headless Chromium, SwiftShader)
(cd render && [ -d node_modules ] || npm install)
(cd render && node render.mjs --from 0 --to 30 --fps 30 --out ../$OUT/chunks/a.mp4) &
(cd render && node render.mjs --from 30 --to 60 --fps 30 --out ../$OUT/chunks/b.mp4) &
wait
printf "file 'a.mp4'\nfile 'b.mp4'\n" > $OUT/chunks/list.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $OUT/chunks/list.txt -c copy $OUT/chunks/picture.mp4

# 3) master: H.264 High 1080p30 + AAC 48 kHz (renderer already dithers, no extra grain)
ENC="-c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -r 30 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest"
ffmpeg -hide_banner -loglevel error -y -i $OUT/chunks/picture.mp4 -i $OUT/mix_final.wav \
  $ENC $OUT/TradeMind_AI_SDR_60s.mp4
# 4) version with burned-in narration subtitles
ffmpeg -hide_banner -loglevel error -y -i $OUT/chunks/picture.mp4 -i $OUT/mix_final.wav \
  -vf "ass=$OUT/narration.ass" $ENC $OUT/TradeMind_AI_SDR_60s_subtitled.mp4
echo done
