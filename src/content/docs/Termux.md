---
title: Termux
---

Advanced automation and system integration scripts specifically for Termux on Android. These scripts leverage the Termux:API to interact with hardware, system settings, and device telemetry.

# Visuals & Customization

Enhance your Android experience with automated visual tweaks.

## Unsplash Daily Wallpaper

Fetch a high-resolution random image from Unsplash and immediately set it as your device's home screen wallpaper.

```sh
curl -L "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=80" -o wallpaper.jpg && termux-wallpaper -f wallpaper.jpg
```

# Media, Audio & Telemetry

Handle recording, playback, and sensors with these automated scripts. These tools allow you to interact with your device's hardware, notification center, and text-to-speech engine.

## Read Latest Notification Aloud

Parse the most recent non-ongoing notification and read it aloud using the system's voice. This is useful when you are busy and cannot look at your phone.

```sh
termux-notification-list | jq -r '[.[] | select(.isOngoing == false)] | first | "New notification from \(.packageName | split(".") | last): \(.title). \(.content)"' | termux-tts-speak
```

## Read Clipboard Content

Instantly convert the current text in your Android clipboard into speech. This is a quick way to listen to an article or long text you have copied.

```sh
termux-clipboard-get | termux-tts-speak
```

## Quick Voice Memo

Record a 30-second audio clip from the microphone and save it to your downloads folder with a precise timestamp.

```sh
termux-microphone-record -l 30 ~/storage/downloads/memo_$(date +%Y%m%d_%H%M%S).m4a
```

## Text-to-Speech Status

Announce the completion of a long-running task using the Android system's text-to-speech engine.

```sh
sleep 3 && termux-tts-speak "The operation has finished successfully."
```

## Battery Status Monitor & Speech Alert

Query battery metrics and trigger an immediate voice warning if the device is discharging and drops below 15%. This script is ideal to run as an automated cron job.

```sh
termux-battery-status | jq -e '.percentage < 15 and (.status | contains("Discharging"))' && termux-tts-speak "Battery critical: $(termux-battery-status | jq .percentage) percent. Connect charger."
```

## Silent Security Photo Capture

Trigger the rear-facing device camera to capture a silent photo without displaying a viewport, saving it to DCIM with a timestamp.

```sh
termux-camera-photo -c 0 ~/storage/dcim/security_$(date +%Y%m%d_%H%M%S).jpg
```
