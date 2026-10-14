"use client";

import { useEffect, useRef } from "react";

import { trackEstimateShown } from "@/lib/funnelEvents";

/**
 * Sends `estimate_shown` once, when a server-drawn estimate reaches the page.
 * It renders nothing; the estimate itself is the server's markup.
 */
export function EstimateShown({
  model,
  dated,
  source,
}: {
  /** The model that dated the case, or "none" when the page withheld a date. */
  model: string;
  dated: boolean;
  source: string;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEstimateShown(model, dated, source);
  }, [model, dated, source]);
  return null;
}
