/**
 * Centralized formatting utilities
 * Used for consistent number and amount formatting across the application
 */

/**
 * Parse amount value from various formats (string with $, numbers, etc.)
 * Returns 0 if invalid
 */
export function parseAmount(value: any): number {
  if (!value) return 0
  if (typeof value === 'number') return value
  const sanitized = String(value).replace(/[$,]/g, '').trim()
  const parsed = Number(sanitized)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Format amount as currency with commas, no decimals by default
 */
export function formatAmount(value: number | string | undefined, options: { showDecimals?: boolean } = {}): string {
  const amount = typeof value === 'string' ? parseAmount(value) : (value || 0)
  const formatter = new Intl.NumberFormat('en-US', { 
    maximumFractionDigits: options.showDecimals ? 2 : 0,
    minimumFractionDigits: options.showDecimals ? 2 : 0,
  })
  return formatter.format(Math.round(amount))
}

/**
 * Format amount with dollar sign
 */
export function formatCurrency(value: number | string | undefined, options: { showDecimals?: boolean } = {}): string {
  const formatted = formatAmount(value, options)
  return formatted ? `$${formatted}` : ''
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return String(value)
}

/**
 * Fuzzy match function for search filtering
 * Matches if text contains search string OR all search characters appear in order
 */
export function fuzzyMatch(text: string, search: string): boolean {
  if (!search) return true
  const searchLower = search.toLowerCase()
  const textLower = text.toLowerCase()
  
  // Direct contains
  if (textLower.includes(searchLower)) return true
  
  // Fuzzy matching - all characters appear in order
  let searchIdx = 0
  for (let i = 0; i < textLower.length && searchIdx < searchLower.length; i++) {
    if (textLower[i] === searchLower[searchIdx]) {
      searchIdx++
    }
  }
  return searchIdx === searchLower.length
}
