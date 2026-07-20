---
title: Go
description: Go build configurations, linker techniques, code generation, and concurrency patterns.
icon: seti:go
---

## Binary Optimization

### Strip Debug Symbols

Strip DWARF tables and symbol tables to reduce binary size by up to 30%, combined with `-w` (DWARF) and `-s` (symbol table).

```bash
go build -ldflags="-s -w" -o app main.go
```

### Inject Version Metadata

Dynamically inject version and build-time variables into string fields defined in the main package during build time.

```bash
go build -ldflags="-X main.Version=1.0.0 -X main.BuildTime=$(date +%Y-%m-%dT%H:%M:%S)" -o app main.go
```

## Code Generation

### Generate with go:generate

Automate boilerplate generation by embedding `go:generate` directives directly in source files. Run them all with a single `go generate ./...` invocation.

```go
//go:generate stringer -type=Status -linecomment
//go:generate mockgen -source=store.go -destination=mock_store.go -package=main

type Status int

const (
	Active Status = iota + 1
	Inactive
	Archived
)
```

The `stringer` tool auto-creates `String()` methods for enums. The `mockgen` tool from `go.uber.org/mock` generates interface mocks. Install them with `go install golang.org/x/tools/cmd/stringer@latest` and `go install go.uber.org/mock/mockgen@latest`.

### Embed Static Assets at Compile Time

Embed files or directories directly into the binary at compile time using the `embed` package, eliminating runtime file dependencies.

```go
import (
	"embed"
	"net/http"
)

//go:embed static/*
var staticFiles embed.FS

func main() {
	http.Handle("/", http.FileServer(http.FS(staticFiles)))
	http.ListenAndServe(":8080", nil)
}
```

The directive must appear as a `var` declaration immediately below the `//go:embed` comment. Patterns support single files, directories, and globs.

## Boilerplate Code

### High-Throughput I/O Concurrency: Fan-In HTTP Fetcher

In an I/O-bound scenario, the CPU spends most of its time waiting for network responses. This pattern uses a worker pool to limit concurrent connections, fetches data concurrently, and uses a multiplexed channel (Fan-In) to collect results safely.

```go
package main

import (
	"context"
	"net/http"
	"sync"
	"time"
)

type FetchResult struct {
	URL   string
	State int
	Err   error
}

func fetchURL(ctx context.Context, client *http.Client, url string) FetchResult {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return FetchResult{URL: url, Err: err}
	}

	resp, err := client.Do(req)
	if err != nil {
		return FetchResult{URL: url, Err: err}
	}
	defer resp.Body.Close()

	return FetchResult{URL: url, State: resp.StatusCode}
}

func FetchBatch(urls []string, workers int, timeout time.Duration) []FetchResult {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	client := &http.Client{Timeout: 5 * time.Second}
	urlChan := make(chan string, len(urls))
	resChan := make(chan FetchResult, len(urls))

	for _, url := range urls {
		urlChan <- url
	}
	close(urlChan)

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for url := range urlChan {
				select {
				case <-ctx.Done():
					resChan <- FetchResult{URL: url, Err: ctx.Err()}
				default:
					resChan <- fetchURL(ctx, client, url)
				}
			}
		}()
	}

	wg.Wait()
	close(resChan)

	results := make([]FetchResult, 0, len(urls))
	for res := range resChan {
		results = append(results, res)
	}
	return results
}

func main() {
	urls := []string{"https://google.com", "https://github.com", "https://go.dev"}
	_ = FetchBatch(urls, 10, 10*time.Second)
}
```
