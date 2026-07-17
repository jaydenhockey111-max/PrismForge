import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("permanent project-creation release safeguards", () => {
  const analytics = readFileSync("lib/analytics/betaEvents.ts","utf8");
  const createAction = readFileSync("app/(app)/generate/actions.ts","utf8");
  const createPage = readFileSync("app/(app)/generate/page.tsx","utf8");
  const client = readFileSync("components/founder-os/generate-form-persistence.tsx","utf8");
  const projectPage = readFileSync("app/(app)/projects/[id]/page.tsx","utf8");
  const proofActions = readFileSync("app/(app)/projects/proof-actions.ts","utf8");

  it("preserves every structured creation funnel event", () => {
    for (const event of ["project_creation_page_opened","project_creation_started","project_creation_request_sent","project_creation_request_received","project_generation_completed","project_database_save_completed","project_workspace_loaded","next_best_action_loaded","first_evidence_saved","project_creation_completed"]) expect(analytics).toContain(event);
    expect(createPage).toContain("project_creation_page_opened"); expect(client).toContain("project_creation_request_sent"); expect(createAction).toContain("project_creation_request_received"); expect(createAction).toContain("project_database_save_completed"); expect(projectPage).toContain("project_workspace_loaded"); expect(proofActions).toContain("first_evidence_saved");
  });

  it("keeps atomic project creation and registers the created project as focus", () => {
    expect(createAction).toContain("create_founder_project_atomic"); expect(createAction).toContain("register_project_creation_lifecycle"); expect(createAction).toContain("requestId");
  });
});
