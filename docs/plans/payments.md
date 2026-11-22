# Plan: selling Thema Pro (on hold)

**Status:** on hold since 2026-11-22. Thema is a free personal project for the owner's portfolio, so nothing is for sale. This plan keeps every payment decision made so far, so turning it on later starts from here, not from zero.

## What was decided

| Topic | Decision | When |
| --- | --- | --- |
| Price | $12 a month or $96 a year (save 33%), in US dollars everywhere | 2026-11-15 |
| Payment provider | **Paddle**, as merchant of record: it sells Pro in its own name and handles sales tax, VAT, receipts and refunds abroad. Stripe may not accept Philippine sellers. | 2026-11-15 |
| Backup provider | **Dodo Payments**, also a merchant of record, if Paddle refuses the account | 2026-11-15 |
| Plan limits | Free: 3 saved projects, 10 new extractions a day. Pro: unlimited projects, 50 a day. Signed out: 1 browser project, 3 a day. | 2026-11-15 |
| Hosting | Vercel's free Hobby plan is for **non-commercial use only**. The day Pro goes on sale, upgrade to **Vercel Pro** (about $20 a month), or move the web app to a host whose free plan allows commercial use. | 2026-11-21 |

Two Pro subscribers at $12 roughly cover Vercel Pro after Paddle's fees.

## What already exists in the code

- `apps/web/src/server/plans.ts`: the limits of each plan. Pro is a `plan` column on the user that users can't set themselves (`input: false` in Better Auth, tested). Today it's set by hand in the database.
- The rate limiter and the saved-project limit already read the account's plan.
- The account menu shows the plan (Free or Pro).

## What was taken out on 2026-11-22, to bring back

All of it is in Git history: the last commit with it is `6087fbc` (branch `m5-launch`).

- **The Pricing page** (`/pricing`; `apps/web/src/site/pricing-page.tsx`, `pricing-plans.tsx`):
  - a Monthly/Yearly toggle ("save 33%")
  - prices on the Pro card, from `PRICES` in `plans.ts` (also removed, with `yearlySaving`)
  - a "Coming soon" label for Pro
  - billing questions

  Today's page is `/plans` with no prices, and `/pricing` redirects to it (`next.config.ts`).
- **The Refund policy** (`/refunds`): its draft is kept in [refund-policy-draft.md](refund-policy-draft.md). `/refunds` redirects to `/terms` for now.
- **The payment parts of the legal drafts:**
  - Terms → "Plans and payments": Paddle as seller of record, renewals, cancelling, refunds, price changes, and refunds when a paid feature is removed or an account is closed.
  - Privacy → "Payments", and Paddle in the list of services.

## Steps to turn it on

1. **Apply to Paddle.**
   - Paddle reviews the website before approving. It needs live Terms, Privacy and Refund pages, clear prices, and the seller's details.
   - Bring the Pricing page and `/refunds` back first: remove the two redirects and restore the files from `6087fbc`.
   - Restore the payment parts of Terms and Privacy.
2. **Upgrade Vercel to Pro**, or move hosting, before the first sale.
3. **Connect billing** (a new session, planned with tests first):
   - **Paddle Checkout** from the Pricing page's Pro button, for signed-in users only.
   - **A webhook route:** it checks Paddle's signature, then sets or clears the user's `plan` when a subscription starts, renews, is cancelled or lapses.
   - **Customer portal link** in the account menu, to manage or cancel.
   - **Tests:** webhook signature checks, plan changes for each event, and that no request from a user can change their own plan.
4. **Update SPEC.md** (Pro is no longer only a flag) and the Decisions log, and log the Paddle account details as a reference (not the keys).
5. **Fill the Refund policy's placeholders**, then make sure `pnpm --filter @thema/web launch-check` covers it again: move it back to `docs/legal/`.
