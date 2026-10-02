import type { ReactNode } from "react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { getFunctionName, type FunctionReference } from "convex/server";

import fixtures from "./tour-fixtures.json";

/**
 * A Convex client for Storybook that answers every query from
 * tour-fixtures.json: results recorded from the real queries over a sample
 * firm's cases (convex/__tests__/tourFixtures.test.ts). Mutations and actions
 * do nothing. A query with no recording stays loading and is logged, so a
 * picture can't quietly show a page that never received its data.
 */

const DATA = fixtures as Record<string, unknown>;

function resultFor(name: string, args: unknown): unknown {
  const exact = DATA[`${name} ${JSON.stringify(args ?? {})}`];
  if (exact !== undefined) return exact;
  const byName = Object.keys(DATA).find((k) => k.startsWith(`${name} `));
  if (byName) return DATA[byName];
  console.warn(`[tour] no recording for ${name}`, args);
  return undefined;
}

const CONNECTED = {
  hasInflightRequests: false,
  isWebSocketConnected: true,
  timeOfOldestInflightRequest: null,
  hasEverConnected: true,
  connectionCount: 1,
  connectionRetries: 0,
  inflightMutations: 0,
  inflightActions: 0,
};

const fakeClient = {
  watchQuery: (query: FunctionReference<"query">, args?: unknown) => {
    const name = getFunctionName(query);
    return {
      onUpdate: () => () => {},
      localQueryResult: () => resultFor(name, args),
      localQueryLogs: () => undefined,
      journal: () => undefined,
    };
  },
  mutation: async () => null,
  action: async () => null,
  prewarmQuery: () => {},
  connectionState: () => CONNECTED,
  subscribeToConnectionState: () => () => {},
  setAuth: () => {},
  clearAuth: () => {},
} as unknown as ConvexReactClient;

/** The case ids in the order the sample firm's cases were created. */
export const TOUR_CASE_IDS = DATA["tour:caseIds"] as string[];

/** The day the recording was made; the pictures pin their clock to it. */
export const TOUR_TODAY = DATA["tour:today"] as string;

export function TourConvex({ children }: { children: ReactNode }) {
  return <ConvexProvider client={fakeClient}>{children}</ConvexProvider>;
}
