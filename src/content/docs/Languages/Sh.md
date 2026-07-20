---
title: Sh
description: POSIX-compliant shell scripting patterns for portable automation, redirection, parameter expansion, and process control.
icon: seti:terminal
---

## Parameter Expansion Idioms

### Guard Against Unset Variables

Halt with a custom error message when a required variable is empty or unset, without an explicit `if` statement.

```sh
echo "${user:?FATAL: user is not set}"
```

The shell prints the message and exits immediately if `user` is empty or unset.

### Provide a Default Value

Substitute a fallback when a variable is empty, leaving the variable itself unchanged.

```sh
port="${1:-8080}"
output="${2:-/dev/stdout}"
```

### Use an Alternate Value

Expand to a different string only when the variable is set, commonly used for optional flags.

```sh
verbose="${verbosely:+ -v}"
command$verbose
```

If `verbosely` is non-empty, `$verbose` expands to ` -v`; otherwise it expands to nothing.

### Strip Prefix and Suffix

Derive a filename and extension from a path without forking external utilities like `basename` or `sed`.

```sh
fullpath="/var/log/app.log"
name="${fullpath##*/}"    # app.log
dir="${fullpath%/*}"      # /var/log
ext="${name##*.}"         # log
stem="${name%.*}"         # app
```

## File Redirection with Exec

### Redirect All Script Output

Redirect everything that follows — stdout and stderr — to a log file without prefixing every command with `>>logfile 2>&1`.

```sh
exec >"$logfile" 2>&1
echo "this goes to the log"
ls /nonexistent          # stderr also goes to the log
```

Useful for cron jobs and daemon scripts where you want a single log capture point.

### Capture stderr to a Pipe Without Mixing Streams

Swap file descriptors to route stderr through a pipeline (e.g., to a log filter) while keeping stdout on the terminal.

```sh
exec 3>&1
exec 2>&1
some_command 2>&1 >&3 | tee -a error.log
exec 3>&-
```

## Portable I/O with read

### Split a Line into Fields

Read a delimited line and split it into named variables using `IFS`, which controls word splitting.

```sh
while IFS=: read -r user pass uid gid rest; do
    printf 'user %s has uid %s\n' "$user" "$uid"
done < /etc/passwd
```

Setting `IFS` before `read` applies only to that `read` call. The `-r` flag prevents backslash interpretation.

## Portable Signal Traps

### Cleanup on Any Exit

Run cleanup logic when the script exits for any reason — success, error, or signal — using `trap` with `EXIT`.

```sh
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

# temporary files in "$tmpdir" are removed automatically
```

Unlike trapping individual signals like `INT` or `TERM`, the `EXIT` pseudo-signal fires exactly once regardless of how the script terminates and does not mask the exit code.

## Positional Parameters

### Parse Arguments Safely

Rebuild the positional parameter list with `set --` to normalize argument indexes after consuming options.

```sh
while getopts "o:f" opt; do
    case "$opt" in
        o) output="$OPTARG" ;;
        f) force=1 ;;
        *) exit 1 ;;
    esac
done
shift "$((OPTIND - 1))"

# remaining positional arguments start at $1
```

### Use printf Instead of echo

Print arbitrary strings portably. The behavior of `echo` varies across shells (`-n`, `-e` interpretation), while `printf` is consistent wherever POSIX sh is found.

```sh
printf '%s\n' "$var"
printf 'error: %s (line %d)\n' "$msg" "$LINENO" >&2
```
