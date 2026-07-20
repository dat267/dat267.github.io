---
title: Networking
description: SSH tunneling, tcpdump filters, TLS debugging with openssl, DNS resolution with dig, and socket statistics.
icon: seti:terminal
---

## SSH Tunneling

### Local, Remote, and Dynamic Port Forwarding

Forward remote ports to localhost, expose local ports to remote networks, or create a SOCKS proxy.

```sh
ssh -L 9000:internal.db:5432 bastion    # local forward
ssh -R 8080:localhost:80 gateway        # remote forward
ssh -D 1080 jumpbox                      # SOCKS proxy
```

Combine with `-J` (JumpHost) to chain through multiple hosts: `ssh -J bastion,internal-gw target`.

### Multiplex a Single Connection

Reuse an existing SSH connection for subsequent sessions, eliminating repeated TCP and TLS handshakes.

```sh
# ~/.ssh/config
Host *
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h:%p
    ControlPersist 10m
```

Create the socket directory with `mkdir -p ~/.ssh/sockets`.

## Packet Capture

### BPF Filter for Specific Traffic

Capture only HTTP/HTTPS traffic to or from a specific subnet, writing to a file for offline analysis.

```sh
tcpdump -i eth0 -w capture.pcap -s 0 \
  "(tcp port 80 or tcp port 443) and net 10.0.0.0/8"
```

Read with `tcpdump -r capture.pcap -A` for ASCII payload or `-X` for hex+ASCII.

## TLS Debugging

### Inspect Server Certificate Chain

Connect to a TLS endpoint and dump the full certificate chain for expiration and subject validation.

```sh
openssl s_client -connect example.com:443 -servername example.com -showcerts < /dev/null
```

The `-servername` flag sets the SNI hostname. Pipe the `-----BEGIN CERTIFICATE-----` blocks into `openssl x509 -text -noout` for detailed field inspection.

## DNS Resolution

### Trace the Full Resolution Path

Walk every authoritative nameserver from the root zone to the answer, useful for diagnosing propagation delays or delegation misconfigurations.

```sh
dig +trace example.com
```

Add `@1.1.1.1` to use a specific resolver as the starting point instead of the system default.

## Socket Statistics

### Show Listening TCP Sockets

Display all listening TCP sockets with the associated process, the modern replacement for `netstat -tlnp`.

```sh
ss -tlnp
```

Use `ss -tup` to see all TCP and UDP connections, or `ss -s` for a summary of socket counts by state.
