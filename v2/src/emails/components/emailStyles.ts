/**
 * Shared email styles for PERM Tracker templates.
 * Eliminates duplication across email components.
 *
 * Phase: Code simplification
 */

import type { CSSProperties } from 'react';

/**
 * Common label style (used in detail sections).
 */
export const labelStyle: CSSProperties = {
  color: '#71717a',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 4px 0',
};

/**
 * Common value style (used in detail sections).
 */
export const valueStyle: CSSProperties = {
  color: '#18181b',
  fontSize: '16px',
  fontWeight: 500,
  margin: '0 0 16px 0',
};

/**
 * Common highlighted value style (used for emphasis).
 */
export const valueHighlightStyle: CSSProperties = {
  color: '#18181b',
  fontSize: '18px',
  fontWeight: 700,
  margin: '0 0 8px 0',
};

/**
 * Common details section container.
 */
export const detailsSectionStyle: CSSProperties = {
  marginBottom: '24px',
};

/**
 * Common CTA section style.
 */
export const ctaSectionStyle: CSSProperties = {
  textAlign: 'center',
  marginTop: '24px',
  marginBottom: '24px',
};

/**
 * Urgency color mapping (matching v1 thresholds).
 */
export const urgencyColors = {
  normal: '#2563EB',   // Blue - 15+ days
  high: '#F97316',     // Orange - 8-14 days
  urgent: '#DC2626',   // Red - 1-7 days
  overdue: '#991B1B',  // Dark red - <=0 days
} as const;

/**
 * Get urgency level based on days remaining.
 */
export function getUrgencyLevel(days: number): 'normal' | 'high' | 'urgent' | 'overdue' {
  if (days <= 0) return 'overdue';
  if (days <= 7) return 'urgent';
  if (days <= 14) return 'high';
  return 'normal';
}

/**
 * Get urgency color for days remaining.
 */
export function getUrgencyColor(days: number): string {
  return urgencyColors[getUrgencyLevel(days)];
}

/**
 * Format days remaining text with proper handling of overdue, today, tomorrow.
 */
export function formatDaysRemaining(days: number): string {
  if (days < 0) {
    const absDays = Math.abs(days);
    return `${absDays} day${absDays !== 1 ? 's' : ''} overdue`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} day${days !== 1 ? 's' : ''} remaining`;
}

/**
 * Format date from ISO string to human-readable format.
 */
export function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Get urgency icon emoji.
 */
export function getUrgencyIcon(urgency: 'normal' | 'high' | 'urgent' | 'overdue'): string {
  const icons = {
    overdue: '🚨',
    urgent: '⚠️',
    high: '⏰',
    normal: '📅',
  };
  return icons[urgency];
}
