AI Overlord (Baseline) is a private Next.js application.

## Windows voice companion

The optional [Windows companion](desktop/README.md) opens Baseline as a desktop
app, uses a local wake phrase to start Wispr Flow dictation, and speaks replies
through an authenticated server endpoint. It uses the server's existing
`OPENAI_API_KEY`; the key is not stored in the desktop package.

## Sign-in

All `/baseline` pages use one Supabase email sign-in at `/login`. The browser and
server share a cookie-backed session through `@supabase/ssr`; server pages and
server actions query Supabase as the signed-in user so database grants and RLS
remain in effect. Magic links return to `/baseline/assistant`, where `proxy.ts`
exchanges the PKCE code before rendering. Keep that URL in the Supabase Auth
redirect allowlist. Existing browser-local sessions need one new sign-in after
this change. The daily-digest integration continues to use its separate
server-only token and secret-key path.

Never use a Supabase secret or service-role key for browser pages or general
dashboard rendering.

## Garmin Personal run imports

Open **More → Garmin Connect** to preview a date range and import selected
completed runs. This uses Garmin's official Personal API, not Garmin login
credentials or unofficial endpoints. It is a single-owner personal integration.
Before activation, set `GARMIN_PERSONAL_API_KEY` and `GARMIN_PERSONAL_USER_ID` in
the protected runtime environment. The owner must exactly match the signed-in
Baseline email (or Auth UUID when no email is present). Never prefix these with
`NEXT_PUBLIC_`, put their values in Git, or paste the key into chat. Host setup
and deployment instructions belong in the Homelab service runbook.

Garmin keys are created by the user at
<https://connect.garmin.com/app/settings/personalApiToken> and expire after the
selected period. Access tokens are exchanged server-side and cached only in
memory. API failures show sanitized messages. No raw response, token, or GPS
track is stored or exposed to Chief of Staff.

Imports use the signed-in Supabase client and existing activities RLS. They
insert source `garmin_personal` and a stable Garmin activity fingerprint;
retries never overwrite records. Possible matches to existing manual/screenshot
runs are excluded for human review. Pagination covers both Garmin and Baseline
records; date windows over one year or more than 500 Garmin runs require a
smaller window. Partial failures report saved counts so a fresh preview can
resume safely. Source units are meters, seconds, kcal and steps/minute; date
uses Garmin's local start date, and pace uses Garmin's average speed.

Manual imports require confirmation. The scheduled worker imports run summaries
only when their Garmin UTC start is strictly after `GARMIN_AUTO_SYNC_START_AT`.
The cutoff is mandatory and never defaults to the current time. It only inserts
new rows, skipping stable IDs and possible manual/screenshot matches; it never
updates, upserts, deletes, or relabels history. The worker requires the explicit
Garmin owner to match the existing digest owner and uses the server-only database
credential for this narrow background job. Browser/manual paths keep using the
signed-in client and RLS. Chief can read resulting activity summaries through
the existing catalog; operational timer cursors contain no workout payloads.

`npm run build` compiles `scripts/garmin-sync.ts` into
`build/garmin-sync/scripts/garmin-sync.js` for the production image. The Homelab
timer runs it every 15 minutes, rechecks a seven-day overlap, and performs a full
catch-up from the immutable cutoff at least daily for delayed uploads. Cursors
advance only after a successful run. Host installation, state, and disabling the
timer are documented in the Homelab service runbook. Strength sets and sending
plans to Garmin remain unsupported. Actual key
activation and a live Garmin import must be verified separately from mocked
API tests. Official reference:
<https://developer.garmin.com/gc-developer-program/personal/swagger-docs/>.

## Database access and verification

Migration `20260928171202_protect_legacy_app_data.sql` enables RLS on the
remaining legacy public tables, limits personal rows to the signed-in user's
email (or Auth UUID when no email is present), and makes public views run with
the caller's permissions. The singleton `dashboard_context` remains readable
only by its active owner because the nutrition cards and meal RPCs use it.
Import state and credential tables remain service-only. Anonymous clients
cannot read the protected tables or views or run public RPCs.

Verified on 2026-09-28 against the production Supabase project: all 68 public
tables had RLS enabled; the signed-in role could read every view used by the
current app, including the homepage summaries; anonymous role lacked access
to the protected data; meal RPC write checks passed in a rolled-back
transaction. Re-run these role-scoped checks after changing view dependencies
or `dashboard_context` ownership.

## Running coach

The Running chat can build a saved goal profile and weekly run plan from recent
individual runs, recovery records, and user-stated availability. It previews
all changes before saving them, and its first reply after this upgrade begins
a clean model response chain while keeping the visible transcript. The Running
card shows the saved goal, current plan, and recent mileage. Run imports no
longer require an estimated calorie value when the watch did not provide one.

The Running coach reads only Running data plus limited recovery signals. Chief
of Staff can read the signed-in user's saved data across Baseline, including
weight entries, goals, and Running training limits, through an explicit
allowlist. It can inspect saved chat history on request; specialist write tools
remain in their own chats. New user-facing sources must be included in Chief's
catalog as described in `AGENTS.md`.
See `markdown/assistant_domains.md` for the tool boundary and migration notes.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
