"use client";

import { RouteError } from "@/components/error/RouteError";

export default function CasesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} title="Cases Error" />;
}
