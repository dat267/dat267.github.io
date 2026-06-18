---
title: Go
---

Advanced Go build configurations, compilation optimization flags, and workspace performance tuning commands.

## Binary Optimization

Strip debugging symbols and build-time information to produce the smallest possible statically linked binaries.

### Strip Symbols with Ldflags

Compile the package using linker options to strip DWARF tables and symbol tables, reducing binary size by up to 30%.

```bash
go build -ldflags="-s -w" -o app main.go
```

### Inject Version Metadata

Dynamically inject version and build-time variables into string fields defined in the main package during build time.

```bash
go build -ldflags="-X main.Version=1.0.0 -X main.BuildTime=$(date +%Y-%m-%dT%H:%M:%S)" -o app main.go
```

## Compilation and Workspace Maintenance

Manage build cache size and resolve dependency path conflicts.

### Prune Cache

Clean out all cached build artifacts, cached dependencies, and test results to free up disk space.

```bash
go clean -cache -testcache -modcache
```
