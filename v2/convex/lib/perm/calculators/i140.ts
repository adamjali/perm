import { addDays, parseISO, format } from 'date-fns';
import { I140_FILING_DAYS } from '../constants';

/**
 * Calculate I-140 filing deadline
 *
 * The certification's last valid day: certification + 179 days, the date
 * DOL prints (20 CFR 656.30(b)(1), "180 calendar days" counting the
 * certification day as day 1). The I-140 must be filed on or before it.
 *
 * @param eta9089CertificationDate - ETA 9089 certification date (YYYY-MM-DD)
 * @returns I-140 filing deadline (YYYY-MM-DD)
 *
 * @example
 * calculateI140FilingDeadline('2024-10-01') // '2025-03-29'
 * calculateI140FilingDeadline('2024-07-15') // '2025-01-10'
 */
export function calculateI140FilingDeadline(eta9089CertificationDate: string): string {
  const certDate = parseISO(eta9089CertificationDate);
  const deadline = addDays(certDate, I140_FILING_DAYS);
  return format(deadline, 'yyyy-MM-dd');
}
