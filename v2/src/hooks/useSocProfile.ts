"use client";

import { usePublicQuery, type PublicQueryResult } from "@/hooks/usePublicQuery";
import { socGroup } from "@/lib/socCode";
import type { SocProfile } from "@/lib/socProfile";

/** One SOC code's profile from /api/soc/<code>; nothing is asked until the value is a whole code. */
export function useSocProfile(code: string | null | undefined): PublicQueryResult<SocProfile> {
  const soc = socGroup(code);
  return usePublicQuery<SocProfile>(soc ? `/api/soc/${soc}` : "skip");
}
