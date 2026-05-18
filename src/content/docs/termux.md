---
title: Termux
---

Advanced automation and system integration scripts specifically for Termux on Android. These scripts leverage the Termux:API to interact with hardware and system data.

## Visuals & Customization

Enhance your Android experience with automated visual tweaks.

### Unsplash Daily Wallpaper

Fetch a high-resolution random image from Unsplash and immediately set it as your device's home screen wallpaper.

```sh
curl -L "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80" -o wallpaper.jpg && termux-wallpaper -f wallpaper.jpg
```

## Media & Audio

Handle recording and playback with these automated scripts. These tools allow you to interact with your device's audio hardware and text-to-speech engine.

### Read Latest Notification Aloud

Parse the most recent non-ongoing notification (like a message or alert) and read it aloud using the system's voice. This is useful when you're busy and can't look at your phone.

```sh
termux-notification-list | jq -r '[.[] | select(.isOngoing == false)] | first | "New notification from \(.packageName | split(".") | last): \(.title). \(.content)"' | termux-tts-speak
```

### Read Clipboard Content

Instantly convert the current text in your Android clipboard into speech. This is a quick way to "listen" to an article or long text you've just copied.

```sh
termux-clipboard-get | termux-tts-speak
```

### Quick Voice Memo

Record a 30-second audio clip from the microphone and save it to your downloads folder with a precise timestamp.

```sh
termux-microphone-record -l 30 ~/storage/downloads/memo_$(date +%Y%m%d_%H%M%S).m4a
```

### Text-to-Speech Status

Announce the completion of a long-running task using the Android system's text-to-speech engine.

```sh
your_command_here && termux-tts-speak "The operation has finished successfully."
```
