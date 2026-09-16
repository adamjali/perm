/** "2026-09-11" to "Sep 11, 2026". Shared by the strip, the rows and the page. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function dayLabel(iso: string): string {
  const m = MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7);
  return `${m} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
}

export function monthYear(iso: string): string {
  const m = MONTHS[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7);
  return `${m} ${iso.slice(0, 4)}`;
}
