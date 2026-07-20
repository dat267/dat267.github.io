---
title: Android
description: Media player configuration, ADB utilities, Termux setup, and system tweaks for Android devices.
icon: seti:android
---

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

## ADB Debug Bridge

### Screen Recording

Record the device screen at 2 Mbps, limiting the capture to 30 seconds, then pull the video to the host.

```bash
adb shell screenrecord /sdcard/screen.mp4 --bit-rate 2M --time-limit 30
adb pull /sdcard/screen.mp4
```

### Wireless Debugging

Connect over TCP/IP after enabling wireless debugging on the device under Developer options.

```bash
adb pair 192.168.1.100:41339
adb connect 192.168.1.100:39835
scrcpy
```

### Focused Logcat

Filter logcat output by PID and priority level to isolate a specific application's logs.

```bash
adb logcat --pid=$(adb shell pidof -s com.example.app) -v brief *:E
```

## Termux

### Basic Setup

Grant storage access and update the package repositories in a fresh Termux installation.

```bash
termux-setup-storage
pkg update && pkg upgrade
```

### OpenSSH Server

Start an SSH server on a custom port inside Termux for remote access from a desktop terminal.

```bash
pkg install openssh
sshd -p 8022
```

Verify connectivity from the host machine using `ssh user@device_ip -p 8022`.
