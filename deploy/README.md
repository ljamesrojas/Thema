# Deploying Thema

Thema runs in two places:

- **The web app and API** (`apps/web`) run on **Vercel**. Accounts live in **Neon** (Postgres) and screenshots of saved projects in **Cloudflare R2**.
- **The extraction worker** (`apps/worker`) and **Redis** (BullMQ queue, rate limits, daily totals) run on one **Oracle Cloud Always Free VM**. The worker opens strangers' URLs in a real browser, so it runs behind its own egress firewall. That firewall is the SSRF boundary; the URL guard in code is a second layer.

```
browser ──▶ Vercel (apps/web) ──rediss://:6380 (TLS + password)──▶ VM: Redis ◀── worker + Chromium ──▶ public internet only
               │  │
               │  └──▶ Neon (accounts, saved projects)
               └─────▶ R2 (screenshots of saved projects)
```

Follow the steps in order. Secrets go straight from the provider's page into Vercel or `apps/web/.env.local`; never paste them into chat, issues or commits.

## 0. Before you start

- Merge `m5-launch` into `main`. Vercel deploys `main` to production, and the VM's setup script checks out `main` (`THEMA_BRANCH` overrides that).
- `pnpm test` and `pnpm typecheck` pass.
- `pnpm --filter @thema/web launch-check` passes, which means every `[PLACEHOLDER]` in `docs/legal/` is filled in. You can deploy before that, but don't announce the site until it passes.

## 1. Neon: a production database

1. In Neon, create a production database: a new project, or a `production` branch of the one you develop on. Keep development data out of it.
2. Copy its **pooled** connection string and make it end in `?sslmode=verify-full`.
3. From your machine, apply the migrations to it. A variable set in the shell wins over `.env.local`.

   ```powershell
   $env:DATABASE_URL = "<production pooled connection string>"
   pnpm --filter @thema/web db:migrate
   Remove-Item Env:DATABASE_URL
   ```

   It prints `Applied: …` the first time and `Up to date.` after that. Run it again whenever a release adds a file to `apps/web/db/migrations/`.

## 2. Cloudflare R2: screenshots

1. Create an R2 bucket, e.g. `thema-screenshots`. Keep it private: Thema serves screenshots through its own route, so no public bucket access is needed.
2. Go to **R2 → Manage API tokens → Create API token**, choose **Object Read & Write**, and limit it to that bucket.
3. Note the **Account ID**, the bucket name, the **Access Key ID** and the **Secret Access Key** (shown once).

## 3. Oracle Cloud: the worker VM

1. **Create an instance.**
   - **Image:** Canonical Ubuntu 24.04 (aarch64).
   - **Shape:** VM.Standard.A1.Flex (Ampere, Always Free). 2 OCPU and 12 GB is plenty; 1 OCPU and 6 GB works.
   - Assign a **public IPv4 address**.
   - Add your SSH public key.
2. **Open the Redis port in the cloud firewall.** Go to Networking → the instance's VCN → its subnet's **Security List** → **Add Ingress Rule**: source `0.0.0.0/0`, TCP, destination port `6380`. Vercel functions have no fixed outgoing IPs on the free plan, so the port is open to all. It still only speaks TLS, needs a 64-character password, and its certificate chains to Thema's own CA.
3. **Reserve the public IP** (Networking → IP Management → Reserved Public IPs), or note it again if the instance is ever recreated. The Redis certificate names this IP; if it changes, re-run setup.
4. **Optional: upgrade the tenancy to Pay As You Go.** It's still free within the Always Free limits. Oracle may reclaim Always Free instances that sit mostly idle, and a Pay As You Go account isn't subject to that.

## 4. The worker: deploy key and setup

The repository is private, so the VM clones it with a **read-only deploy key** that it creates itself.

```bash
# On your machine (Git Bash), from the repo root:
scp deploy/worker/setup.sh ubuntu@<public-ip>:
ssh ubuntu@<public-ip>
sudo bash setup.sh <public-ip>
```

The first run stops at the clone and prints a public key that starts with `ssh-ed25519`. On GitHub, go to the repo → **Settings → Deploy keys → Add deploy key**, paste it, and leave **Allow write access off**. Then run `sudo bash setup.sh <public-ip>` again.

The script then:

- installs Node 22, pnpm, Redis and Chromium
- sets up Redis: TLS only, on port 6380
- writes `/etc/thema/worker.env`
- loads the firewall and starts the worker
- ends by running `check-firewall.sh`

Every line of that check must say `ok`. A `skip` line means a target didn't answer even as root, so the check proves nothing for it; nothing more is needed. A `FAIL` line means the worker must not go into service. The firewall check tests:

- **Public internet** works as `thema-worker`.
- **Blocked:** the metadata service (169.254.169.254), localhost, and the VM's private address.
- **Redis:**
  - It answers over TLS with the password.
  - It doesn't answer without the password.
  - There's no plain-text port.

At the end, setup prints the two values Vercel needs:

- `REDIS_URL` is `rediss://default:<password>@<public-ip>:6380`. Read the password with `sudo cat /etc/thema/redis-password`.
- `REDIS_TLS_CA` is the whole of `/etc/thema/tls/ca.crt`, including the BEGIN and END lines. Run `sudo cat /etc/thema/tls/ca.crt` and copy it.

**Check from your machine** that Redis is reachable only through TLS (needs `redis-cli` locally, or skip this step):

```bash
redis-cli -h <public-ip> -p 6380 PING                                  # fails: TLS required
redis-cli --tls --cacert ca.crt -h <public-ip> -p 6380 PING            # NOAUTH: password required
```

**Updating the worker:** run `sudo bash /opt/thema/app/deploy/worker/setup.sh <public-ip>`. It pulls `main`, reinstalls and restarts, and keeps the password, certificates and key.

**Logs:** `journalctl -u thema-worker -f` prints a `running` line and then `done` or `failed` for every job.

**Re-check the fence at any time:** `sudo bash /opt/thema/app/deploy/worker/check-firewall.sh`.

The fence (`deploy/worker/firewall.nft`) applies to connections from the `thema-worker` user only. The rest of the VM is unaffected.

- **Allowed:** the public internet, Redis on 127.0.0.1:6380, and DNS through systemd-resolved (127.0.0.53).
- **Rejected:**
  - private ranges: 10/8, 172.16/12, 192.168/16, 100.64/10
  - loopback
  - link-local, which includes the metadata service
  - multicast, and the documentation and benchmark ranges
  - the IPv6 equivalents of all of the above

Because rejection happens at connect time, DNS rebinding can't get past it either.

## 5. Production sign-in apps

The development OAuth apps point at `localhost`. Production needs its own, which call back to the Vercel address (`https://<project>.vercel.app`, below `<site>`).

- **GitHub:** go to Settings → Developer settings → OAuth Apps → **New OAuth App**.
  - **Homepage:** `<site>`
  - **Callback:** `<site>/api/auth/callback/github`
  - Generate a client secret.
- **Google:** go to Google Cloud Console → APIs & Services → Credentials, and create an **OAuth client ID** (Web application), or edit the existing one.
  - **Authorized JavaScript origin:** `<site>`
  - **Authorized redirect URI:** `<site>/api/auth/callback/google`
  - On the **OAuth consent screen**, set the app to **In production**. While it's in Testing, only listed test users can sign in.

You only know the exact `<site>` after the first Vercel deploy (step 6). Create the apps then, add their keys to Vercel, and redeploy.

## 6. Vercel: the web app

1. Click **Add New → Project** and import the GitHub repo.
2. Fill in these settings:

   | Setting                                | Value                                                                                                 |
   | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
   | Root Directory                         | `apps/web` (leave "Include files outside the root directory" on: the app uses the workspace packages) |
   | Framework                              | Next.js                                                                                               |
   | Build Command                          | `pnpm build` (runs `next build --webpack`; Turbopack can't build this app)                            |
   | Install Command                        | default                                                                                               |
   | Node.js Version (Settings → General)   | 22.x                                                                                                  |
   | Function Region (Settings → Functions) | the region nearest your Neon database                                                                 |

3. Add the **Environment Variables**, for Production:

   | Name                                                                     | Value                                                                                                                       |
   | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
   | `ENABLE_EXPERIMENTAL_COREPACK`                                           | `1` (Vercel then uses the exact pnpm in `package.json`)                                                                     |
   | `REDIS_URL`                                                              | from setup (step 4)                                                                                                         |
   | `REDIS_TLS_CA`                                                           | the CA certificate from setup (step 4), pasted whole                                                                        |
   | `DATABASE_URL`                                                           | Neon's production pooled string (step 1)                                                                                    |
   | `BETTER_AUTH_SECRET`                                                     | a new random secret, not the development one: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `BETTER_AUTH_URL`                                                        | `<site>`, with no trailing slash                                                                                            |
   | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                               | the production GitHub app (step 5)                                                                                          |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                               | the production Google client (step 5)                                                                                       |
   | `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | step 2                                                                                                                      |
   | `THEMA_DAILY_EXTRACTIONS`                                                | leave unset (3, as SPEC says)                                                                                               |

   **Preview deployments:** without these variables a preview runs like local development: no sign-in, and extraction in-process, which fails on Vercel. That's fine for checking pages. Don't give previews the production database or Redis.

4. **Deploy.** Then complete step 5 with the real `<site>`, set `BETTER_AUTH_URL` and the OAuth keys, and **Redeploy**: variables only apply to new deployments.

The web app trusts `x-forwarded-for` for the signed-out daily limit, and Vercel sets that header. On any other host, make sure the proxy overwrites it.

## 7. Smoke test

On `<site>`, in a private window:

1. The Landing, `/how-it-works`, `/exports`, `/agents`, `/plans`, `/privacy` and `/terms` load; `/pricing` goes to `/plans`, `/refunds` to `/terms`; `/nope` shows the 404 page.
2. **Workspace:** paste `https://example.com`. The card goes through fetching, then reading, then done, and the VM's log shows `running` and then `done`. A second paste of the same URL is instant: it's served from the cache and doesn't count toward the limit.
3. Paste `http://localhost:3000`. It's refused before anything is queued.
4. Blend, open **Preview**, then **Export**: the zip downloads, and its `DESIGN.md` opens.
5. **Sign in with GitHub**, then sign out and **sign in with Google**.
6. Save the project, reload, and check that it's still there with its screenshot. Check that the Projects screen lists it.
7. Make a throwaway account, then delete it from the account menu (**Delete account**). You're sent to the home page, and signing in again starts with no projects.
8. **Daily totals:** run this from your machine.

   ```powershell
   $env:REDIS_URL = "<REDIS_URL from step 4>"
   $env:REDIS_TLS_CA_FILE = "<path to a local copy of ca.crt>"
   pnpm --filter @thema/web stats 7
   ```

   It should show today's extractions, blends, exports and sign-ups.

## 8. npm: thema-cli and thema-mcp

The packages are built and tested (`packages/cli/test/npm-package.test.ts`, `packages/mcp/test/npm-package.test.ts`). Publishing is yours, since your npm account has 2FA on writes:

```bash
pnpm build:npm
cd packages/cli/npm && npm publish --access public   # asks for your one-time code
cd ../../mcp/npm && npm publish --access public
```

Then check from an empty folder: `npx -y thema-cli --help` and `npx -y thema-cli setup`.

After that, the setup snippets on the Export screen and the For agents page switch from "run from a clone" to `npx` (one code change, `apps/web/src/lib/exports-meta.ts`), as do the CLI and MCP READMEs.

## 9. Launch checklist

- [ ] `pnpm --filter @thema/web launch-check` passes (the legal pages are filled in).
- [ ] `check-firewall.sh` reports every check `ok` on the VM.
- [ ] The smoke test (step 7) passes on the production address.
- [ ] Every production secret is new: none are reused from `.env.local`.
- [ ] GitHub's deploy key is read-only.
- [ ] Oracle's security list opens only 22 and 6380.
- [ ] Neon has point-in-time restore on (the default history window is enough to start).
- [ ] `thema-cli` and `thema-mcp` are published, and the snippets use `npx`.
