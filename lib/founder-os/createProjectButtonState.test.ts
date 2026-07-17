import { describe, expect, it } from "vitest";
import { isCreateProjectSubmitDisabled } from "./createProjectButtonState";

describe("isCreateProjectSubmitDisabled", () => {
  it("does not disable the native submitter merely because the click feedback started", () => {
    expect(isCreateProjectSubmitDisabled({ pending: false, clicked: true })).toBe(false);
  });

  it("disables only after Next reports the server action is pending", () => {
    expect(isCreateProjectSubmitDisabled({ pending: true, clicked: true })).toBe(true);
  });
});
