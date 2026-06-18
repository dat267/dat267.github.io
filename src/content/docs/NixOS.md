---
title: NixOS
---

Declarative configurations, flake management, and system maintenance utilities for NixOS deployments.

## Flake Operations

Initialize, update, and deploy declarative system environments with Flakes.

### Lockfile Update

Update specific inputs within the flake lockfile without rebuilding or fetching dependencies for the entire system configuration.

```bash
nix flake lock --update-input nixpkgs
```

### System Rebuild

Rebuild the system configuration in place and activate it immediately.

```bash
nixos-rebuild switch --flake .#default
```

## System Garbage Collection

Free disk space by removing unused, orphaned generations, and unreferenced packages from the Nix store.

### Purge Store and Old Generations

Collect garbage from the Nix store and permanently delete all system generations older than 14 days.

```bash
nix-env --delete-generations +14d && nix-store --gc
```
