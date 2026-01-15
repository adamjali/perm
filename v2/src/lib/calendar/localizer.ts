/**
 * react-big-calendar localizer configuration using date-fns
 *
 * Uses specific imports for tree-shaking optimization.
 * Configured for en-US locale.
 */

import { dateFnsLocalizer } from 'react-big-calendar'
import { format } from 'date-fns/format'
import { getDay } from 'date-fns/getDay'
import { startOfWeek } from 'date-fns/startOfWeek'
import { enUS } from 'date-fns/locale/en-US'

const locales = {
  'en-US': enUS,
}

/**
 * Configured date-fns localizer for react-big-calendar
 *
 * Usage:
 * ```tsx
 * import { localizer } from '@/lib/calendar/localizer'
 * import { Calendar } from 'react-big-calendar'
 *
 * <Calendar localizer={localizer} ... />
 * ```
 */
export const localizer = dateFnsLocalizer({
  format,
  getDay,
  startOfWeek,
  locales,
})

export { locales }
