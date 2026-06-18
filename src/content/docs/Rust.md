---
title: Rust
---

Advanced Rust and Cargo configuration patterns, optimization profiles, and compiler options for production-ready binaries.

## Cargo Configuration

Customize compiler and linker options to optimize binary size, execution speed, and dependency builds.

### Optimization Profile

Optimize production binaries for minimum size and maximum speed by adding this profile to the `Cargo.toml` file.

```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

### Build Caching

Configure Cargo to cache dependencies across builds in a custom directory to speed up compilation in containerized CI environments.

```toml
[build]
target-dir = "/tmp/cargo-target"
```

## Cross Compilation

Compile Rust projects for target platforms without installing toolchains locally.

### Cross Compiler Container

Compile to a Musl-based target utilizing the `cross` tool to generate statically linked binaries.

```bash
cross build --target x86_64-unknown-linux-musl --release
```
