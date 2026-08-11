import { describe, expect, it } from "vitest";
import { isCreateProjectSubmitDisabled } from "./createProjectButtonState";

describe("isCreateProjectSubmitDisabled", () => {
  it("disables immediately after the first valid click to prevent duplicate submissions", () => {
    expect(isCreateProjectSubmitDisabled({ pending: false, clicked: true })).toBe(true);
  });

  it("disables only after Next reports the server action is pending", () => {
    expect(isCreateProjectSubmitDisabled({ pending: true, clicked: true })).toBe(true);
  });
});
