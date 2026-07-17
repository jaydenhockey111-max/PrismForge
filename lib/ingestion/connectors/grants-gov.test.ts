import { describe, expect, it } from "vitest";
import { cleanText, inferInterests, normalizeGrant, parseSourceDate, type GrantsDetail } from "./grants-gov";

describe("Grants.gov connector", () => {
  it("removes source HTML and decodes entities", () => {
    expect(cleanText("Research &amp; training<br><b>program</b>")).toBe("Research & training\nprogram");
  });

  it("normalizes U.S. source dates", () => {
    expect(parseSourceDate("08/19/2026")).toBe("2026-08-19");
  });

  it("maps explicit subject language to profile interests", () => {
    expect(inferInterests("Scientific research in climate technology")).toEqual(["Environment", "Research", "Science", "Technology"]);
  });

  it("normalizes a source record without inventing demographic rules", () => {
    const grant = normalizeGrant({
      id: 123,
      opportunityTitle: "STEM Research Grant",
      owningAgencyCode: "NSF",
      synopsis: {
        synopsisDesc: "<p>Support for scientific student research projects.</p>",
        responseDateStr: "08/19/2099",
        applicantEligibilityDesc: "Individuals may apply.",
        agencyName: "National Science Foundation",
      },
    } satisfies GrantsDetail);
    expect(grant.sourceId).toBe("123");
    expect(grant.status).toBe("published");
    expect(grant.eligibilityRules).toEqual({ interests: ["Education", "Research", "Science"] });
    expect(grant.eligibilitySummary).toBe("Individuals may apply.");
  });
});
