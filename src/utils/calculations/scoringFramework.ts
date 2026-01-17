/**
 * MCA Underwriting Scorecard - Complete Scoring Framework
 *
 * 4 Main Sections (25% each):
 * 1. Revenue Quality - Analyzes income stability, growth, and reliability
 * 2. Expense Quality - Analyzes expense control, burden, and patterns
 * 3. Existing Debt Impact - Analyzes MCA positions, stacking, and debt burden
 * 4. Cashflow & Charges - Analyzes NSF/OD events, balance health, liquidity
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SubsectionScore {
  name: string
  score: number        // 1-100
  rating: number       // 1-5
  weight: number       // Weight within section (decimal, e.g., 0.20 for 20%)
  metrics: MetricValue[]
  redFlags?: RedFlagDetail[]
}

export interface MetricValue {
  name: string
  value: number | string
  formattedValue: string
  weight: number
  interpretation?: string
}

export interface RedFlagDetail {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  pointsDeducted: number
  date?: Date
}

export interface SectionScore {
  name: string
  score: number        // 1-100
  rating: number       // 1-5
  weight: number       // Weight in overall (0.25 for 25%)
  subsections: SubsectionScore[]
}

export interface OverallScorecard {
  overallScore: number     // 1-100
  overallRating: number    // 1-5
  recommendation: Recommendation
  sections: {
    revenueQuality: SectionScore
    expenseQuality: SectionScore
    existingDebtImpact: SectionScore
    cashflowCharges: SectionScore
  }
  generatedAt: Date
  periodStart: Date
  periodEnd: Date
  monthsAnalyzed: number
}

export type Recommendation =
  | 'APPROVE'
  | 'APPROVE_WITH_CONDITIONS'
  | 'MANUAL_REVIEW'
  | 'DECLINE_SOFT'
  | 'DECLINE'

// ============================================================================
// RED FLAG PATTERNS
// ============================================================================

export const EXPENSE_RED_FLAG_PATTERNS = {
  GAMBLING: [/casino/i, /draftkings/i, /fanduel/i, /bet365/i, /pokerstars/i, /betmgm/i, /bovada/i],
  CASH_ADVANCE: [/cash\s*advance/i, /payday/i, /check\s*into\s*cash/i, /check\s*cashing/i],
  COLLECTION: [/collection\s*agency/i, /debt\s*collector/i, /portfolio\s*recovery/i, /midland\s*credit/i],
  CRYPTO: [/coinbase/i, /binance/i, /crypto/i, /bitcoin/i, /kraken/i, /gemini/i],
  LUXURY: [/louis\s*vuitton/i, /gucci/i, /rolex/i, /neiman\s*marcus/i, /saks\s*fifth/i, /nordstrom/i],
}

export const REVENUE_RED_FLAG_PATTERNS = {
  SUSPICIOUS_DEPOSITS: [/cash\s*deposit.*\d{4,}/i], // Large round cash deposits
  STRUCTURING: [/deposit.*\$9[0-9]{2,3}/i], // Deposits just under $10K
}

// ============================================================================
// FIXED EXPENSE CATEGORIES (for Fixed vs Variable calculation)
// ============================================================================

export const FIXED_EXPENSE_CATEGORIES = new Set([
  'rent',
  'lease',
  'insurance',
  'loan_payment',
  'software_subscriptions',
  'utilities',
  'payroll',
  'recurring',
])

// ============================================================================
// SCORING UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert a 1-100 score to a 1-5 rating
 */
export function scoreToRating(score: number): number {
  if (score >= 80) return 5
  if (score >= 65) return 4
  if (score >= 50) return 3
  if (score >= 35) return 2
  return 1
}

/**
 * Generate recommendation based on overall score
 */
export function generateRecommendation(score: number): Recommendation {
  if (score >= 75) return 'APPROVE'
  if (score >= 60) return 'APPROVE_WITH_CONDITIONS'
  if (score >= 45) return 'MANUAL_REVIEW'
  if (score >= 30) return 'DECLINE_SOFT'
  return 'DECLINE'
}

/**
 * Get rating label
 */
export function getRatingLabel(rating: number): string {
  switch (rating) {
    case 5: return 'Excellent'
    case 4: return 'Good'
    case 3: return 'Fair'
    case 2: return 'Poor'
    case 1: return 'Critical'
    default: return 'Unknown'
  }
}

/**
 * Get recommendation label and color
 */
export function getRecommendationDetails(rec: Recommendation): { label: string; color: string; description: string } {
  switch (rec) {
    case 'APPROVE':
      return { label: 'Approve', color: 'green', description: 'Strong candidate for funding' }
    case 'APPROVE_WITH_CONDITIONS':
      return { label: 'Approve with Conditions', color: 'blue', description: 'Approvable with additional terms' }
    case 'MANUAL_REVIEW':
      return { label: 'Manual Review', color: 'yellow', description: 'Requires underwriter review' }
    case 'DECLINE_SOFT':
      return { label: 'Soft Decline', color: 'orange', description: 'Not recommended, may reconsider' }
    case 'DECLINE':
      return { label: 'Decline', color: 'red', description: 'Do not fund' }
  }
}

/**
 * Calculate coefficient of variation
 */
export function calculateCV(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  return (stdDev / mean) * 100  // Return as percentage
}

/**
 * Calculate trend direction (first half vs second half)
 */
export function calculateTrendDirection(values: number[]): 'STRONGLY_IMPROVING' | 'IMPROVING' | 'STABLE' | 'WORSENING' | 'STRONGLY_WORSENING' {
  if (values.length < 2) return 'STABLE'

  const midpoint = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, midpoint)
  const secondHalf = values.slice(midpoint)

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  if (firstAvg === 0) return secondAvg > 0 ? 'WORSENING' : 'STABLE'

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100

  if (changePercent <= -50) return 'STRONGLY_IMPROVING'  // For NSF, decreasing is good
  if (changePercent <= -20) return 'IMPROVING'
  if (changePercent <= 20) return 'STABLE'
  if (changePercent <= 50) return 'WORSENING'
  return 'STRONGLY_WORSENING'
}

/**
 * Linear interpolation for score within a range
 */
export function interpolateScore(value: number, ranges: Array<{ min: number; max: number; scoreMin: number; scoreMax: number }>): number {
  for (const range of ranges) {
    if (value >= range.min && value <= range.max) {
      // Linear interpolation within the range
      const ratio = (value - range.min) / (range.max - range.min)
      return range.scoreMax - ratio * (range.scoreMax - range.scoreMin)
    }
  }
  // Return boundary score if outside all ranges
  if (value < ranges[0].min) return ranges[0].scoreMax
  return ranges[ranges.length - 1].scoreMin
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Count business days between two dates
 */
export function countBusinessDays(start: Date, end: Date): number {
  let count = 0
  const current = new Date(start)

  while (current <= end) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
