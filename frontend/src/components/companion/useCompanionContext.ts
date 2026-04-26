import { useEffect } from "react";
import { useCompanionStore } from "../../store/companionSlice";
import type { CompanionContext } from "../../api/companion";

/**
 * Reports the active screen + relevant entity to the global Companion store
 * for the lifetime of the calling component, then clears it on unmount so
 * stale context never leaks across navigations.
 *
 * Re-runs whenever the input changes (callers should memoize or pass
 * stable scalars to avoid loops).
 */
export function useReportCompanionContext(ctx: CompanionContext) {
  const setContext = useCompanionStore((s) => s.setContext);
  const clearContext = useCompanionStore((s) => s.clearContext);

  useEffect(() => {
    setContext(ctx);
    return () => clearContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ctx)]);
}
