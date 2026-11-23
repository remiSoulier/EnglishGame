import { useEffect, useRef } from 'react';

/** Marker of the history entry pushed while an in-app back is available. */
const MARK = 'bgcBack';

const isOurs = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && (value as Record<string, unknown>)[MARK] === true;

/**
 * Maps the browser / Android back button to the in-app back, using the History API minimally
 * (same URL, no router):
 *
 * - while `canBack` is true, exactly one extra history entry (marked) sits on top of the app's
 *   entry; the system back pops it and `onBack` runs;
 * - when `canBack` turns false through the app itself (a button), that extra entry is removed
 *   with `history.back()` (its popstate is ignored), so the next system back leaves the app as
 *   usual. The user is never trapped: without an in-app back, nothing is pushed.
 */
export function useSystemBack(canBack: boolean, onBack: () => void): void {
  const canBackRef = useRef(canBack);
  const onBackRef = useRef(onBack);
  /** Until when a `history.back()` of ours is on its way (its popstate is then ignored). */
  const skipPop = useRef(0);

  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    canBackRef.current = canBack;
    sync(canBackRef.current, skipPop);
  }, [canBack]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (pending(skipPop)) {
        skipPop.current = 0;
      } else if (!isOurs(event.state) && canBackRef.current) {
        // Our entry was popped by the system back button.
        onBackRef.current();
        // Once React has re-rendered: re-push our entry if a back is still available.
        window.setTimeout(() => sync(canBackRef.current, skipPop), 0);
        return;
      }
      sync(canBackRef.current, skipPop);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}

/** How long to wait for the popstate of our own `history.back()` before giving up on it. */
const SKIP_MS = 1000;

const pending = (skipPop: { current: number }): boolean => Date.now() < skipPop.current;

/** Pushes our entry when a back is available, removes it when not. Idempotent. */
function sync(canBack: boolean, skipPop: { current: number }): void {
  if (pending(skipPop)) return; // Wait for the pending history.back() to land.
  try {
    const ours = isOurs(window.history.state);
    if (canBack && !ours) {
      window.history.pushState({ [MARK]: true }, '');
    } else if (!canBack && ours) {
      skipPop.current = Date.now() + SKIP_MS;
      window.history.back();
    }
  } catch {
    // History API unavailable: the in-app Back buttons still work.
  }
}
