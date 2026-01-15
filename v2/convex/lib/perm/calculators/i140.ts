import { addDays, parseISO, format } from 'date-fns';
import { I140_FILING_DAYS } from '../constants';

/**
 * Calculate I-140 filing deadline
 *
 * Per PERM regulations, I-140 must be filed within 180 calendar days
 * of ETA 9089 certification date.
 *
 * @param eta9089CertificationDate - ETA 9089 certification date (YYYY-MM-DD)
 * @returns I-140 filing deadline (YYYY-MM-DD)
 *
 * @example
 * calculateI140FilingDeadline('2024-10-01') // '2025-03-30'
 * calculateI140FilingDeadline('2024-07-15') // '2025-01-11'
 */
export function calculateI140FilingDeadline(eta9089CertificationDate: string): string {
  const certDate = parseISO(eta9089CertificationDate);
  const deadline = addDays(certDate, I140_FILING_DAYS);
  return format(deadline, 'yyyy-MM-dd');
}
