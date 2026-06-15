---
title: Bash
---

Advanced Bash scripts and one-liners for system automation, file processing, and media management.

## Audio Conversion

Tools and scripts for batch-processing audio files with FFmpeg.

### Convert WAV to FLAC

Iterates over every `.wav` file in the current directory, converts each one to lossless FLAC using FFmpeg, and removes the original only when the conversion exits successfully.

```bash
for f in *.wav; do
    ffmpeg -i "$f" -c:a flac "${f%.wav}.flac" && rm "$f"
done
```
