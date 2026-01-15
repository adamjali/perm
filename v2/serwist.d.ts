/// <reference lib="webworker" />

import type { PrecacheEntry } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope {
    /**
     * Serwist injects the precache manifest here at build time.
     * This contains the list of assets to precache.
     */
    __SW_MANIFEST: (PrecacheEntry | string)[];
  }
}

export {};
