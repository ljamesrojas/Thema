#!/usr/bin/env bash
# Check the worker's fence from the inside: as the `thema-worker` user (the one Chromium runs as),
# the public internet and its own Redis must work, and nothing else may answer.
#
#   sudo bash /opt/thema/app/deploy/worker/check-firewall.sh
#
# Exits 1 if any check fails. setup.sh runs it at the end; run it again after any VM change.
set -uo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root: sudo bash check-firewall.sh" >&2; exit 1; }

failed=0
as_worker() { runuser -u thema-worker -- "$@"; }
pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; failed=1; }

# Can `user` open a TCP connection to host:port? (bash's /dev/tcp, so any listener counts.)
tcp_open() { runuser -u "$1" -- timeout 5 bash -c "exec 3<>/dev/tcp/$2/$3" 2>/dev/null; }

# A connection the worker must NOT be able to make. Checked against root first: a target that
# doesn't answer root either proves nothing, so it's skipped rather than counted as blocked.
blocked() {
  local label=$1 host=$2 port=$3
  if ! tcp_open root "$host" "$port"; then
    printf '  skip  %s (%s:%s does not answer root either)\n' "$label" "$host" "$port"
  elif tcp_open thema-worker "$host" "$port"; then
    fail "$label is reachable ($host:$port)"
  else
    pass "$label blocked"
  fi
}

echo "As thema-worker:"
if as_worker curl -sS -o /dev/null -m 10 https://example.com/; then
  pass "public internet (https://example.com)"
else
  fail "public internet unreachable (https://example.com): DNS or egress is broken"
fi

blocked "cloud metadata service" 169.254.169.254 80
blocked "localhost SSH" 127.0.0.1 22
blocked "localhost SSH over IPv6" ::1 22
private_ip="$(ip -4 -o addr show scope global | awk '{ split($4, a, "/"); print a[1]; exit }')"
[[ -n $private_ip ]] && blocked "the VM's private address" "$private_ip" 22
if nft list table inet thema >/dev/null 2>&1; then
  pass "firewall table loaded (private, link-local and multicast ranges rejected)"
else
  fail "firewall table inet thema is missing"
fi

# runuser keeps the environment, so the password travels in REDISCLI_AUTH, not on a command line.
pong="$(REDISCLI_AUTH="$(cat /etc/thema/redis-password)" as_worker \
  redis-cli --tls --cacert /etc/thema/tls/ca.crt -h 127.0.0.1 -p 6380 --no-auth-warning PING 2>&1)"
if [[ $pong == PONG ]]; then
  pass "its Redis over TLS (127.0.0.1:6380)"
else
  fail "its Redis over TLS (127.0.0.1:6380): $pong"
fi

echo "Redis from outside:"
if redis-cli -h 127.0.0.1 -p 6379 PING >/dev/null 2>&1; then
  fail "plain-text Redis answers on 6379"
else
  pass "no plain-text port (6379 closed)"
fi
if redis-cli --tls --cacert /etc/thema/tls/ca.crt -h 127.0.0.1 -p 6380 PING 2>/dev/null | grep -q PONG; then
  fail "Redis answers without the password"
else
  pass "password required"
fi

echo "Services:"
for unit in thema-firewall redis-server thema-worker; do
  if systemctl is-active --quiet "$unit"; then pass "$unit running"; else fail "$unit not running"; fi
done

if [[ $failed -ne 0 ]]; then
  echo "Some checks failed. Don't put the worker in service until they pass." >&2
  exit 1
fi
echo "All checks passed."
