---
title: Android
---

A collection of system tweaks, media player configurations, and optimization guides for Android devices.

## MPV Media Player

Optimize the performance and gesture controls of the mpv-android media player using custom configuration files.

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
