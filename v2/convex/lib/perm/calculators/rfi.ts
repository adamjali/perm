import { addDays, parseISO, format } from 'date-fns';
import { RFI_DUE_DAYS } from '../constants';

/**
 * Calculate RFI (Request for Information) due date
 *
 * Per V2_VALIDATION_RULES.md V-RFI-02, RFI response is due 30 calendar days
 * from the received date. This is a STRICT deadline and is not user-editable.
 *
 * @param receivedDate - Date RFI was received (YYYY-MM-DD)
 * @returns RFI due date (YYYY-MM-DD)
 *
 * @example
 * calculateRFIDueDate('2024-10-15') // '2024-11-14'
 * calculateRFIDueDate('2024-12-15') // '2025-01-14'
 */
export function calculateRFIDueDate(receivedDate: string): string {
  const received = parseISO(receivedDate);
  const dueDate = addDays(received, RFI_DUE_DAYS);
  return format(dueDate, 'yyyy-MM-dd');
}
