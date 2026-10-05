"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Keep a form's React state in step with what its boxes actually hold.
 *
 * React's onChange ignores an input event when its value tracker already
 * knows the new value, and a browser's autofill or a phone's form script
 * (Chrome for iOS) can set the value in a way that updates the tracker first.
 * The state then keeps the old value while the box shows the new one, and a
 * button disabled until the state looks valid stays disabled: an iPhone on
 * /perm-cases, Oct 4 2026, pressed Search twenty times with a name on screen
 * and the component never saw it.
 *
 * This listens on the form itself, natively, for input, change and leaving a
 * field, and hands each named field's current value to its setter. A setter
 * given the value it already holds changes nothing, so the normal path is
 * untouched. Returns a ref callback for the `<form>`.
 */
export function useFormDomSync(setters: Record<string, (value: string) => void>) {
  // The latest setters, read at event time, so the listeners never go stale
  // and the ref callback keeps one identity across renders.
  const latest = useRef(setters);
  useEffect(() => {
    latest.current = setters;
  });
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((form: HTMLFormElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!form) return;
    const sync = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      const set = el.name ? latest.current[el.name] : undefined;
      set?.(el.value);
    };
    const kinds = ["input", "change", "focusout"] as const;
    for (const k of kinds) form.addEventListener(k, sync, true);
    cleanup.current = () => {
      for (const k of kinds) form.removeEventListener(k, sync, true);
    };
  }, []);
}
