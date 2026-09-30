"use client";

import { createContext, createElement, Suspense, useContext, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/**
 * useSearchParams for the public data tools, with a way to render them with
 * NO parameters in a Suspense fallback.
 *
 * On a prerendered page `useSearchParams()` bails the nearest Suspense boundary
 * out to client rendering, so the prerendered HTML holds only the fallback.
 * Seven tools shipped a one-line "Loading…" there, and the whole tool, often
 * several hundred pixels tall, appeared after hydration and pushed everything
 * below it down. The fix is to make the fallback the tool itself, rendered
 * the way it looks with an empty query string:
 *
 *     <Suspense fallback={<WithoutSearchParams><Tool {...p} /></WithoutSearchParams>}>
 *       <Tool {...p} />
 *     </Suspense>
 *
 * Inside WithoutSearchParams this hook returns empty parameters and never
 * calls useSearchParams, so nothing bails out and the server renders the full
 * default tool. On the client React renders the real one in its place. With
 * no parameters in the URL, which is almost every visit, the two are the same
 * markup and nothing moves. With parameters, the view changes once, the way
 * any filter change does.
 */
const EMPTY = new URLSearchParams();
const Frozen = createContext<URLSearchParams | null>(null);

export function WithoutSearchParams({ children }: { children: ReactNode }) {
  return createElement(Frozen.Provider, { value: EMPTY }, children);
}

export function useUrlSearchParams(): URLSearchParams {
  const frozen = useContext(Frozen);
  // A conditional hook, deliberately and safely: whether an instance sits
  // under WithoutSearchParams never changes for the life of that instance, so
  // each instance calls the same hooks in the same order on every render.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return frozen ?? useSearchParams();
}

/**
 * The boundary those tools need, with the tool itself as its fallback. Takes
 * the tool once; renders it twice (fallback without parameters, content with).
 */
export function SearchParamsBoundary({ children }: { children: ReactNode }) {
  return createElement(
    Suspense,
    { fallback: createElement(WithoutSearchParams, null, children) },
    children,
  );
}
