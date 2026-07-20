---
title: Docker
description: Multi-stage builds, layer caching optimization, compose health checks, BuildKit cache mounts, and rootless setup.
icon: seti:docker
---

## Multi-Stage Builds

### Compile in One Stage, Copy to Runtime

Build a Go binary in a full compiler image, then copy only the binary into a scratch or distroless image for minimal attack surface.

```dockerfile
FROM golang:1.24 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o app .

FROM alpine:3.21
COPY --from=builder /src/app /app
EXPOSE 8080
CMD ["/app"]
```

## Layer Caching

### Order Commands by Volatility

Place slow-changing instructions before fast-changing ones so Docker reuses cached layers. Dependency downloads change less often than application source.

```dockerfile
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                       # cached unless deps change
COPY src/ ./src/                 # invalidated on every edit
RUN npm run build
```

Apply the same principle to `apt-get install` — install packages before copying code so the package layer is cached across rebuilds.

## Compose Health Checks

### Auto-Restart Unhealthy Containers

Define a health check that probes the application periodically. Docker will restart the container when the check fails consecutively.

```yaml
services:
  app:
    image: myapp
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    restart: unless-stopped
```

## BuildKit Cache Mounts

### Persist Package Downloads Across Builds

Mount a cache directory for package managers so downloads survive `docker build` cache invalidation, dramatically speeding up rebuilds.

```dockerfile
FROM python:3.12
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
```

The same pattern works for apt (`/var/cache/apt`), npm (`/root/.npm`), and Go (`/root/.cache/go-build`). Requires `DOCKER_BUILDKIT=1` or BuildKit as the default builder.

## Rootless Docker

### Run Daemon Without Root

Start the Docker daemon under an unprivileged user using the rootless mode installer, mitigating container escape vulnerabilities.

```sh
dockerd-rootless-setuptool.sh install
systemctl --user start docker
export DOCKER_HOST=unix:///run/user/$UID/docker.sock
```

Prerequisites: `newuidmap`, `newgidmap`, and `/etc/subuid`/`/etc/subgid` configured with at least 65536 subordinate IDs for the user.
