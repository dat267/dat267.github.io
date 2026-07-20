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

## Error Handling

### Cleanup on Exit

Run cleanup logic regardless of how the script terminates (success, error, or interrupt). This pattern using `trap` with `EXIT` ensures temporary files are always removed.

```sh
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

# script body operating on "$tmpdir" ...
```

### Strict Mode

Enable strict error handling at the top of a script to fail fast on undefined variables, pipeline failures, and non-zero exit codes.

```sh
set -euo pipefail
```

## JSON Processing

### Filter and Transform with jq

Extract specific fields from a JSON array and reformat them into a new structure, such as building a key-value mapping.

```sh
curl -s https://api.example.com/users | jq -r '.[] | {name: .name, email: .email} | "\(.name): \(.email)"'
```

## Parallel Execution

### Batch Jobs with xargs

Process a list of URLs or files in parallel, limiting concurrency to 4 workers. Each line of input is passed as an argument to the command.

```sh
< urls.txt xargs -P 4 -I {} curl -s -o /dev/null -w "%{http_code} {}\n" {}
```

## Argument Parsing

### POSIX getopts

Parse short flags and options in a portable way using `getopts`. This pattern supports flags with and without arguments, and provides automatic error messages for invalid flags.

```sh
while getopts "o:f" opt; do
  case "$opt" in
    o) output="$OPTARG" ;;
    f) force=1 ;;
    *) exit 1 ;;
  esac
done
shift $((OPTIND - 1))
```
