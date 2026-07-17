# Tier 2C Release and Rollback

## Release order

1. Run `supabase/migrations/20260711000012_evidence_founder_progression.sql` in the Supabase SQL Editor.
2. Confirm: `Success. No rows returned.`
3. Deploy from the project root with `npx vercel --prod`.
4. Confirm the new production deployment is `Ready`.
5. Run the normal non-admin synthetic journey:
   - Sign in
   - Create Project
   - Open Project
   - Receive Next Best Action
   - Create or update a Proof Board experiment with meaningful detail
   - Open Progress and confirm the XP reason and verification label
   - Claim one eligible Daily or Weekly Quest and confirm a second click does not award XP again
6. Run an admin check at `/admin/monitoring` and confirm the evidence-based ledger loads without a missing-table warning.

## Last known-good production deployment before Tier 2C

`https://questmint-qmtkrw7lv-opportunityhunter.vercel.app`

This deployment was `Ready` when checked on July 11, 2026. Confirm it still represents the desired pre-Tier-2C version before promoting it during an incident.

## One-command application rollback

From the linked project directory:

```powershell
npx vercel rollback https://questmint-qmtkrw7lv-opportunityhunter.vercel.app
```

Dashboard alternative: Vercel → QuestMint → Deployments → open the last known-good deployment → Promote to Production.

## Database implications

Do not drop the Tier 2C tables or ledger during an application rollback. The migration is additive, preserves old totals in `legacy_xp`, and leaves existing columns available. Keeping it avoids losing XP history, reversal records, reward grants, and diagnostic flags.

The old arbitrary-XP RPC becomes a server-only no-op. Therefore, rolling the application back while leaving the migration applied is safe for core product use, but the old version will not issue its former activity-based XP. That is intentional and preferable to restoring gameable XP.

If a database defect is discovered, ship a forward corrective migration. Do not delete ledger rows or manually rewrite totals. Use append-only reversals/corrections.

## Post-rollback verification

Repeat the normal non-admin core journey and confirm authentication, Create Project, project open, Next Best Action, and Proof Board save all work. Then review Vercel runtime errors and Supabase database logs.
