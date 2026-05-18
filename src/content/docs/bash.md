---
title: Bash
---

A collection of useful bash one-liners and scripts for media processing, file management, and networking. These scripts are designed to be portable across most Unix-like environments.

## Media Processing

Tools for handling images and video files directly from the command line using FFmpeg.

### Batch Image Compression

Recursively find all JPG and PNG files in the current directory and compress them using FFmpeg to save space while maintaining quality.

```bash
find . -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.png" \) -exec sh -c 'ffmpeg -i "$1" -q:v 2 "${1%.*}_compressed.${1##*.}"' _ {} \;
```

### Extract Audio from Video

Extract the audio from all MP4 files in a directory and convert them to high-quality MP3 files.

```bash
for f in *.mp4; do ffmpeg -i "$f" -vn -acodec libmp3lame -q:a 2 "${f%.mp4}.mp3"; done
```

## File Management

Efficiently manage your local filesystem with these powerful one-liners.

### Flexible Bulk Rename

Rename all files in a directory to a common base name with an incrementing numeric suffix. This is particularly useful for organizing sets of photos or downloaded assets.

```bash
# Example: Rename all .jpg files to "vacation_001.jpg", "vacation_002.jpg", etc.
count=1; for f in *.jpg; do mv "$f" "$(printf "vacation_%03d.jpg" $((count++)))"; done
```

### Bulk Case Conversion

Safely rename all files in the current directory to lowercase and replace spaces with underscores to ensure compatibility with all shells and systems.

```bash
for f in *; do mv "$f" "$(echo "$f" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')"; done
```

### Find and Sort Large Files

Find the top 10 largest files in the current directory and its subdirectories, formatted for readability using human-friendly units.

```bash
find . -type f -exec du -h {} + | sort -hr | head -n 10
```

### Delete Empty Directories

Recursively find and remove all empty directories to keep your project structure clean.

```bash
find . -type d -empty -delete
```

## Networking

Quick utilities for network diagnostics and sharing files.

### Quick Web Server

Start a Python-based web server that serves the current directory, allowing you to share files over the local network instantly.

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```
