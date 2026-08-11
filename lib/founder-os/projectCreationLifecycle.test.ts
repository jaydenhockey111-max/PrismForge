import { describe, expect, it, vi } from "vitest";
import {
  createProjectCreationSlowTimer,
  isProjectCreationLoading,
  transitionProjectCreationLifecycle,
} from "./projectCreationLifecycle";

describe("project creation lifecycle", () => {
  it("starts loading for a normal creation and terminates when navigation is allowed to finish", () => {
    const submitting = transitionProjectCreationLifecycle("IDLE", "SUBMIT");
    expect(isProjectCreationLoading(submitting)).toBe(true);
    expect(transitionProjectCreationLifecycle(submitting, "COMPLETE")).toBe("COMPLETED");
  });

  it("terminates after a successful fallback result, which is only disclosed by the server redirect", () => {
    const slow = transitionProjectCreationLifecycle("SUBMITTING", "SLOW");
    expect(slow).toBe("SLOW");
    expect(transitionProjectCreationLifecycle(slow, "COMPLETE")).toBe("COMPLETED");
  });

  it("clears loading when a completed action has not yet unmounted the page", () => {
    expect(isProjectCreationLoading(transitionProjectCreationLifecycle("SLOW", "COMPLETE"))).toBe(false);
  });

  it("returns to a retryable state after an error and starts the next attempt cleanly", () => {
    const failed = transitionProjectCreationLifecycle("SUBMITTING", "ERROR");
    expect(failed).toBe("ERROR");
    expect(transitionProjectCreationLifecycle(failed, "SUBMIT")).toBe("SUBMITTING");
  });

  it("keeps the duplicate-click guard active only for the real pending attempt", () => {
    expect(isProjectCreationLoading(transitionProjectCreationLifecycle("SUBMITTING", "SUBMIT"))).toBe(true);
  });

  it("shows slow only while the server action remains pending and clears its timer on completion", () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    const timer = createProjectCreationSlowTimer({ onSlow, slowAfterMs: 45_000, schedule: (callback, delay) => setTimeout(callback, delay), cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) });
    timer.start();
    vi.advanceTimersByTime(45_000);
    expect(onSlow).toHaveBeenCalledOnce();
    timer.start();
    timer.complete();
    vi.advanceTimersByTime(45_000);
    expect(onSlow).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("cleans pending slow timers when the loading component unmounts", () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    const timer = createProjectCreationSlowTimer({ onSlow, slowAfterMs: 45_000, schedule: (callback, delay) => setTimeout(callback, delay), cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) });
    timer.start();
    timer.dispose();
    vi.advanceTimersByTime(45_000);
    expect(onSlow).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
