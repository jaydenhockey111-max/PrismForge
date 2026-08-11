export type ProjectCreationLifecycleState = "IDLE" | "SUBMITTING" | "SLOW" | "COMPLETED" | "ERROR";

export type ProjectCreationLifecycleEvent = "SUBMIT" | "SLOW" | "COMPLETE" | "ERROR" | "RESET";

export function transitionProjectCreationLifecycle(
  state: ProjectCreationLifecycleState,
  event: ProjectCreationLifecycleEvent,
): ProjectCreationLifecycleState {
  if (event === "SUBMIT") return "SUBMITTING";
  if (event === "SLOW") return state === "SUBMITTING" ? "SLOW" : state;
  if (event === "COMPLETE") return state === "SUBMITTING" || state === "SLOW" ? "COMPLETED" : state;
  if (event === "ERROR") return "ERROR";
  return "IDLE";
}

export function isProjectCreationLoading(state: ProjectCreationLifecycleState) {
  return state === "SUBMITTING" || state === "SLOW";
}

type SlowTimerOptions = {
  onSlow: () => void;
  slowAfterMs: number;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (handle: unknown) => void;
};

export function createProjectCreationSlowTimer({
  onSlow,
  slowAfterMs,
  schedule = (callback, delay) => window.setTimeout(callback, delay),
  cancel = (handle) => window.clearTimeout(handle as number),
}: SlowTimerOptions) {
  let handle: unknown = null;

  function clear() {
    if (handle === null) return;
    cancel(handle);
    handle = null;
  }

  return {
    start() {
      clear();
      handle = schedule(() => {
        handle = null;
        onSlow();
      }, slowAfterMs);
    },
    complete: clear,
    dispose: clear,
  };
}
