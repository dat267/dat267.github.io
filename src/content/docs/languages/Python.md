---
title: Python
description: pyproject.toml structure, fast dependency management with uv, pdb debugging, and profiling patterns.
icon: seti:python
---

## pyproject.toml

### Modern Project Metadata

Replace `setup.py` and `setup.cfg` with a single declarative `pyproject.toml` that defines metadata, dependencies, and build system in one file.

```toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["fastapi>=0.115", "httpx"]

[dependency-groups]
dev = ["pytest>=8", "ruff"]

[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.backends._legacy:_Backend"
```

Run `pip install -e .` or `uv sync` to install the project and its dev dependencies.

## Fast Package Management

### uv as a pip Replacement

Use `uv` for dependency installation and virtual environment management — it is 10-100x faster than `pip` by using a Rust-based resolver and global cache.

```sh
uv venv --python 3.12
uv pip install -r requirements.txt
uv pip install 'fastapi>=0.115'
uv tool run ruff check .
```

`uv tool run` downloads and runs a package without installing it permanently, similar to `npx`.

## Debugging

### Flexible Breakpoints

Drop `breakpoint()` anywhere in your code to enter the debugger. By default it invokes `pdb.set_trace()`, but you can swap the implementation without touching source by setting `PYTHONBREAKPOINT`.

```python
def process(data):
    result = transform(data)
    breakpoint()           # enters pdb
    return finalize(result)
```

Use `PYTHONBREAKPOINT=ipdb.set_trace` to use IPython's debugger instead, or `PYTHONBREAKPOINT=0` to disable all breakpoints globally.

### Post-Mortem Debugging

Enter the debugger at the point of an unhandled exception to inspect the call stack and local variables after a crash.

```sh
python -m pdb script.py
```

At the `(Pdb)` prompt, type `continue` to run normally — if an exception occurs, the debugger stops at the crash site.

## Profiling

### Statistical Profiling with py-spy

Sample a running Python process without modifying code or restarting it. Works in production where you cannot add instrumentation.

```sh
py-spy record -o profile.svg --pid 1234
py-spy top --pid 1234
```

Install with `pip install py-spy` or `uv tool install py-spy`. The SVG flame graph shows time spent per function, including native extensions.
