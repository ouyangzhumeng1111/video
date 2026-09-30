#!/usr/bin/env bash
# Swap the soundtrack only (e.g. a new narration) without re-rendering picture.
# Uses output/vo.wav + music/sfx stems, re-mixes, loudness-normalises and muxes
# onto the existing video stream; re-burns subtitles for the subtitled version.
set -euo pipefail
cd "$(dirname "$0")"
OUT=output
python3 audio/mix.py
M=$(ffmpeg -hide_banner -nostats -i $OUT/mix_premaster.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
get() { echo "$M" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
ffmpeg -hide_banner -loglevel error -y -i $OUT/mix_premaster.wav \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -ar 48000 -c:a pcm_s24le $OUT/mix_final.wav
SRC=$OUT/TradeMind_AI_SDR_60s.mp4
ffmpeg -hide_banner -loglevel error -y -i $SRC -map 0:v -c:v copy $OUT/_picture.mp4
ffmpeg -hide_banner -loglevel error -y -i $OUT/_picture.mp4 -i $OUT/mix_final.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest $SRC
ffmpeg -hide_banner -loglevel error -y -i $OUT/_picture.mp4 -i $OUT/mix_final.wav -map 0:v -map 1:a \
  -vf "ass=$OUT/narration.ass" -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest $OUT/TradeMind_AI_SDR_60s_subtitled.mp4
rm -f $OUT/_picture.mp4
echo done
