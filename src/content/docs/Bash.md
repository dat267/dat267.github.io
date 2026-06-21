---
title: Bash
---

POSIX-compliant shell scripts and one-liners for system automation, file processing, and media management. All scripts are compatible with `sh`, `bash`, and `zsh`.

## Audio Conversion

Tools and scripts for batch-processing audio files with FFmpeg.

### Convert WAV to FLAC

Recursively finds every `.wav` file under the current directory and all subdirectories, converts each one to lossless FLAC using FFmpeg, and removes the original only when the conversion exits successfully.

Uses `find -exec sh -c` instead of a pipe-to-`while` loop for full POSIX portability. This avoids subshell pipeline differences across `sh`, `bash`, and `zsh`, and correctly handles file paths containing spaces or special characters.

```sh
find . -type f -name "*.wav" -exec sh -c '
  ffmpeg -i "$1" -c:a flac "${1%.wav}.flac" && rm "$1"
' _ {} \;
```
