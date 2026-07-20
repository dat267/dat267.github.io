---
title: Bash
description: POSIX-compliant shell scripts and bash-specific tricks for automation, file processing, concurrency, and data extraction.
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

## Nameref Variables

### Pass-by-Reference in Functions

Simulate pass-by-reference using `local -n` (bash 4.3+). The nameref aliases a local variable to the caller's variable, so assignments inside the function modify the caller's scope directly — no `eval` or global scope needed.

```bash
die() {
  local -n _ref="$1"
  _ref="COMPILED"
}

status=""
die status
echo "$status"
```

The `-n` flag declares `_ref` as a name reference to the variable whose name is stored in `$1`. Any read or write to `_ref` operates on `status` in the caller. Use an underscore prefix to avoid collisions with the caller's variable names.

## Bash Regex Capture

### Extract Groups with BASH_REMATCH

Use the `=~` operator inside `[[ ]]` to match a pattern and capture groups into the `BASH_REMATCH` array. Index 0 is the full match; indexes 1+ are parenthesized groups.

```bash
[[ "$1" =~ ^([a-z]+)-([0-9]+)\.log$ ]] || usage
name="${BASH_REMATCH[1]}"
version="${BASH_REMATCH[2]}"
```

The regex uses ERE syntax — no escaping of `+`, `?`, `|`, or parentheses is needed. Store the pattern in a variable (unquoted in `=~`) to avoid escaping issues with special characters.

## Parallel Job Pool

### Bounded Concurrency with Background Jobs

Run up to `$max` jobs in parallel. Each time a job finishes, the next one starts — keeping resource usage predictable without external tools like `xargs` or `parallel`.

```bash
max=4
count=0
for url in "${urls[@]}"; do
    (curl -sS "$url" > "out_$(basename "$url")") &
    ((++count % max == 0)) && wait -n
done
wait
```

Uses `wait -n` (bash 5.1+) to block until any one background job exits, rather than waiting for all. The modulo check triggers `wait -n` every `$max` launches, enforcing the concurrency limit. The final `wait` ensures any remaining jobs finish before the script exits.
