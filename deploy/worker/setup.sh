#!/usr/bin/env bash
# Set up (or update) Thema's extraction worker and its Redis on a fresh Ubuntu 24.04 VM.
#
#   sudo bash setup.sh <public-ip>
#
# Copy it to the VM first (scp deploy/worker/setup.sh ubuntu@<public-ip>:); after that it lives in
# the clone, so updates are: sudo bash /opt/thema/app/deploy/worker/setup.sh <public-ip>
#
# Safe to run again: it keeps the existing Redis password, certificates and deploy key, pulls the
# latest code, reinstalls and restarts. What it sets up:
#   - Node 22 (NodeSource) and pnpm (the version in package.json, through corepack)
#   - the code in /opt/thema/app (root-owned, read-only to the worker), cloned with a read-only
#     GitHub deploy key, and Chromium in /opt/thema/browsers
#   - Redis on port 6380, TLS only (Thema's own CA; the certificate names <public-ip> and
#     127.0.0.1), a password, no eviction, append-only persistence, dangerous commands disabled
#   - the `thema-worker` user, its egress firewall and its systemd service
#   - an iptables rule opening 6380 (the cloud's security list must open it too)
#
# Settings (environment): THEMA_REPO (default the GitHub repo over SSH), THEMA_BRANCH (main).
set -euo pipefail

PUBLIC_IP="${1:-}"
REPO="${THEMA_REPO:-git@github.com:ljamesrojas/Thema.git}"
BRANCH="${THEMA_BRANCH:-main}"

APP=/opt/thema/app
HOME_DIR=/opt/thema/home
BROWSERS=/opt/thema/browsers
ETC=/etc/thema
TLS=$ETC/tls
REDIS_TLS=/etc/redis/tls
REDIS_PORT=6380
# The service files and the firewall come from the checked-out code, so they match it.
KIT=$APP/deploy/worker

say() { printf '\n== %s\n' "$*"; }
die() { printf 'setup: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root: sudo bash setup.sh <public-ip>"
[[ $PUBLIC_IP =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] ||
  die "give the VM's public IPv4 address (the cloud console shows it): sudo bash setup.sh 203.0.113.7"
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || die "this script is written for Ubuntu 24.04 (found ${PRETTY_NAME:-unknown})"

export DEBIAN_FRONTEND=noninteractive COREPACK_ENABLE_DOWNLOAD_PROMPT=0

say "Packages"
apt-get update -q
apt-get install -y -q ca-certificates curl git gnupg openssl nftables redis-server iptables-persistent
if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') != 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi
corepack enable

say "Worker user"
id thema-worker >/dev/null 2>&1 ||
  useradd --system --home-dir "$HOME_DIR" --shell /usr/sbin/nologin thema-worker
install -d -o thema-worker -g thema-worker -m 0750 "$HOME_DIR"
install -d -m 0755 "$ETC" "$TLS" /opt/thema

say "Code ($REPO, $BRANCH)"
KEY=$ETC/deploy_key
KNOWN=$ETC/known_hosts
# GitHub's published SSH host key (docs.github.com → GitHub's SSH key fingerprints).
echo "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl" >"$KNOWN"
[[ -f $KEY ]] || ssh-keygen -q -t ed25519 -N "" -C "thema-worker deploy key" -f "$KEY"
chmod 0600 "$KEY"
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o UserKnownHostsFile=$KNOWN -o StrictHostKeyChecking=yes"
fetch_failed() {
  cat >&2 <<EOF

setup: GitHub refused the clone. Add this VM's key to the repository as a deploy key
(GitHub → the repo → Settings → Deploy keys → Add deploy key; leave "Allow write access" off):

$(cat "$KEY.pub")

then run this script again.
EOF
  exit 1
}
if [[ -d $APP/.git ]]; then
  git -C "$APP" fetch --quiet origin "$BRANCH" || fetch_failed
  git -C "$APP" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP" || fetch_failed
fi
echo "at $(git -C "$APP" log -1 --format='%h %s')"

say "Dependencies and Chromium"
cd "$APP"
corepack pnpm install --frozen-lockfile --filter "@thema/worker..."
install -d -m 0755 "$BROWSERS"
PLAYWRIGHT_BROWSERS_PATH=$BROWSERS corepack pnpm --filter @thema/worker exec playwright install --with-deps chromium
chmod -R a+rX "$BROWSERS"
cd /

say "Redis TLS certificates"
if [[ ! -f $TLS/ca.key ]]; then
  openssl req -x509 -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
    -keyout "$TLS/ca.key" -out "$TLS/ca.crt" -days 3650 -subj "/CN=Thema Redis CA" 2>/dev/null
  chmod 0600 "$TLS/ca.key"
fi
chmod 0644 "$TLS/ca.crt"
# A new server certificate when there is none or the public IP changed.
if [[ ! -f $REDIS_TLS/redis.crt ]] ||
  ! openssl x509 -in "$REDIS_TLS/redis.crt" -noout -ext subjectAltName 2>/dev/null | grep -q "IP Address:$PUBLIC_IP\b"; then
  install -d -o redis -g redis -m 0750 "$REDIS_TLS"
  openssl req -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
    -keyout "$REDIS_TLS/redis.key" -out "$REDIS_TLS/redis.csr" -subj "/CN=thema-redis" 2>/dev/null
  openssl x509 -req -in "$REDIS_TLS/redis.csr" -CA "$TLS/ca.crt" -CAkey "$TLS/ca.key" \
    -CAcreateserial -out "$REDIS_TLS/redis.crt" -days 825 \
    -extfile <(printf 'subjectAltName=IP:%s,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' "$PUBLIC_IP") 2>/dev/null
  rm -f "$REDIS_TLS/redis.csr"
  cp "$TLS/ca.crt" "$REDIS_TLS/ca.crt"
  chown redis:redis "$REDIS_TLS"/*
  chmod 0600 "$REDIS_TLS/redis.key"
fi

say "Redis"
PASSWORD_FILE=$ETC/redis-password
[[ -f $PASSWORD_FILE ]] || (umask 077 && openssl rand -hex 32 >"$PASSWORD_FILE")
PASSWORD="$(cat "$PASSWORD_FILE")"
(
  umask 027
  cat >/etc/redis/thema.conf <<EOF
# Written by deploy/worker/setup.sh. Overrides /etc/redis/redis.conf (included at its end).
bind 0.0.0.0
port 0
tls-port $REDIS_PORT
tls-cert-file $REDIS_TLS/redis.crt
tls-key-file $REDIS_TLS/redis.key
tls-ca-cert-file $REDIS_TLS/ca.crt
tls-auth-clients no
requirepass $PASSWORD
# BullMQ needs every key kept: never evict.
maxmemory-policy noeviction
appendonly yes
appendfsync everysec
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command DEBUG ""
rename-command CONFIG ""
rename-command MODULE ""
EOF
)
chown root:redis /etc/redis/thema.conf
grep -qx 'include /etc/redis/thema.conf' /etc/redis/redis.conf ||
  echo 'include /etc/redis/thema.conf' >>/etc/redis/redis.conf
systemctl enable --quiet redis-server
systemctl restart redis-server

say "Worker settings"
(
  umask 027
  cat >"$ETC/worker.env" <<EOF
# Written by deploy/worker/setup.sh.
REDIS_URL=rediss://default:$PASSWORD@127.0.0.1:$REDIS_PORT
REDIS_TLS_CA_FILE=$TLS/ca.crt
PLAYWRIGHT_BROWSERS_PATH=$BROWSERS
HOME=$HOME_DIR
NODE_ENV=production
EOF
)
chown root:thema-worker "$ETC/worker.env"

say "Firewall"
sed "s/@WORKER_UID@/$(id -u thema-worker)/" "$KIT/firewall.nft" >"$ETC/firewall.nft"
install -m 0644 "$KIT/thema-firewall.service" "$KIT/thema-worker.service" /etc/systemd/system/
# Inbound: Oracle's Ubuntu images reject everything but SSH in iptables; open the Redis port.
iptables -C INPUT -p tcp --dport "$REDIS_PORT" -j ACCEPT 2>/dev/null ||
  iptables -I INPUT -p tcp --dport "$REDIS_PORT" -j ACCEPT
netfilter-persistent save >/dev/null
systemctl daemon-reload
systemctl enable --quiet thema-firewall thema-worker
systemctl restart thema-firewall
systemctl restart thema-worker

say "Checks"
bash "$KIT/check-firewall.sh"

cat <<EOF

Done. Put these in Vercel (Project → Settings → Environment Variables, Production):

  REDIS_URL     rediss://default:<password>@$PUBLIC_IP:$REDIS_PORT
                (the password: sudo cat $PASSWORD_FILE)
  REDIS_TLS_CA  the whole of $TLS/ca.crt (cat it and paste, BEGIN and END lines included)

Worker logs: journalctl -u thema-worker -f
EOF
