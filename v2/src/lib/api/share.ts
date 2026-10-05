/**
 * A share of decided cases for an answer a program reads, to three decimals.
 *
 * Plain rounding turns 2,999 of 3,000 into 1.0, which any reader takes as
 * "never denied". So a share only reaches 1 when nothing was denied, and only
 * 0 when nothing was certified; the counts travel beside it either way.
 */
export function certifiedShare(certified: number, denied: number, minDecided = 1): number | null {
  const decided = certified + denied;
  if (decided < Math.max(1, minDecided)) return null;
  const share = Math.round((certified / decided) * 1000) / 1000;
  if (share === 1 && denied > 0) return 0.999;
  if (share === 0 && certified > 0) return 0.001;
  return share;
}
