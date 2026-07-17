import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260717230826_database_integrity_hardening.sql",
  "utf8",
);
const generationAction = readFileSync("app/(app)/generate/actions.ts", "utf8");

describe("database integrity hardening", () => {
  it("keeps project creation, history, lifecycle, and focus in one transaction", () => {
    expect(migration).toContain("insert into public.opportunity_projects");
    expect(migration).toContain("insert into public.generation_history");
    expect(migration).toContain("perform public.register_project_creation_lifecycle");
    expect(generationAction).not.toContain("registerCreatedProjectLifecycle");
    expect(generationAction).not.toContain('from("opportunity_projects")\n    .insert');
  });

  it("enforces canonical project ownership and same-project validation links", () => {
    expect(migration).toContain("create or replace function public.enforce_project_owner()");
    expect(migration).toContain("create or replace function public.enforce_validation_links()");
    expect(migration).toContain("Target assumption must belong to the same project and user.");
    expect(migration).toContain("Decision experiment must belong to the same project and user.");
  });

  it("does not expose private founder tables or the creation RPC to anon", () => {
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("from anon;");
    expect(migration).toContain("to authenticated;");
  });
});
