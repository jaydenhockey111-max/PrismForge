# PrismForge

PrismForge is an AI Founder Operating System MVP that helps founders generate Opportunity Reports, validate demand, monitor Market Pulse signals, plan MVPs, consult AI Employees, prepare private-alpha launches, collect beta feedback, and manage startup projects.

Live site: https://opportunity-hunter-alpha.vercel.app

## What is already working

- Email/password authentication, email confirmation, password reset, and protected routes
- User profiles with age, state, income, student status, occupation, and interests
- A deterministic 0–100 eligibility matching engine
- Free-plan enforcement at five visible matches
- Responsive dashboard with scores, match reasons, categories, and deadlines
- Role-protected admin create, edit, and delete workflows
- Stripe Checkout, Customer Portal, and signed webhook code
- Premium email-alert code for new matches and seven-day deadlines
- Supabase schema, indexes, triggers, row-level security, and protected billing columns
- Daily Vercel cron configuration
- Project-scoped Market Pulse architecture with manual refresh, local cache, and cooldown
- Automated matching tests, strict TypeScript checks, and a production build

Stripe payments and Resend email delivery are implemented but remain inactive until their environment variables are configured.

## Project structure

```text
app/
  (auth)/                    Sign-up, sign-in, and password recovery
  (marketing)/               Public landing page
  (app)/
    dashboard/               Ranked opportunity matches
    profile/                 User onboarding and profile editor
    admin/                   Role-protected opportunity management
    billing/                 Free/Premium plan page
  api/
    stripe/                  Checkout, portal, and webhook endpoints
    cron/notifications/      Daily premium email-alert job
  auth/callback/             Supabase email-link callback
components/                  Shared interface components
lib/
  ingestion/                 Source connectors, normalization, and deduplication
  matching.ts                Rule evaluation and ranking engine
  email.ts                   Resend email template and sender
  stripe.ts                  Stripe server client
  supabase/                  Browser, server, middleware, and admin clients
supabase/
  migrations/                Database schema and security policies
  seed.sql                   Five sample opportunities
vercel.json                  Daily cron schedule
```

## Run locally

1. Install Node.js 20 or newer.
2. Open PowerShell in this folder.
3. Install packages:

   ```powershell
   npm.cmd install
   ```

4. Fill in `.env.local`.
5. Start the app:

   ```powershell
   npm.cmd run dev
   ```

6. Visit http://localhost:3000.

Use `npm.cmd` on this Windows computer because its PowerShell policy blocks `npm.ps1`.

## Private beta auth and redirect settings

Set `NEXT_PUBLIC_APP_URL` to the exact deployed URL for the current environment, for example `http://localhost:3000` locally or the Vercel production URL in production. `NEXT_PUBLIC_SITE_URL` is still accepted as a backward-compatible fallback.

In Supabase Auth settings:

- Site URL: `NEXT_PUBLIC_APP_URL`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - your production URL + `/auth/callback`
  - any Vercel preview URL + `/auth/callback` if you test previews
- Password reset redirect: production URL + `/auth/callback?next=/reset-password`
- Email verification redirect: production URL + `/auth/callback?next=/dashboard`

For private beta, email confirmation is recommended. Google sign-in is supported through Supabase OAuth; enable Google in Supabase Auth Providers and add the Supabase callback URL in Google Cloud. Server-side profile repair requires `SUPABASE_SERVICE_ROLE_KEY`; never expose that key to the browser.

Beta support:

- `NEXT_PUBLIC_SUPPORT_EMAIL` is optional. If it is missing, the public support page points testers to the in-app Beta Feedback form instead of showing a fake placeholder.
- `NEXT_PUBLIC_APP_URL` is also used for auth redirects, email links, and Stripe success/cancel URLs.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...

RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=PrismForge <alerts@yourdomain.com>

NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=use-a-long-random-value
```

Never commit `.env.local`. Only variables beginning with `NEXT_PUBLIC_` are allowed in browser code. The Supabase service-role key, Stripe secret, webhook secret, Resend key, and cron secret must remain server-only.

## Supabase setup

1. Create a Supabase project.
2. Copy its project URL, publishable key, and secret/service-role key into `.env.local`.
3. Open **SQL Editor → New query**.
4. Run `supabase/migrations/20260624000000_initial_schema.sql`.
5. Run `supabase/seed.sql` in a second query.
6. Open **Authentication → URL Configuration**.
7. Set the production Site URL to the Vercel domain.
8. Add both callback URLs:

   ```text
   http://localhost:3000/auth/callback
   https://YOUR_DOMAIN/auth/callback
   ```

The schema automatically creates a profile whenever an Auth user is created. Row-level security prevents users from reading other profiles or modifying opportunities. Column grants prevent users from promoting themselves or changing billing-owned fields.

### Make an administrator

The only PrismForge owner/admin account is `jayden.hockey111@gmail.com`. Profile repair will restore this role on login/callback when `SUPABASE_SERVICE_ROLE_KEY` is configured. If you want to repair it manually, run:

```sql
update public.profiles
set role = 'admin'
where lower(email) = 'jayden.hockey111@gmail.com';

update public.profiles
set role = 'user'
where lower(email) <> 'jayden.hockey111@gmail.com'
  and role = 'admin';
```

Normal beta users may receive Founder-level product access, but they must not receive this admin role.

## How matching works

Eligibility rules are stored as JSON on each opportunity:

```json
{
  "states": ["NJ"],
  "max_age": 18,
  "student_statuses": ["high_school"],
  "interests": ["Science", "Technology"]
}
```

Location, age, and student status receive weight `2`. Income, occupation, and interests receive weight `1`. The engine divides matched weight by possible weight and rounds to a score from 0 to 100. Opportunities with no restrictions score 100. Expired opportunities are removed, and ties are ordered by nearest deadline.

The same engine powers the dashboard and emails, preventing score disagreements between features.

## Market Pulse / Live Intelligence

The old broad collector is disabled. Market Pulse is project-scoped and manual-refresh by design:

1. Project Details renders immediately from saved project/report data.
2. Market Pulse shows cached/local signals first.
3. The user clicks **Refresh Market Pulse** when they want a scan.
4. The private-alpha implementation generates deterministic local signals.
5. Results are cached in `localStorage` per project.
6. A cooldown prevents repeated spam refreshes.
7. Future server-side providers should use project-specific queries only.

Market Pulse should never call external APIs automatically on page render and should never expose provider secrets to the browser.

The daily ingest route is protected by `CRON_SECRET` and records safe Market Pulse bookkeeping only. Future external providers should live behind server-side routes, use project-scoped query templates, and respect cooldowns.

## Stripe setup — do with a parent or responsible account owner

Stripe may request legal identity, tax, banking, and business information. Do not guess or enter another person's information without them present.

1. Create/finish the Stripe account and keep **Test mode** enabled.
2. Use the Vercel URL as the business website.
3. Open **Developers → API keys** and copy the test secret key (`sk_test_...`).
4. Create a product named `PrismForge Pro`.
5. Add a recurring `$9 USD / month` price.
6. Copy the price ID (`price_...`).
7. Open **Developers → Webhooks → Add endpoint**.
8. Use this endpoint URL:

   ```text
   https://YOUR_DOMAIN/api/stripe/webhook
   ```

9. Subscribe it to:

   ```text
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   ```

10. Reveal its signing secret (`whsec_...`).
11. Save all three Stripe values locally and in Vercel Production environment variables.
12. Redeploy the production project.

Test Checkout with Stripe's test card `4242 4242 4242 4242`, any future expiration date, any three-digit CVC, and a valid test postal code. Never use a real card while Test mode is enabled.

Stripe controls plan state through signed webhooks. A successful browser redirect alone never grants Premium access.

## Resend email setup

Premium email alerts require a sending domain. Alerts are sent as capped digests through a queue so users do not receive one email per matching opportunity.

1. Create a Resend account.
2. Add a domain you own and copy the DNS records Resend provides into the domain registrar.
3. Wait until the domain is verified.
4. Create a Resend API key (`re_...`).
5. Set an address on that verified domain, for example:

   ```env
EMAIL_FROM_ADDRESS=PrismForge <alerts@example.com>
   ```

6. Add `RESEND_API_KEY` and `EMAIL_FROM` to Vercel Production.
7. Generate a long random `CRON_SECRET`, save it locally, and add it to Vercel Production as a sensitive variable.
8. Redeploy.

The daily notification cron finds Premium users and active reward-trial users with alerts enabled. It creates one capped digest per user using the highest-signal new matches and seven-day deadline reminders. The email queue worker sends queued emails in batches and retries failures with backoff. `notification_logs` prevents duplicate opportunity alerts after successful delivery.

Run this migration before relying on queue/retry logs, audit logs, account deletion logs, and the new reward chest odds in production:

```sql
supabase/migrations/20260625000004_launch_hardening.sql
```

## Vercel deployment

The folder is linked to the Vercel project `opportunityhunter/opportunity-hunter`.

Deploy the current local code with:

```powershell
npx.cmd --yes vercel@latest --prod --yes
```

Environment changes do not affect an existing build until it is redeployed. Configure Production variables in **Vercel Project → Settings → Environment Variables**, then run the command above again.

The cron schedules in `vercel.json` keep safe background work updated automatically. The ingest cron now records Market Pulse bookkeeping only; project-scoped Market Pulse refreshes are manual from Project Details so the app does not spend API calls on every page load. Premium email digests are queued every day at 13:00 UTC, and the email worker processes the queue every 15 minutes:

```json
{
  "crons": [
    { "path": "/api/cron/ingest", "schedule": "0 12 * * *" },
    { "path": "/api/cron/notifications", "schedule": "0 13 * * *" },
    { "path": "/api/cron/email-queue", "schedule": "*/15 * * * *" }
  ]
}
```

The Admin bookkeeping button is optional. New Live Intelligence should be refreshed from a specific project&apos;s Market Pulse panel.

## Verification commands

Run all of these before deploying code changes:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd audit
```

Expected matching test coverage includes a full match, a weighted partial match, and expired-opportunity filtering.

## Production checklist

- [x] Supabase schema and seed installed
- [x] Authentication callback URLs configured
- [x] First admin account enabled
- [x] Production Vercel deployment working
- [ ] Stripe test product, keys, and webhook configured
- [ ] Stripe Checkout tested end-to-end in Test mode
- [x] Resend sandbox sender and API key configured
- [x] Cron secret configured in Vercel
- [x] Email delivery tested to the account owner
- [x] Grants.gov automatic collector disabled in favor of project-scoped Market Pulse
- [ ] Custom Resend sending domain verified for emailing other users
- [ ] Custom domain connected (optional)
- [ ] Privacy policy and terms reviewed before accepting real customers
- [ ] Stripe switched to live keys only after responsible account-owner review

## Important operational notes

- Seed opportunity URLs use `example.org` and must be replaced with real application pages before launch.
- Opportunity eligibility is informational; users should always read the official program rules.
- Age, income, and student information are sensitive profile data. Keep service keys private and avoid collecting more information than matching requires.
- Database backups, monitoring, analytics, legal pages, and support processes should be added before a larger public launch.
