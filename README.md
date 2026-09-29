AI Overlord (Baseline) is a private Next.js application.

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

## Database access

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
of Staff receives the current week's focus and planned mileage, but no Running
chat excerpt or training limits. See `markdown/assistant_domains.md` for the
tool boundary and migration notes.

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
