import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useKeptWhileLoading } from "../useKeptWhileLoading";

describe("useKeptWhileLoading", () => {
  it("is undefined on the first load, so the page's own loading state shows", () => {
    const { result } = renderHook(() => useKeptWhileLoading<number[]>(undefined));
    expect(result.current).toEqual({ value: undefined, refreshing: false });
  });

  it("keeps the last answer while new arguments load, and says it's refreshing", () => {
    const first = [1, 2];
    const { result, rerender } = renderHook(({ v }: { v: number[] | undefined }) => useKeptWhileLoading(v), {
      initialProps: { v: first as number[] | undefined },
    });
    expect(result.current).toEqual({ value: first, refreshing: false });
    rerender({ v: undefined });
    expect(result.current).toEqual({ value: first, refreshing: true });
    const next = [3];
    rerender({ v: next });
    expect(result.current).toEqual({ value: next, refreshing: false });
  });

  it("keeps null, the answer for no access", () => {
    const { result, rerender } = renderHook(({ v }: { v: null | undefined }) => useKeptWhileLoading(v), {
      initialProps: { v: null as null | undefined },
    });
    rerender({ v: undefined });
    expect(result.current).toEqual({ value: null, refreshing: true });
  });
});
