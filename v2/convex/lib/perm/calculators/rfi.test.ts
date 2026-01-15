import { describe, it, expect } from 'vitest';
import { calculateRFIDueDate } from './rfi';

describe('calculateRFIDueDate', () => {
  it('should calculate 30 days from received date', () => {
    // Oct 15, 2024 + 30 days = Nov 14, 2024
    expect(calculateRFIDueDate('2024-10-15')).toBe('2024-11-14');
  });

  it('should handle month boundary transitions', () => {
    // Jan 31, 2024 + 30 days = Mar 1, 2024 (Feb has 29 days in 2024)
    expect(calculateRFIDueDate('2024-01-31')).toBe('2024-03-01');
  });

  it('should handle year boundary transitions', () => {
    // Dec 15, 2024 + 30 days = Jan 14, 2025
    expect(calculateRFIDueDate('2024-12-15')).toBe('2025-01-14');
  });

  it('should handle dates in February leap year', () => {
    // Feb 15, 2024 + 30 days = Mar 16, 2024
    expect(calculateRFIDueDate('2024-02-15')).toBe('2024-03-16');
  });

  it('should handle dates in February non-leap year', () => {
    // Feb 15, 2025 + 30 days = Mar 17, 2025
    expect(calculateRFIDueDate('2025-02-15')).toBe('2025-03-17');
  });

  it('should handle end of month dates', () => {
    // Mar 31, 2024 + 30 days = Apr 30, 2024
    expect(calculateRFIDueDate('2024-03-31')).toBe('2024-04-30');
  });

  it('should handle dates that span short months', () => {
    // Jan 30, 2024 + 30 days = Feb 29, 2024
    expect(calculateRFIDueDate('2024-01-30')).toBe('2024-02-29');
  });

  it('should handle dates at year end', () => {
    // Dec 31, 2024 + 30 days = Jan 30, 2025
    expect(calculateRFIDueDate('2024-12-31')).toBe('2025-01-30');
  });
});
