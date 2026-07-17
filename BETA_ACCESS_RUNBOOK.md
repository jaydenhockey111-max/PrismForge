# PrismForge Beta Access Runbook

This is the private-beta access system.

## Access rules

PrismForge now determines a user's effective plan in this order:

1. `profiles.lifetime_founder = true` -> Founder access forever.
2. `profiles.beta_feedback_completed = true` -> Founder access forever.
3. `profiles.beta_access_until > now()` -> temporary Founder beta access.
4. `profiles.plan = 'premium'` -> Pro access.
5. Otherwise -> Free.

Founder access does not mean admin access. Admin access is still controlled separately by `profiles.role = 'admin'` and the admin-email guard.

## During beta

The migration `20260706000011_beta_founder_access.sql` gives current and new beta users a temporary one-week Founder window through `beta_access_until`.

OpenAI is still protected by:

- monthly feature limits;
- global beta monthly limits;
- per-feature cooldowns;
- cached saved project outputs;
- no automatic AI calls on page load.

## Google Form requirement

Your Google Form should include this required field:

```text
What email did you use for PrismForge?
```

This email is how you match a Google Form response to `profiles.email`.

## Grant lifetime Founder to form completers

1. Export Google Form responses to Google Sheets.
2. Copy the PrismForge account emails.
3. Open `supabase/beta-feedback-lifetime-founder-template.sql`.
4. Replace `tester@example.com` with the completed-feedback emails.
5. Run the SQL in Supabase SQL Editor.

## End beta for non-feedback testers

After granting lifetime Founder to completers, run:

```text
supabase/end-beta-revert-non-feedback-testers.sql
```

That expires temporary beta access for everyone else and removes the default one-week Founder window for new signups.

## Important cost note

Lifetime Founder means feature access, not unlimited OpenAI spend. Keep fair-use limits and cooldowns active.
