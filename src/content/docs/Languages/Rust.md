---
title: Rust
description: Cargo configuration, optimization profiles, build scripts, and custom allocators for Rust projects.
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

## Build Scripts

### Code Generation at Compile Time

Use a `build.rs` file to generate Rust source or inspect the build environment before the main crate compiles. This is commonly used for FFI bindings, embedding version info, or generating lookup tables.

```rust
// build.rs
use std::{env, fs, path::Path};

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("generated.rs");

    let content = format!(
        "pub const BUILD_TIME: &str = \"{}\";\npub const GIT_HASH: &str = \"{}\";",
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
        std::process::Command::new("git")
            .args(["rev-parse", "--short", "HEAD"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default()
            .trim(),
    );
    fs::write(dest, content).unwrap();
    println!("cargo::rerun-if-changed=build.rs");
}
```

Include the generated file in your crate:

```rust
include!(concat!(env!("OUT_DIR"), "/generated.rs"));
```

## Custom Global Allocator

### Swap the Memory Allocator

Replace the default system allocator with a different backend (e.g., `jemalloc` or `mimalloc`) at link time to improve performance or reduce fragmentation.

```rust
use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;
```

Add the allocator crate to `Cargo.toml`:

```toml
[dependencies]
mimalloc = { version = "0.1", default-features = false }
```

The `#[global_allocator]` attribute must be placed exactly once in the crate graph.

## Cross Compilation

### Static Binary with Musl

Compile to a fully static binary using the MUSL target to produce a portable executable with no runtime library dependencies.

```bash
cross build --target x86_64-unknown-linux-musl --release
```
