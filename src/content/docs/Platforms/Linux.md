---
title: Linux
description: systemd unit templates, journalctl filtering, strace, lsof, and /proc tricks for system debugging.
icon: seti:linux
---

## systemd

### Journalctl Targeted Filtering

Combine service name with a specific PID or priority to narrow log noise without grep.

```sh
journalctl -u nginx.service _PID=1234 -p err --since "1 hour ago"
```

The `_PID` match uses the trusted field index, not a full-text search. Add `-o json-pretty` to inspect all available fields for further filtering.

### Template Unit Files

Define a parameterized service that can instantiate multiple instances by replacing `%i` at runtime.

```ini
# /etc/systemd/system/myapp@.service
[Unit]
Description=MyApp instance %i

[Service]
ExecStart=/usr/bin/myapp --config /etc/myapp/%i.conf
Restart=on-failure
```

Enable and start per instance: `systemctl enable myapp@us-east --now`.

## Process Tracing

### Filter Syscalls by Category

Trace only network-related syscalls of a running process, annotated with per-syscall timestamps.

```sh
strace -p 1234 -e trace=network -T -f
```

Useful trace groups: `network`, `process`, `file`, `desc` (file descriptors), `signal`, `ipc`.

## Disk Usage

### Find the Largest Directories

Scan only one level deep and sort by size to quickly locate space hogs.

```sh
du -sh ./*/ | sort -h
```

Exclude bind mounts or fuse filesystems with `--exclude-type=fuse` or `-x` (stay within one filesystem).

## Open Files

### List Processes by Network Port

Find which process is listening on a given port without matching on process name.

```sh
lsof -i :8080 -sTCP:LISTEN
```

Combine with `-P -n` to disable port and hostname resolution for faster results. Use `+FD` to filter by file descriptor type.

## Runtime Kernel Tuning

### Change sysctl Without Rebooting

Apply kernel parameter changes at runtime and persist them by writing to `/etc/sysctl.d/`.

```sh
sysctl -w net.core.somaxconn=65535
echo "net.core.somaxconn = 65535" > /etc/sysctl.d/99-network.conf
```

Use `sysctl -a` to discover available knobs.

## /proc Filesystem

### Read Process State Directly

Extract process metadata without spawning tools like `ps`.

```sh
cat /proc/1234/cmdline | tr '\0' ' '
cat /proc/1234/status    # state, ppid, uid, vm
cat /proc/1234/fd/3      # read what FD 3 points to
ls -l /proc/1234/fd/     # symlinks show file paths
```
