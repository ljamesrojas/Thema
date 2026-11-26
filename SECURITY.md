# Security

Thema opens websites that strangers paste in a real browser, so its safety matters to me. Thank you for helping keep it safe.

## Reporting a problem

Please **don't open a public issue** for a security problem. Use either of these instead:

- GitHub's **private vulnerability reporting**: the repository's **Security** tab, then **Report a vulnerability**.
- Email **lawrenzejamesrojas@gmail.com** with "Thema security" in the subject.

Include what you found, how to reproduce it, and what you think the impact is. I'll reply within a week. Thema is a personal project, so there's no bug bounty, but I'll credit you in the fix if you'd like.

## What's in scope

- The hosted site at https://thema-ten.vercel.app and its API.
- The code in this repository, including the CLI (`thema-cli`) and the MCP server (`thema-mcp`).

Most useful are ways to get around the browser's fence (below), to read another person's saved projects or account, or to make Thema run code or reach places it shouldn't.

Please don't run denial-of-service tests, spam extractions past the daily limits, or try to access other people's data. Thema runs on free plans, and a flood of requests takes it down for everyone.

## How the browser is fenced

Reading a site means loading an untrusted page in Chromium, so every request it makes is checked:

- **URL check.** Only public `http(s)` addresses pass, never private, local, link-local (cloud metadata) or reserved ranges, IPv4 and IPv6 (`@thema/url-guard`). Redirects are followed by Thema itself, and each hop is checked before it's requested.
- **Connect-time check.** The socket connects only to the public address that was just checked, so DNS rebinding (a public answer first, `127.0.0.1` next) gets nowhere (`apps/worker/src/upstream.ts`).
- **WebSockets and WebRTC are blocked**, since they would bypass request routing.
- **On a worker server**, an nftables egress firewall for the browser's user (`deploy/worker/firewall.nft`) is the outer wall.

Secrets live only in the host's environment variables (Vercel), never in this repository.
