import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260717231349_rls_performance_and_rpc_hardening.sql",
  "utf8",
);

describe("RLS performance and RPC hardening", () => {
  it("moves lifecycle registration behind a non-exposed schema", () => {
    expect(migration).toContain("private.register_project_creation_lifecycle");
    expect(migration).toContain("revoke all on function public.register_project_creation_lifecycle");
    expect(migration).toContain("to service_role");
  });

  it("uses statement-level auth init plans on core policies", () => {
    expect(migration).toContain("(select auth.uid())");
    expect(migration).toContain("(select public.is_admin())");
    expect(migration).not.toMatch(/[^a-z]auth\.uid\(\)\s*(?:or|and|=)/i);
  });

  it("consolidates duplicate feature usage read policies", () => {
    expect(migration).toContain("Users and admins read permitted feature usage events");
  });
});
