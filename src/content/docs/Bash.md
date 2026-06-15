---
title: Bash
---

Advanced Bash scripts and one-liners for system automation, file processing, and media management.

## Audio Conversion

Tools and scripts for batch-processing audio files with FFmpeg.

### Convert WAV to FLAC

Recursively finds every `.wav` file under the current directory and all subdirectories, converts each one to lossless FLAC using FFmpeg, and removes the original only when the conversion exits successfully. File paths with spaces are handled safely via `IFS= read -r`.

```bash
find . -type f -name "*.wav" | while IFS= read -r f; do
    ffmpeg -i "$f" -c:a flac "${f%.wav}.flac" && rm "$f"
done
```
