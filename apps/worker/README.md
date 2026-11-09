# @thema/worker

Loads a reference site in headless Chromium and records raw `StyleSample[]` plus a screenshot. It does no analysis; that's `@thema/engine`.

## Setup (once)

```sh
pnpm install
pnpm --filter @thema/worker exec playwright install chromium   # ~200 MB download
```

The worker's tests launch Chromium too, so `pnpm test` needs this step.

## Usage

```sh
pnpm extract https://example.com --out fixtures/example/
pnpm palette fixtures/example        # run the engine on what was recorded
```

A relative `--out` is resolved against the repo root. The CLI writes:

| File                | Contents                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| `samples.json`      | `StyleSample[]` from the light pass                                                 |
| `samples.dark.json` | Only when `prefers-color-scheme: dark` flips the canvas (`canvasFlipsInDark`)       |
| `screenshot.png`    | Full-page screenshot of the light pass. Gitignored: never commit third-party images |

## What a pass does

1. Opens a fresh context at 1440×900 with the given color scheme and reduced motion.
2. Navigates, then waits for network idle (up to 10 s; many sites never go idle).
3. Dismisses a cookie banner. It tries reject or "necessary only" first, then accept, in every frame. Known consent managers come first; after that, exact button labels inside elements that look like a consent banner.
4. Closes a "where are we shipping to?" location modal if there is one (never picks a country), then scrolls down 600px at a time with a short pause so scroll-triggered and lazy content renders, returns to the top and waits for network idle.
5. Collects samples in the page ([`src/collect.ts`](src/collect.ts)):
   - **What's kept:** visible elements with a style signal (background, drawn border, text, interactive or heading role, shadow, radius), at most 2000, keeping the largest. Layout wrappers with nothing visible of their own are kept too when they carry spacing (padding, margin or flex/grid gap), as `role: "container"`, with their own budget of 2000 so they never push out the samples above. They carry most of a page's section padding and gaps.
   - **Roles:** guessed from the tag and ARIA role.
   - **Values:**
     - `borderColor` only for drawn borders.
     - `line-height: normal` becomes 1.2 × the font size.
     - `opacity` is the effective opacity (multiplied through ancestors), sent only below 1 and never on `html`.
     - `fill`: for a transparent button or link, the color painted behind it by its gradient, a covering `::before`/`::after`, or a child covering half its area.
     - `y`: the top of the box from the top of the document (the engine uses it to find first-screen calls-to-action).
     - `className`: the class attribute, trimmed and single-spaced, at most 80 characters (the engine counts repeated identical elements once when finding the spacing base).
     - `inHeading` / `inCode`: the element is, or is inside, a heading (h1–h6, `role="heading"`) or `pre`/`code`/`kbd`/`samp`. A styled span inside an h1 records as body text by its tag; this flag tells the engine it's heading text.
     - `html` reports the color that actually paints the canvas (html, else body, else the browser's `Canvas` color).
   - **Skipped:** visually hidden elements (sr-only `clip`/`clip-path` on the element or a parent, or boxes 1px or smaller), such as skip links.

## SSRF guard

[`src/ssrf.ts`](src/ssrf.ts) rejects any request that isn't http(s), has credentials, targets `localhost`, or resolves to a private, loopback, link-local, CGNAT, multicast, reserved or documentation address. That includes `169.254.169.254` and IPv4-mapped IPv6.

It checks the URL before Chromium starts, and then **every request and every redirect hop**:

- Playwright's route handler only sees the first request of a redirect chain, and Chromium follows redirects on its own. So the worker follows redirects itself, checking each hop before requesting it, and hands the browser only the final response.
- The page's own redirects are resolved the same way before navigating, so the page loads at its final URL.

**Limits:**

- **DNS rebinding:** a host could resolve to a public address for the check and a private one for the actual request.
- **Uncovered request types:** WebSocket and WebRTC traffic doesn't go through the route handler.

A hosted worker must also run behind an egress firewall that blocks private ranges. That firewall is the real boundary; this guard is defence in depth.

## Tests

All tests run offline. Browser tests either abort every request and use `page.setContent`, or serve an in-memory website through the injectable `upstream`. The SSRF guard still checks every hop in those tests.
