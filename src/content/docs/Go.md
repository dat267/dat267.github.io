---
title: Go
description: Go build configurations, compilation optimization flags, linker techniques, and concurrency patterns.
icon: seti:go
---

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
