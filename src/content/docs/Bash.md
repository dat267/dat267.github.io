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

Rename all files in a directory to a common base name with an incrementing numeric suffix. For example, renaming all `.jpg` files to `vacation_001.jpg`, `vacation_002.jpg`, etc.

```bash
count=1; for f in *.jpg; do mv "$f" "$(printf "vacation_%03d.jpg" $((count++)))"; done
```

### Bulk Case Conversion

Safely rename all files in the current directory to lowercase and replace spaces with underscores to ensure compatibility with all shells and systems.

```bash
for f in *; do new="$(echo "$f" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')"; [ "$f" != "$new" ] && mv "$f" "$new"; done
```

### Find and Sort Large Files

Find the top 10 largest files in the current directory and its sub-directories, formatted for readability using human-friendly units.

```bash
find . -type f -exec du -h {} + | sort -hr | head -n 10
```

### Delete Empty Directories

Recursively find and remove all empty directories to keep your project structure clean.

```bash
find . -type d -empty -delete
```

### Auto-Rotating Backup Creation

Compress a directory and keep only the latest 5 backups, deleting any older archives dynamically using a portable pipeline.

```bash
tar -czf "backup_$(date +%Y%m%d_%H%M%S).tar.gz" -C ./src . && ls -t backup_*.tar.gz | tail -n +6 | xargs rm -f
```

## Networking & Log Analysis

Quick utilities for network diagnostics, log parsing, and sharing files.

### Nginx Access Log Analyzer

Analyze server access logs to extract the top 10 most frequent requesting IP addresses along with their hit counts.

```bash
awk '{ip[$1]++} END {for (i in ip) print ip[i], i}' access.log | sort -rn | head -n 10
```

### Quick Web Server

Start a Python-based web server that serves the current directory, allowing you to share files over the local network instantly.

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

## Systemd User Services

Automate and manage persistent background processes on Linux without requiring root privileges.

### Persistent Node/Astro Dev Server

Create a persistent user-level systemd service to keep the local development server running continuously in the background, automatically recovering from crashes and surviving shell sessions.

To configure a service that remains compatible with dynamic Node managers like FNM (Fast Node Manager), write the following service definition to `~/.config/systemd/user/dat-kb.service`:

```ini
[Unit]
Description=Astro Starlight Local Dev Server
After=network.target
[Service]
Type=simple
WorkingDirectory=/home/dat/repos/dat267.github.io
Environment="PATH=/home/dat/.local/share/fnm/aliases/default/bin:/usr/bin:/usr/local/bin"
ExecStart=/home/dat/.local/share/fnm/aliases/default/bin/npm run dev
Restart=on-failure
RestartSec=5
[Install]
WantedBy=default.target
```

Activate, launch, and configure the background service to start automatically on user login:

```bash
systemctl --user daemon-reload
systemctl --user start dat-kb
systemctl --user enable dat-kb
```

Manage and monitor the background process status and live output streams:

```bash
systemctl --user status dat-kb
journalctl --user -u dat-kb -f
```
