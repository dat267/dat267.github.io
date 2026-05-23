---
title: Go
---

Building robust, high-performance command-line interfaces (CLIs) in Go does not require heavy external frameworks. By adopting an organized, modular layout utilizing 1-2 levels of nested directories, you can keep your routing logic, subcommand handlers, persistence systems, and API clients separated and highly maintainable. This guide documents how to lay out standard Go projects, parse arguments using the built-in `flag` package, store configurations in INI format, execute concurrent tasks, and design resilient HTTP clients.

## Modular CLI Architecture

A robust standard CLI splits command-line routing from command execution. This guarantees that your business logic remains testable, decoupled, and reusable across multiple parts of your application.

### Project Layout

An organized project structure partitions code into logical components, using clean 1-2 level nested directories:

```text
├── cmd/
│   └── cmd.go
├── pkg/
│   ├── config/
│   │   └── store.go
│   └── api/
│       └── client.go
├── go.mod
└── main.go
```

The root `main.go` acts as a thin bootstrap entry point that loads the configuration file once at startup and routes both the arguments and loaded config to the correct command handler in the `cmd` package.

### Bootstrap Entry Point

The entry point located at the project's root `main.go` instantiates the configuration store, loads the settings, and passes them down to modular subcommand handlers.

```go
package main
import (
	"fmt"
	"os"
	"met/cmd"
	"met/pkg/config"
)
func main() {
	store := config.NewStore()
	cfg, err := store.Read()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading configuration: %v\n", err)
		os.Exit(1)
	}
	if len(os.Args) < 2 {
		fmt.Println("Usage: cli <command> [arguments]")
		os.Exit(1)
	}
	switch os.Args[1] {
	case "config-get":
		cmd.HandleGet(os.Args[2:], cfg)
	case "config-set":
		cmd.HandleSet(os.Args[2:], store, cfg)
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}
```

## Subcommand Execution with FlagSet

Go's standard library provides the `FlagSet` structure, allowing you to define distinct flags, default values, and help descriptions for each command independently.

### Implementing Subcommand Handlers

By placing subcommand handlers inside `cmd/cmd.go`, each command accepts the loaded configuration struct as an explicit parameter, maintaining clean dependency patterns.

```go
package cmd
import (
	"flag"
	"fmt"
	"os"
	"met/pkg/config"
)
func HandleGet(args []string, cfg *config.Config) {
	fs := flag.NewFlagSet("config-get", flag.ExitOnError)
	key := fs.String("key", "", "config key")
	_ = fs.Parse(args)
	if *key == "domain" {
		fmt.Println(cfg.Domain)
	} else if *key == "email" {
		fmt.Println(cfg.Email)
	} else {
		fmt.Printf("Key '%s' not recognized\n", *key)
	}
}
func HandleSet(args []string, store *config.Store, cfg *config.Config) {
	fs := flag.NewFlagSet("config-set", flag.ExitOnError)
	key := fs.String("key", "", "config key")
	val := fs.String("val", "", "config value")
	_ = fs.Parse(args)
	if *key == "" || *val == "" {
		fmt.Println("Error: -key and -val are required")
		os.Exit(1)
	}
	if *key == "domain" {
		cfg.Domain = *val
	} else if *key == "email" {
		cfg.Email = *val
	} else if *key == "api_token" {
		cfg.APIToken = *val
	}
	if err := store.Write(cfg); err != nil {
		fmt.Printf("Error saving configuration: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Stored: %s = %s\n", *key, *val)
}
```

## Local Configuration Storage

Storing and retrieving application parameters from a local configuration file is a core requirement for command-line tools. Implementing a lightweight configuration manager allows user settings to persist across terminal sessions inside `pkg/config/store.go`.

### Basic Configuration Store

A standard configuration manager handles structured reading and writing of a strongly typed configuration struct stored in INI format on the local disk. This baseline store is completely unencrypted and manages plain-text settings inside the executable's workspace.

```go
package config
import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)
type Config struct {
	Domain   string
	Email    string
	APIToken string
}
type Store struct {
	filePath string
}
func NewStore() *Store {
	baseDir := "."
	appName := "app"
	if execPath, err := os.Executable(); err == nil {
		baseDir = filepath.Dir(execPath)
		appName = filepath.Base(execPath)
		if len(appName) > 4 && appName[len(appName)-4:] == ".exe" {
			appName = appName[:len(appName)-4]
		}
	}
	return &Store{filePath: filepath.Join(baseDir, appName+".conf")}
}
func (s *Store) Read() (*Config, error) {
	cfg := &Config{}
	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return cfg, nil
	}
	file, err := os.Open(s.filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		switch key {
		case "domain":
			cfg.Domain = val
		case "email":
			cfg.Email = val
		case "api_token":
			cfg.APIToken = val
		}
	}
	return cfg, scanner.Err()
}
func (s *Store) Write(data *Config) error {
	file, err := os.OpenFile(s.filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer file.Close()
	writer := bufio.NewWriter(file)
	_, _ = writer.WriteString(fmt.Sprintf("domain = %s\n", data.Domain))
	_, _ = writer.WriteString(fmt.Sprintf("email = %s\n", data.Email))
	_, _ = writer.WriteString(fmt.Sprintf("api_token = %s\n", data.APIToken))
	return writer.Flush()
}
```

### Password-Based Encryption Options

To protect sensitive credentials (such as API keys or system tokens), you can secure the configuration file by encrypting the entire payload. This option derives a cryptographic key from a user-supplied password to execute AES-256-GCM encryption on the raw INI content before writing it to disk.

```go
package config
import (
	"bufio"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)
type EncryptedStore struct {
	filePath string
	password string
}
func NewEncryptedStore(password string) *EncryptedStore {
	baseDir := "."
	appName := "app"
	if execPath, err := os.Executable(); err == nil {
		baseDir = filepath.Dir(execPath)
		appName = filepath.Base(execPath)
		if len(appName) > 4 && appName[len(appName)-4:] == ".exe" {
			appName = appName[:len(appName)-4]
		}
	}
	return &EncryptedStore{filePath: filepath.Join(baseDir, appName+".conf"), password: password}
}
func (s *EncryptedStore) getEncryptionKey() []byte {
	hash := sha256.Sum256([]byte(s.password))
	return hash[:]
}
func (s *EncryptedStore) encrypt(plaintext []byte) (string, error) {
	key := s.getEncryptionKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}
func (s *EncryptedStore) decrypt(cryptoText string) ([]byte, error) {
	key := s.getEncryptionKey()
	ciphertext, err := base64.StdEncoding.DecodeString(cryptoText)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce, actualCiphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return gcm.Open(nil, nonce, actualCiphertext, nil)
}
func (s *EncryptedStore) Read() (*Config, error) {
	cfg := &Config{}
	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return cfg, nil
	}
	rawBytes, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}
	if len(rawBytes) == 0 {
		return cfg, nil
	}
	decryptedBytes, err := s.decrypt(string(rawBytes))
	if err != nil {
		return nil, err
	}
	scanner := bufio.NewScanner(strings.NewReader(string(decryptedBytes)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		switch key {
		case "domain":
			cfg.Domain = val
		case "email":
			cfg.Email = val
		case "api_token":
			cfg.APIToken = val
		}
	}
	return cfg, scanner.Err()
}
func (s *EncryptedStore) Write(data *Config) error {
	var sb strings.Builder
	_, _ = sb.WriteString(fmt.Sprintf("domain = %s\n", data.Domain))
	_, _ = sb.WriteString(fmt.Sprintf("email = %s\n", data.Email))
	_, _ = sb.WriteString(fmt.Sprintf("api_token = %s\n", data.APIToken))
	encStr, err := s.encrypt([]byte(sb.String()))
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, []byte(encStr), 0600)
}
```

## High-Performance Concurrency

CLI performance is often dominated by latency from sequential network operations. Leveraging Go's native concurrency mechanisms allows you to execute independent tasks in parallel, maximizing network throughput and system efficiency.

### Parallel Workloads using Goroutines

To coordinate multiple concurrent tasks safely, utilize a `sync.WaitGroup`. This structure enables the application to dispatch tasks to the background and block execution until all dispatched tasks report completion.

```go
package cmd
import (
	"fmt"
	"sync"
)
func ProcessItemsConcurrently(items []string) {
	var wg sync.WaitGroup
	for _, item := range items {
		wg.Add(1)
		go func(it string) {
			defer wg.Done()
			fmt.Printf("Processing %s\n", it)
		}(item)
	}
	wg.Wait()
	fmt.Println("All items processed successfully")
}
```

## Resilient API Integration

Integrating with remote services requires standardizing custom configurations such as timeouts, connection options, custom request headers, and error handling behaviors inside `pkg/api/client.go`.

### Structuring a Resilient HTTP Client

A robust client initializes custom transports (e.g. enabling secure TLS skip validations if needed) and sets explicit transaction timeouts. This protects the terminal from hanging indefinitely on stalled or unreachable servers.

```go
package api
import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
			Timeout: 30 * time.Second,
		},
	}
}
func (c *Client) SendRequest(method, path string, payload interface{}) error {
	var body io.Reader
	if payload != nil {
		pBytes, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewBuffer(pBytes)
	}
	req, err := http.NewRequest(method, c.BaseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("request failed: %d", resp.StatusCode)
	}
	return nil
}
```
