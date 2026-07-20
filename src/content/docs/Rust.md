---
title: Rust
description: Cargo configuration, optimization profiles, cross-compilation, Clippy linting, and workspace management for Rust projects.
icon: seti:rust
---

## Cargo Configuration

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

### Cross Compiler Container

Compile to a Musl-based target utilizing the `cross` tool to generate statically linked binaries.

```bash
cross build --target x86_64-unknown-linux-musl --release
```

## Linting with Clippy

### CI-Ready Clippy Configuration

Configure Clippy to deny all warnings and specific lint groups in CI, ensuring no new warnings are introduced.

```toml
# .clippy.toml or in Cargo.toml under [lints.clippy]
pedantic = "deny"
nursery = "deny"
cargo = "deny"
```

Run Clippy explicitly:

```bash
cargo clippy -- -D warnings
```

## Workspace Management

### Multi-Crate Workspace

Organize a project with multiple interdependent crates in a single workspace, sharing a single `Cargo.lock` and `target/` directory.

```toml
# Cargo.toml (workspace root)
[workspace]
members = ["crates/*"]
resolver = "2"
```

Each crate lives under `crates/crate-a`, `crates/crate-b`, etc.

## Conditional Compilation

### Feature-Gated Code

Conditionally compile code based on enabled Cargo features, useful for optional dependencies or platform-specific behavior.

```rust
#[cfg(feature = "metrics")]
fn emit_metric(name: &str) {
    // instrumentation code
}
```

Define the feature in `Cargo.toml`:

```toml
[features]
metrics = []
```
