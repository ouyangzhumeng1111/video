#!/usr/bin/env bash
# Rebuild the film end to end (v2: CosyVoice3 narration, edit timed to the voice).
#   requirements: ffmpeg (libx264, libass), Noto Sans CJK SC, node 22, python3 with
#   numpy/scipy/soundfile/sherpa-onnx; for new narration takes also torch + the
#   CosyVoice code/model (see README: COSYVOICE_SRC, COSYVOICE_MODEL).
set -euo pipefail
cd "$(dirname "$0")"
OUT=output
mkdir -p "$OUT/chunks"

# 1) narration: generate takes only when missing, then place them and derive the edit timeline
if [ ! -f $OUT/takes/takes.json ]; then python3 audio/make_vo_cosyvoice.py; fi
python3 audio/assemble_vo.py            # -> timeline.json, vo_<voice>.wav, narration_<voice>.srt/.ass

# 2) score + sound design on the edit timeline
python3 audio/make_music.py

# 3) mixes, loudness -16 LUFS / -1.5 dBTP
master() {  # $1 premaster.wav  $2 final.wav
  local M get
  M=$(ffmpeg -hide_banner -nostats -i "$1" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
  get() { echo "$M" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
  ffmpeg -hide_banner -loglevel error -y -i "$1" \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
    -ar 48000 -c:a pcm_s24le "$2"
}
for V in male female; do
  python3 audio/mix.py vo_$V.wav mix_premaster_$V.wav
  master $OUT/mix_premaster_$V.wav $OUT/mix_final_$V.wav
done

# 4) picture on the edit timeline: two halves rendered in parallel
TOTAL=$(python3 -c "import json;print(json.load(open('$OUT/timeline.json'))['total'])")
HALF=$(python3 -c "print(round($TOTAL/2*30)/30)")
(cd render && [ -d node_modules ] || npm install)
(cd render && node render.mjs --from 0 --to $HALF --fps 30 --out ../$OUT/chunks/a.mp4) &
(cd render && node render.mjs --from $HALF --to $TOTAL --fps 30 --out ../$OUT/chunks/b.mp4) &
wait
printf "file 'a.mp4'\nfile 'b.mp4'\n" > $OUT/chunks/list.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i $OUT/chunks/list.txt -c copy $OUT/chunks/picture.mp4

# 5) masters per voice: clean + burned-in narration subtitles
ENC="-c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -r 30 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest"
for V in male female; do
  ffmpeg -hide_banner -loglevel error -y -i $OUT/chunks/picture.mp4 -i $OUT/mix_final_$V.wav $ENC $OUT/TradeMind_AI_SDR_$V.mp4
  ffmpeg -hide_banner -loglevel error -y -i $OUT/chunks/picture.mp4 -i $OUT/mix_final_$V.wav \
    -vf "ass=$OUT/narration_$V.ass" $ENC $OUT/TradeMind_AI_SDR_${V}_subtitled.mp4
done
echo done
