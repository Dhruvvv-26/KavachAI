import { formatDistanceToNow } from 'date-fns'

/**
 * Safely format a date distance to now.
 * Prevents RangeError: Invalid time value when date is invalid or missing.
 */
export function safeFormatDistance(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  
  try {
    const d = new Date(dateStr)
    // Check if date is valid
    if (isNaN(d.getTime())) return '—'
    
    return formatDistanceToNow(d, { addSuffix: true })
  } catch (e) {
    console.error('Error formatting date:', e, dateStr)
    return '—'
  }
}
