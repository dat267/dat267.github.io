---
title: Android
description: Media player configuration, ADB utilities, and system debugging for Android devices.
icon: seti:android
---

## MPV Media Player

### mpv.conf

Enable hardware-accelerated video decoding, configure high-performance caching for network streams, and optimize subtitle readability on mobile displays.

```ini
hwdec=auto
vo=gpu
cache=yes
demuxer-max-bytes=150MiB
demuxer-max-back-bytes=50MiB
sub-auto=fuzzy
sub-font="sans-serif"
sub-font-size=36
sub-border-size=2
sub-shadow-offset=1
sub-shadow-color="#33000000"
save-position-on-quit=yes
keep-open=yes
```

### input.conf

Define touch gestures for double-tapping the left, center, and right areas of the screen, along with keyboard controls for external inputs or Android TV remotes.

Ensure that the double-tap settings under **Settings > Gestures** are set to **Custom** within the app interface.

```ini
0x10001 no-osd seek -10
0x10002 cycle pause
0x10003 no-osd seek 10
RIGHT seek 5
LEFT seek -5
UP add volume 2
DOWN add volume -2
a cycle audio
s cycle sub
```

## ADB Debug Bridge

### Extract and Decompile an Installed APK

Pull an APK from a running device and decompile it to Java/smali source, useful for inspecting third-party resource layouts or understanding how an app implements a specific feature.

```bash
adb shell pm path com.example.app | cut -d: -f2 | xargs -I {} adb pull {} ./app.apk
apktool d app.apk -o app-source
```

### Frame Timing Report

Generate a detailed frame-timing histogram for a specific activity to identify jank in UI rendering.

```bash
adb shell dumpsys gfxinfo com.example.app framestats | grep "PROFILE_DATA" | \
  awk 'NR>1{for(i=13;i<=16;i++)$i="";print}' > frametimes.csv
```

The output CSV contains per-frame draw, prepare, and process durations in nanoseconds.

### Focused Logcat

Filter logcat output by PID and priority level to isolate a specific application's logs without noise from other processes.

```bash
adb logcat --pid=$(adb shell pidof -s com.example.app) -v brief *:E
```

## Debugging

### Capture a Bugreport

Dump a comprehensive device state snapshot including logs, stack traces, kernel messages, and network info into a single ZIP for offline analysis.

```bash
adb bugreport ./bugreport.zip
```

This captures the output of hundreds of `dumpsys` services at once, useful for diagnosing battery drain, ANRs, and system-level crashes.
