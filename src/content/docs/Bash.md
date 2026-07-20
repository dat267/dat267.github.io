---
title: Bash
description: POSIX-compliant shell scripts and one-liners for system automation, file processing, and media management.
icon: seti:terminal
---

All scripts are compatible with `sh`, `bash`, and `zsh` unless otherwise noted.

## Audio Conversion

### Convert WAV to FLAC

Recursively finds every `.wav` file under the current directory and all subdirectories, converts each one to lossless FLAC using FFmpeg, and removes the original only when the conversion exits successfully.

Uses `find -exec sh -c` instead of a pipe-to-`while` loop for full POSIX portability. This avoids subshell pipeline differences across shells and correctly handles file paths containing spaces or special characters.

```sh
find . -type f -name "*.wav" -exec sh -c '
  ffmpeg -i "$1" -c:a flac "${1%.wav}.flac" && rm "$1"
' _ {} \;
```

## Process Locking

### File Descriptor-Based Lock

Acquire an exclusive lock using a file descriptor so the lock is automatically released when the script exits or the FD is closed, even without a separate cleanup step.

```sh
exec 3>/var/lock/myapp.lock
flock -n 3 || { echo "already running" >&2; exit 1; }
```

The lock file persists on disk but the kernel releases the lock when the process holding FD 3 terminates.

## Indirect Variable Expansion

### Dynamic Variable Names

Read a variable whose name is stored in another variable, such as iterating over a list of configuration keys where each key names a variable.

```sh
key=user_1
ref="user_1"
echo "${!ref}"
```

Pairs naturally with `for key in list; do val="${!key}"; ...` to avoid eval.

## Simultaneous Processing

### Tee Process Substitution

Send a pipeline's output to both a file and a downstream command at the same time, useful for compressing a stream while also computing a checksum.

```sh
some_large_command | tee >(sha256sum > checksum.txt) | gzip > output.gz
```

The `>(...)` process substitution runs in the background while `tee` feeds both targets concurrently.
