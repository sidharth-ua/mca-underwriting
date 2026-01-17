/**
 * Revenue Quality Scoring Module
 *
 * Based on PDF specifications for MCA underwriting.
 *
 * 5 Subsections:
 * 1. Revenue Stability Score (RevStabScore)
 * 2. Revenue Durability Score (RevDurScore)
 * 3. Revenue Trend & Momentum Score (RevTrendMomScore)
 * 4. Revenue Concentration Score (RevConcScore)
 * 5. Revenue Sufficiency Score (RevSuffScore)
 *
 * All calculations use:
 * - 3 calendar months of data
 * - Non-overlapping 7-day windows for weekly calculations
 * - Exponentially Weighted Average (EWA) favoring recency
 */

import {
  SubsectionScore,
  SectionScore,
  MetricValue,
  scoreToRating,
  clamp,
  formatCurrency,
  formatPercent,
  formatNumber,
} from './scoringFramework'
import type { Transaction, MonthlyMetrics, RevenueBreakdown } from './metricsCalculator'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RevenueData {
  transactions: Transaction[]
  monthlyData: MonthlyMetrics[]
  totalRevenue: number
  avgMonthlyRevenue: number
  revenueBreakdown: RevenueBreakdown
  monthsAnalyzed: number
  mcaFundingReceived: number
}

interface TransactionFlags {
  isCoreRevenue: boolean
  isNonOperating: boolean
  isMcaOrLoan: boolean
  isInternalTransfer: boolean
  sourceName: string
  isMcaRepayment: boolean
}

interface WeeklyRevenue {
  weekStart: Date
  weekEnd: Date
  revenue: number
  transactionCount: number
}

interface MonthlySourceData {
  month: string
  sources: Map<string, number>
  totalCoreRevenue: number
  totalDeposits: number
  nonOperatingDeposits: number
  mcaDeposits: number
  internalTransfers: number
  mcaRepayments: number
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Exponentially Weighted Average favoring recency
 * For 3 values [M3, M2, M1], weights are [0.2, 0.3, 0.5] (most recent gets highest)
 */
function calculateEWA(values: number[]): number {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]
  if (values.length === 2) {
    return values[0] * 0.4 + values[1] * 0.6
  }
  // For 3 values: oldest=0.2, middle=0.3, newest=0.5
  return values[0] * 0.2 + values[1] * 0.3 + values[2] * 0.5
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Calculate mean
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Calculate median
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Calculate coefficient of variation (CV = stdDev / mean)
 */
function coefficientOfVariation(values: number[]): number {
  const m = mean(values)
  if (m === 0) return 0
  return stdDev(values) / m
}

/**
 * Calculate Pearson correlation coefficient
 */
function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0

  const n = x.length
  const meanX = mean(x)
  const meanY = mean(y)

  let numerator = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denom = Math.sqrt(denomX * denomY)
  if (denom === 0) return 0
  return numerator / denom
}

/**
 * Calculate quartiles (Q25, Q50, Q75)
 */
function quartiles(values: number[]): { q25: number; q50: number; q75: number } {
  if (values.length === 0) return { q25: 0, q50: 0, q75: 0 }
  const sorted = [...values].sort((a, b) => a - b)

  const q50 = median(sorted)
  const lowerHalf = sorted.slice(0, Math.floor(sorted.length / 2))
  const upperHalf = sorted.slice(Math.ceil(sorted.length / 2))

  return {
    q25: median(lowerHalf),
    q50,
    q75: median(upperHalf)
  }
}

/**
 * Calculate IQR (Interquartile Range)
 */
function iqr(values: number[]): number {
  const q = quartiles(values)
  return q.q75 - q.q25
}

/**
 * Calculate MAD (Median Absolute Deviation)
 */
function mad(values: number[]): number {
  if (values.length === 0) return 0
  const med = median(values)
  const absDeviations = values.map(v => Math.abs(v - med))
  return median(absDeviations)
}

/**
 * Get month key from date (YYYY-MM format)
 */
function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get date key (YYYY-MM-DD format)
 */
function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr)
}

/**
 * Get transaction flags based on description patterns
 */
function getTransactionFlags(transaction: Transaction): TransactionFlags {
  const desc = transaction.description.toLowerCase()

  // MCA/Loan patterns
  const mcaPatterns = [
    /ebf\s*holdings/i, /everest\s*business/i, /lendingpoint/i, /fundbox/i,
    /bluevine/i, /ondeck/i, /kabbage/i, /can\s*capital/i, /rapid\s*finance/i,
    /credibly/i, /fora\s*financial/i, /pearl\s*capital/i, /forward\s*financing/i,
    /clearco/i, /pipe\s/i, /capify/i, /libertas/i, /bizfi/i, /yellowstone/i,
    /national\s*funding/i, /payability/i, /behalf/i, /fundkite/i, /merchant\s*cash/i,
    /mca\s*(fund|loan|advance)/i, /business\s*advance/i, /sba\s*loan/i
  ]

  // Non-operating patterns (refunds, transfers, loans, etc.)
  const nonOperatingPatterns = [
    /refund/i, /return(?!ed\s*item)/i, /reversal/i, /loan\s*proceed/i,
    /line\s*of\s*credit/i, /interest\s*(paid|earned)/i, /dividend/i,
    /insurance\s*claim/i, /legal\s*settlement/i, /asset\s*sale/i
  ]

  // Internal transfer patterns
  const internalPatterns = [
    /transfer\s*(from|to)\s*(checking|savings|account)/i,
    /internal\s*transfer/i, /self\s*transfer/i, /between\s*accounts/i,
    /move\s*funds/i, /sweep/i
  ]

  // Core revenue patterns (payment processors, sales, etc.)
  const coreRevenuePatterns = [
    /square/i, /stripe/i, /paypal\s*(deposit|transfer|settlement)/i,
    /clover/i, /toast\s*deposit/i, /shopify/i, /merchant\s*services/i,
    /card\s*settlement/i, /visa\s*settlement/i, /mastercard\s*settlement/i,
    /amex\s*settlement/i, /ach\s*(credit|deposit)/i, /wire\s*(credit|transfer|in)/i,
    /check\s*deposit/i, /cash\s*deposit/i, /customer\s*payment/i, /invoice/i,
    /sales/i, /revenue/i, /payment\s*received/i
  ]

  const isMcaOrLoan = mcaPatterns.some(p => p.test(desc))
  const isNonOperating = nonOperatingPatterns.some(p => p.test(desc)) || isMcaOrLoan
  const isInternalTransfer = internalPatterns.some(p => p.test(desc))

  // Core revenue = credit transactions that are not non-operating, internal transfers, or MCA
  const isCoreRevenue = transaction.type === 'CREDIT' &&
    !isNonOperating && !isInternalTransfer &&
    (coreRevenuePatterns.some(p => p.test(desc)) ||
     !nonOperatingPatterns.some(p => p.test(desc)))

  // MCA repayment detection (debit transactions to MCA lenders)
  const isMcaRepayment = transaction.type === 'DEBIT' && mcaPatterns.some(p => p.test(desc))

  // Extract source name for concentration analysis
  let sourceName = 'Unknown'
  if (desc.includes('square')) sourceName = 'Square'
  else if (desc.includes('stripe')) sourceName = 'Stripe'
  else if (desc.includes('paypal')) sourceName = 'PayPal'
  else if (desc.includes('shopify')) sourceName = 'Shopify'
  else if (desc.includes('clover')) sourceName = 'Clover'
  else if (desc.includes('toast')) sourceName = 'Toast'
  else if (desc.includes('ach')) sourceName = 'ACH Deposit'
  else if (desc.includes('wire')) sourceName = 'Wire Transfer'
  else if (desc.includes('check')) sourceName = 'Check Deposit'
  else if (desc.includes('cash')) sourceName = 'Cash Deposit'
  else if (desc.includes('zelle')) sourceName = 'Zelle'
  else if (desc.includes('venmo')) sourceName = 'Venmo'
  else {
    // Try to extract company name from first 2-3 words
    const words = desc.split(/\s+/).slice(0, 3).join(' ')
    if (words.length > 3) sourceName = words.substring(0, 30)
  }

  return {
    isCoreRevenue,
    isNonOperating,
    isMcaOrLoan,
    isInternalTransfer,
    sourceName,
    isMcaRepayment
  }
}

/**
 * Aggregate transactions into non-overlapping 7-day windows
 */
function aggregateIntoWeeklyWindows(transactions: Transaction[]): WeeklyRevenue[] {
  if (transactions.length === 0) return []

  // Sort by date
  const sorted = [...transactions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Find date range
  const startDate = new Date(sorted[0].date)
  const endDate = new Date(sorted[sorted.length - 1].date)

  // Create weekly windows
  const weeks: WeeklyRevenue[] = []
  let currentWeekStart = new Date(startDate)
  currentWeekStart.setHours(0, 0, 0, 0)

  while (currentWeekStart <= endDate) {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // Sum core revenue in this week
    let revenue = 0
    let count = 0
    for (const t of sorted) {
      const tDate = new Date(t.date)
      if (tDate >= currentWeekStart && tDate <= weekEnd) {
        const flags = getTransactionFlags(t)
        if (flags.isCoreRevenue && t.amount > 0) {
          revenue += t.amount
          count++
        }
      }
    }

    weeks.push({
      weekStart: new Date(currentWeekStart),
      weekEnd: new Date(weekEnd),
      revenue,
      transactionCount: count
    })

    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7)
  }

  return weeks
}

/**
 * Group transactions by month and calculate source data
 */
function groupByMonth(transactions: Transaction[]): MonthlySourceData[] {
  const monthMap = new Map<string, MonthlySourceData>()

  for (const t of transactions) {
    const date = new Date(t.date)
    const monthKey = getMonthKey(date)

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        sources: new Map(),
        totalCoreRevenue: 0,
        totalDeposits: 0,
        nonOperatingDeposits: 0,
        mcaDeposits: 0,
        internalTransfers: 0,
        mcaRepayments: 0
      })
    }

    const monthData = monthMap.get(monthKey)!
    const flags = getTransactionFlags(t)

    if (t.type === 'CREDIT' && t.amount > 0) {
      monthData.totalDeposits += t.amount

      if (flags.isCoreRevenue) {
        monthData.totalCoreRevenue += t.amount
        const currentSourceTotal = monthData.sources.get(flags.sourceName) || 0
        monthData.sources.set(flags.sourceName, currentSourceTotal + t.amount)
      }

      if (flags.isNonOperating) {
        monthData.nonOperatingDeposits += t.amount
      }

      if (flags.isMcaOrLoan) {
        monthData.mcaDeposits += t.amount
      }

      if (flags.isInternalTransfer) {
        monthData.internalTransfers += t.amount
      }
    }

    if (flags.isMcaRepayment) {
      monthData.mcaRepayments += Math.abs(t.amount)
    }
  }

  // Sort by month and return as array
  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month))
}

// ============================================================================
// 1. REVENUE STABILITY SCORE (RevStabScore)
// Weight: 20% of overall Revenue Quality
// 10 metrics
// ============================================================================

function calculateRevenueStabilityScore(data: RevenueData): SubsectionScore {
  const weeks = aggregateIntoWeeklyWindows(data.transactions)
  const weeklyRevenues = weeks.map(w => w.revenue).filter(r => r > 0)
  const monthlyData = groupByMonth(data.transactions)
  const monthlyRevenues = monthlyData.map(m => m.totalCoreRevenue)

  const metrics: MetricValue[] = []
  let totalWeightedScore = 0

  // a. Weekly Log-Volatility (σ) - 15%
  const logRevenues = weeklyRevenues.filter(r => r > 0).map(r => Math.log(r))
  const weeklyLogVol = stdDev(logRevenues)
  let logVolScore: number
  if (weeklyLogVol <= 0.08) logVolScore = 100
  else if (weeklyLogVol <= 0.15) logVolScore = 85
  else if (weeklyLogVol <= 0.25) logVolScore = 65
  else if (weeklyLogVol <= 0.40) logVolScore = 40
  else logVolScore = 15
  totalWeightedScore += logVolScore * 0.15
  metrics.push({
    name: 'Weekly Log-Volatility (σ)',
    value: weeklyLogVol,
    formattedValue: weeklyLogVol.toFixed(3),
    weight: 0.15,
    interpretation: weeklyLogVol <= 0.15 ? 'Low volatility' : 'High volatility'
  })

  // b. Monthly Volatility Ratio (Max/Min) - 10%
  const validMonthlyRevs = monthlyRevenues.filter(r => r > 0)
  const monthlyVolRatio = validMonthlyRevs.length >= 2
    ? Math.max(...validMonthlyRevs) / Math.min(...validMonthlyRevs)
    : 1
  let monthlyVolScore: number
  if (monthlyVolRatio <= 1.25) monthlyVolScore = 100
  else if (monthlyVolRatio <= 1.60) monthlyVolScore = 80
  else if (monthlyVolRatio <= 2.20) monthlyVolScore = 55
  else if (monthlyVolRatio <= 3.00) monthlyVolScore = 30
  else monthlyVolScore = 10
  totalWeightedScore += monthlyVolScore * 0.10
  metrics.push({
    name: 'Monthly Volatility Ratio',
    value: monthlyVolRatio,
    formattedValue: `${monthlyVolRatio.toFixed(2)}x`,
    weight: 0.10,
    interpretation: monthlyVolRatio <= 1.60 ? 'Stable' : 'Variable'
  })

  // c. Weekly IQR to Median Revenue - 10%
  const weeklyIQR = iqr(weeklyRevenues)
  const weeklyMedian = median(weeklyRevenues)
  const iqrToMedian = weeklyMedian > 0 ? weeklyIQR / weeklyMedian : 0
  let iqrScore: number
  if (iqrToMedian <= 0.20) iqrScore = 100
  else if (iqrToMedian <= 0.35) iqrScore = 80
  else if (iqrToMedian <= 0.55) iqrScore = 55
  else if (iqrToMedian <= 0.80) iqrScore = 30
  else iqrScore = 10
  totalWeightedScore += iqrScore * 0.10
  metrics.push({
    name: 'Weekly IQR/Median',
    value: iqrToMedian,
    formattedValue: formatPercent(iqrToMedian),
    weight: 0.10
  })

  // d. Weekly MAD to Median Revenue - 10%
  const weeklyMAD = mad(weeklyRevenues)
  const madToMedian = weeklyMedian > 0 ? weeklyMAD / weeklyMedian : 0
  let madScore: number
  if (madToMedian <= 0.15) madScore = 100
  else if (madToMedian <= 0.30) madScore = 80
  else if (madToMedian <= 0.50) madScore = 55
  else if (madToMedian <= 0.75) madScore = 30
  else madScore = 10
  totalWeightedScore += madScore * 0.10
  metrics.push({
    name: 'Weekly MAD/Median',
    value: madToMedian,
    formattedValue: formatPercent(madToMedian),
    weight: 0.10
  })

  // e. Week-over-Week Persistence (correlation) - 15%
  const logWeeklyRevs = weeklyRevenues.filter(r => r > 0).map(r => Math.log(r))
  let weekPersistence = 0
  if (logWeeklyRevs.length >= 3) {
    const x = logWeeklyRevs.slice(0, -1)
    const y = logWeeklyRevs.slice(1)
    weekPersistence = correlation(x, y)
  }
  let persistenceScore: number
  if (weekPersistence >= 0.85) persistenceScore = 100
  else if (weekPersistence >= 0.70) persistenceScore = 85
  else if (weekPersistence >= 0.50) persistenceScore = 65
  else if (weekPersistence >= 0.25) persistenceScore = 40
  else persistenceScore = 15
  totalWeightedScore += persistenceScore * 0.15
  metrics.push({
    name: 'Week-over-Week Persistence',
    value: weekPersistence,
    formattedValue: weekPersistence.toFixed(2),
    weight: 0.15,
    interpretation: weekPersistence >= 0.70 ? 'Predictable' : 'Unpredictable'
  })

  // f. Weekly Sign-Change Frequency - 10%
  let signChanges = 0
  for (let i = 2; i < weeklyRevenues.length; i++) {
    const delta1 = weeklyRevenues[i - 1] - weeklyRevenues[i - 2]
    const delta2 = weeklyRevenues[i] - weeklyRevenues[i - 1]
    if (delta1 * delta2 < 0) signChanges++
  }
  const signChangeRate = weeklyRevenues.length > 2
    ? signChanges / (weeklyRevenues.length - 2)
    : 0
  let signChangeScore: number
  if (signChangeRate <= 0.15) signChangeScore = 100
  else if (signChangeRate <= 0.30) signChangeScore = 80
  else if (signChangeRate <= 0.45) signChangeScore = 55
  else if (signChangeRate <= 0.65) signChangeScore = 30
  else signChangeScore = 10
  totalWeightedScore += signChangeScore * 0.10
  metrics.push({
    name: 'Sign-Change Frequency',
    value: signChangeRate,
    formattedValue: formatPercent(signChangeRate),
    weight: 0.10
  })

  // g. Weekly CV - 10%
  const weeklyCV = coefficientOfVariation(weeklyRevenues)
  let weeklyCVScore: number
  if (weeklyCV <= 0.30) weeklyCVScore = 100
  else if (weeklyCV <= 0.50) weeklyCVScore = 80
  else if (weeklyCV <= 0.75) weeklyCVScore = 55
  else if (weeklyCV <= 1.00) weeklyCVScore = 30
  else weeklyCVScore = 10
  totalWeightedScore += weeklyCVScore * 0.10
  metrics.push({
    name: 'Weekly CV',
    value: weeklyCV,
    formattedValue: weeklyCV.toFixed(2),
    weight: 0.10
  })

  // h. Monthly Revenue Gap Index (EWA) - 10%
  const monthlyGapIndices: number[] = []
  for (const month of monthlyData) {
    const monthTransactions = data.transactions.filter(t => {
      const tMonth = getMonthKey(new Date(t.date))
      return tMonth === month.month && getTransactionFlags(t).isCoreRevenue
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (monthTransactions.length >= 2) {
      const gaps: number[] = []
      for (let i = 1; i < monthTransactions.length; i++) {
        const gap = (new Date(monthTransactions[i].date).getTime() -
                    new Date(monthTransactions[i-1].date).getTime()) / (1000 * 60 * 60 * 24)
        gaps.push(gap)
      }
      const maxGap = Math.max(...gaps)
      const medianGap = median(gaps)
      const gapIndex = medianGap > 0 ? maxGap / medianGap : maxGap
      monthlyGapIndices.push(gapIndex)
    }
  }
  const gapIndexEWA = monthlyGapIndices.length > 0 ? calculateEWA(monthlyGapIndices) : 2
  let gapIndexScore: number
  if (gapIndexEWA <= 2.0) gapIndexScore = 100
  else if (gapIndexEWA <= 3.0) gapIndexScore = 80
  else if (gapIndexEWA <= 4.5) gapIndexScore = 55
  else if (gapIndexEWA <= 6.0) gapIndexScore = 30
  else gapIndexScore = 10
  totalWeightedScore += gapIndexScore * 0.10
  metrics.push({
    name: 'Revenue Gap Index (EWA)',
    value: gapIndexEWA,
    formattedValue: gapIndexEWA.toFixed(2),
    weight: 0.10
  })

  // i. Spike Ratio (EWA) - 7%
  const monthlySpikeRatios: number[] = []
  for (const month of monthlyData) {
    const monthTransactions = data.transactions.filter(t => {
      const tMonth = getMonthKey(new Date(t.date))
      return tMonth === month.month && getTransactionFlags(t).isCoreRevenue && t.amount > 0
    })

    if (monthTransactions.length >= 10) {
      // Group by day
      const dailyRevenue = new Map<string, number>()
      for (const t of monthTransactions) {
        const dayKey = getDateKey(new Date(t.date))
        dailyRevenue.set(dayKey, (dailyRevenue.get(dayKey) || 0) + t.amount)
      }

      const dailyValues = Array.from(dailyRevenue.values()).sort((a, b) => b - a)
      const top10Pct = Math.ceil(dailyValues.length * 0.10)
      const top10Revenue = dailyValues.slice(0, top10Pct).reduce((a, b) => a + b, 0)
      const totalRevenue = dailyValues.reduce((a, b) => a + b, 0)

      if (totalRevenue > 0) {
        monthlySpikeRatios.push(top10Revenue / totalRevenue)
      }
    }
  }
  const spikeRatioEWA = monthlySpikeRatios.length > 0 ? calculateEWA(monthlySpikeRatios) : 0.3
  let spikeScore: number
  if (spikeRatioEWA <= 0.20) spikeScore = 100
  else if (spikeRatioEWA <= 0.30) spikeScore = 80
  else if (spikeRatioEWA <= 0.45) spikeScore = 55
  else if (spikeRatioEWA <= 0.60) spikeScore = 30
  else spikeScore = 10
  totalWeightedScore += spikeScore * 0.07
  metrics.push({
    name: 'Spike Ratio (EWA)',
    value: spikeRatioEWA,
    formattedValue: formatPercent(spikeRatioEWA),
    weight: 0.07
  })

  // j. Rolling 30-Day Revenue Variance - 3%
  const dailyRevenues: number[] = []
  const revenueByDay = new Map<string, number>()
  for (const t of data.transactions) {
    if (getTransactionFlags(t).isCoreRevenue && t.amount > 0) {
      const dayKey = getDateKey(new Date(t.date))
      revenueByDay.set(dayKey, (revenueByDay.get(dayKey) || 0) + t.amount)
    }
  }

  // Get sorted daily revenues
  const sortedDays = Array.from(revenueByDay.keys()).sort()
  for (const day of sortedDays) {
    dailyRevenues.push(revenueByDay.get(day) || 0)
  }

  // Calculate rolling 30-day variance
  const rolling30Variances: number[] = []
  for (let i = 29; i < dailyRevenues.length; i++) {
    const window = dailyRevenues.slice(i - 29, i + 1)
    const windowMean = mean(window)
    const windowVar = window.reduce((sum, v) => sum + Math.pow(v - windowMean, 2), 0) / window.length
    rolling30Variances.push(windowVar)
  }

  const avgRollingVar = mean(rolling30Variances)
  const medianDaily = median(dailyRevenues)
  const normalizedVar = medianDaily > 0 ? avgRollingVar / Math.pow(medianDaily, 2) : 0

  let rolling30Score: number
  if (normalizedVar <= 0.05) rolling30Score = 100
  else if (normalizedVar <= 0.15) rolling30Score = 75
  else if (normalizedVar <= 0.30) rolling30Score = 50
  else if (normalizedVar <= 0.60) rolling30Score = 25
  else rolling30Score = 5
  totalWeightedScore += rolling30Score * 0.03
  metrics.push({
    name: 'Rolling 30-Day Variance',
    value: normalizedVar,
    formattedValue: normalizedVar.toFixed(3),
    weight: 0.03
  })

  const finalScore = Math.round(clamp(totalWeightedScore, 1, 100))

  return {
    name: 'Revenue Stability',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.20,
    metrics
  }
}

// ============================================================================
// 2. REVENUE DURABILITY SCORE (RevDurScore)
// Weight: 15% of overall Revenue Quality
// 9 metrics
// ============================================================================

function calculateRevenueDurabilityScore(data: RevenueData): SubsectionScore {
  const monthlyData = groupByMonth(data.transactions)
  const metrics: MetricValue[] = []
  let totalWeightedScore = 0

  // a. % Non-Operating Deposits (EWA) - 10%
  const nonOpRatios = monthlyData.map(m =>
    m.totalDeposits > 0 ? m.nonOperatingDeposits / m.totalDeposits : 0
  )
  const nonOpEWA = calculateEWA(nonOpRatios)
  let nonOpScore: number
  if (nonOpEWA <= 0.05) nonOpScore = 100
  else if (nonOpEWA <= 0.10) nonOpScore = 80
  else if (nonOpEWA <= 0.20) nonOpScore = 55
  else if (nonOpEWA <= 0.35) nonOpScore = 30
  else nonOpScore = 10
  totalWeightedScore += nonOpScore * 0.10
  metrics.push({
    name: '% Non-Operating Deposits',
    value: nonOpEWA,
    formattedValue: formatPercent(nonOpEWA),
    weight: 0.10,
    interpretation: nonOpEWA <= 0.10 ? 'Low reliance' : 'High reliance'
  })

  // b. % MCA Deposits (EWA) - 15%
  const mcaRatios = monthlyData.map(m =>
    m.totalDeposits > 0 ? m.mcaDeposits / m.totalDeposits : 0
  )
  const mcaEWA = calculateEWA(mcaRatios)
  let mcaDepScore: number
  if (mcaEWA === 0) mcaDepScore = 100
  else if (mcaEWA <= 0.05) mcaDepScore = 85
  else if (mcaEWA <= 0.15) mcaDepScore = 55
  else if (mcaEWA <= 0.30) mcaDepScore = 30
  else mcaDepScore = 5
  totalWeightedScore += mcaDepScore * 0.15
  metrics.push({
    name: '% MCA Deposits',
    value: mcaEWA,
    formattedValue: formatPercent(mcaEWA),
    weight: 0.15,
    interpretation: mcaEWA === 0 ? 'No MCA dependency' : 'MCA dependent'
  })

  // c. Self-Transfer Detection Ratio (EWA) - 5%
  const transferRatios = monthlyData.map(m =>
    m.totalDeposits > 0 ? m.internalTransfers / m.totalDeposits : 0
  )
  const transferEWA = calculateEWA(transferRatios)
  let transferScore: number
  if (transferEWA <= 0.02) transferScore = 100
  else if (transferEWA <= 0.05) transferScore = 80
  else if (transferEWA <= 0.10) transferScore = 55
  else if (transferEWA <= 0.20) transferScore = 25
  else transferScore = 5
  totalWeightedScore += transferScore * 0.05
  metrics.push({
    name: 'Self-Transfer Ratio',
    value: transferEWA,
    formattedValue: formatPercent(transferEWA),
    weight: 0.05
  })

  // d. Core Revenue Replacement Ratio (EWA) - 15%
  const replacementRatios: number[] = []
  for (let i = 1; i < monthlyData.length; i++) {
    const deltaMCA = monthlyData[i].mcaDeposits - monthlyData[i-1].mcaDeposits
    const deltaCoreRev = monthlyData[i].totalCoreRevenue - monthlyData[i-1].totalCoreRevenue
    // Ratio = delta(MCA) / -delta(CoreRevenue)
    if (deltaCoreRev < 0) {
      replacementRatios.push(deltaMCA / (-deltaCoreRev))
    } else if (deltaCoreRev > 0 && deltaMCA < 0) {
      replacementRatios.push(-1) // Healthy: MCA decreasing while revenue increasing
    } else {
      replacementRatios.push(0)
    }
  }
  const replacementEWA = replacementRatios.length > 0 ? calculateEWA(replacementRatios) : 0
  let replacementScore: number
  if (replacementEWA < 0) replacementScore = 100
  else if (replacementEWA <= 0.5) replacementScore = 80
  else if (replacementEWA <= 1.0) replacementScore = 50
  else if (replacementEWA <= 2.0) replacementScore = 20
  else replacementScore = 5
  totalWeightedScore += replacementScore * 0.15
  metrics.push({
    name: 'Core Revenue Replacement',
    value: replacementEWA,
    formattedValue: replacementEWA.toFixed(2),
    weight: 0.15,
    interpretation: replacementEWA < 0 ? 'Healthy' : 'Revenue decay'
  })

  // e. Repeat-Source Revenue Ratio (EWA) - 15%
  // Find sources that appear in >= 2 months
  const sourceAppearances = new Map<string, number>()
  for (const month of monthlyData) {
    for (const [source] of month.sources) {
      sourceAppearances.set(source, (sourceAppearances.get(source) || 0) + 1)
    }
  }
  const recurringSources = new Set(
    Array.from(sourceAppearances.entries())
      .filter(([, count]) => count >= 2)
      .map(([source]) => source)
  )

  const repeatSourceRatios = monthlyData.map(m => {
    if (m.totalCoreRevenue === 0) return 0
    let recurringRevenue = 0
    for (const [source, amount] of m.sources) {
      if (recurringSources.has(source)) {
        recurringRevenue += amount
      }
    }
    return recurringRevenue / m.totalCoreRevenue
  })
  const repeatSourceEWA = calculateEWA(repeatSourceRatios)
  let repeatScore: number
  if (repeatSourceEWA >= 0.85) repeatScore = 100
  else if (repeatSourceEWA >= 0.70) repeatScore = 80
  else if (repeatSourceEWA >= 0.50) repeatScore = 55
  else if (repeatSourceEWA >= 0.30) repeatScore = 30
  else repeatScore = 10
  totalWeightedScore += repeatScore * 0.15
  metrics.push({
    name: 'Repeat-Source Revenue',
    value: repeatSourceEWA,
    formattedValue: formatPercent(repeatSourceEWA),
    weight: 0.15,
    interpretation: repeatSourceEWA >= 0.70 ? 'Recurring' : 'Non-recurring'
  })

  // f. Source Survival Rate (EWA) - 10%
  const survivalRates: number[] = []
  for (let i = 1; i < monthlyData.length; i++) {
    const prevSources = new Set(monthlyData[i-1].sources.keys())
    const currSources = new Set(monthlyData[i].sources.keys())
    if (prevSources.size === 0) continue
    const survivingSources = Array.from(prevSources).filter(s => currSources.has(s)).length
    survivalRates.push(survivingSources / prevSources.size)
  }
  const survivalEWA = survivalRates.length > 0 ? calculateEWA(survivalRates) : 0.5
  let survivalScore: number
  if (survivalEWA >= 0.85) survivalScore = 100
  else if (survivalEWA >= 0.70) survivalScore = 80
  else if (survivalEWA >= 0.50) survivalScore = 55
  else if (survivalEWA >= 0.30) survivalScore = 30
  else survivalScore = 10
  totalWeightedScore += survivalScore * 0.10
  metrics.push({
    name: 'Source Survival Rate',
    value: survivalEWA,
    formattedValue: formatPercent(survivalEWA),
    weight: 0.10
  })

  // g. New-Source Dependence Ratio (EWA) - 10%
  const allPriorSources = new Set<string>()
  const newSourceRatios: number[] = []
  for (let i = 0; i < monthlyData.length; i++) {
    if (i > 0 && monthlyData[i].totalCoreRevenue > 0) {
      let newSourceRevenue = 0
      for (const [source, amount] of monthlyData[i].sources) {
        if (!allPriorSources.has(source)) {
          newSourceRevenue += amount
        }
      }
      newSourceRatios.push(newSourceRevenue / monthlyData[i].totalCoreRevenue)
    }
    // Add current month sources to prior set
    for (const source of monthlyData[i].sources.keys()) {
      allPriorSources.add(source)
    }
  }
  const newSourceEWA = newSourceRatios.length > 0 ? calculateEWA(newSourceRatios) : 0.5
  let newSourceScore: number
  if (newSourceEWA <= 0.10) newSourceScore = 100
  else if (newSourceEWA <= 0.25) newSourceScore = 80
  else if (newSourceEWA <= 0.45) newSourceScore = 55
  else if (newSourceEWA <= 0.65) newSourceScore = 30
  else newSourceScore = 10
  totalWeightedScore += newSourceScore * 0.10
  metrics.push({
    name: 'New-Source Dependence',
    value: newSourceEWA,
    formattedValue: formatPercent(newSourceEWA),
    weight: 0.10
  })

  // h. Core Revenue Retention Rate (EWA) - 10%
  const retentionRates: number[] = []
  for (let i = 1; i < monthlyData.length; i++) {
    const prevSources = monthlyData[i-1].sources
    const currSources = monthlyData[i].sources

    // Revenue from same sources in prior month
    let priorSameSourceRev = 0
    let currSameSourceRev = 0
    for (const [source, prevAmount] of prevSources) {
      if (currSources.has(source)) {
        priorSameSourceRev += prevAmount
        currSameSourceRev += currSources.get(source) || 0
      }
    }

    if (priorSameSourceRev > 0) {
      retentionRates.push(currSameSourceRev / priorSameSourceRev)
    }
  }
  const retentionEWA = retentionRates.length > 0 ? calculateEWA(retentionRates) : 0.8
  let retentionScore: number
  if (retentionEWA >= 0.95) retentionScore = 100
  else if (retentionEWA >= 0.85) retentionScore = 80
  else if (retentionEWA >= 0.70) retentionScore = 55
  else if (retentionEWA >= 0.50) retentionScore = 30
  else retentionScore = 10
  totalWeightedScore += retentionScore * 0.10
  metrics.push({
    name: 'Revenue Retention Rate',
    value: retentionEWA,
    formattedValue: formatPercent(retentionEWA),
    weight: 0.10
  })

  // i. Month-to-Month Core Revenue Carryover (EWA) - 10%
  const carryoverRates: number[] = []
  for (let i = 1; i < monthlyData.length; i++) {
    const prevSources = monthlyData[i-1].sources
    const currSources = monthlyData[i].sources

    // Revenue from sources active in both months
    let bothMonthsRevenue = 0
    let priorMonthSameSourceRev = 0
    for (const [source, prevAmount] of prevSources) {
      if (currSources.has(source)) {
        bothMonthsRevenue += currSources.get(source) || 0
        priorMonthSameSourceRev += prevAmount
      }
    }

    if (priorMonthSameSourceRev > 0) {
      carryoverRates.push(bothMonthsRevenue / priorMonthSameSourceRev)
    }
  }
  const carryoverEWA = carryoverRates.length > 0 ? calculateEWA(carryoverRates) : 0.8
  let carryoverScore: number
  if (carryoverEWA >= 0.90) carryoverScore = 100
  else if (carryoverEWA >= 0.75) carryoverScore = 80
  else if (carryoverEWA >= 0.55) carryoverScore = 55
  else if (carryoverEWA >= 0.35) carryoverScore = 30
  else carryoverScore = 10
  totalWeightedScore += carryoverScore * 0.10
  metrics.push({
    name: 'Revenue Carryover',
    value: carryoverEWA,
    formattedValue: formatPercent(carryoverEWA),
    weight: 0.10
  })

  const finalScore = Math.round(clamp(totalWeightedScore, 1, 100))

  return {
    name: 'Revenue Durability',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics
  }
}

// ============================================================================
// 3. REVENUE TREND & MOMENTUM SCORE (RevTrendMomScore)
// Weight: 15% of overall Revenue Quality
// 4 metrics
// ============================================================================

function calculateRevenueTrendScore(data: RevenueData): SubsectionScore {
  const monthlyData = groupByMonth(data.transactions)
  const monthlyRevenues = monthlyData.map(m => m.totalCoreRevenue)

  const metrics: MetricValue[] = []
  let totalWeightedScore = 0

  // Ensure we have at least 3 months
  while (monthlyRevenues.length < 3) {
    monthlyRevenues.unshift(monthlyRevenues[0] || 0)
  }

  // M3 = oldest, M2 = middle, M1 = newest (most recent)
  const M3 = monthlyRevenues[monthlyRevenues.length - 3]
  const M2 = monthlyRevenues[monthlyRevenues.length - 2]
  const M1 = monthlyRevenues[monthlyRevenues.length - 1]

  // a. Weighted Slope of Log Core-Revenue (EWA) - 35%
  const logSlope1 = M3 > 0 && M2 > 0 ? Math.log(M2) - Math.log(M3) : 0
  const logSlope2 = M2 > 0 && M1 > 0 ? Math.log(M1) - Math.log(M2) : 0
  const weightedLogSlope = calculateEWA([logSlope1, logSlope2])

  let slopeScore: number
  if (weightedLogSlope >= 0.08) slopeScore = 100
  else if (weightedLogSlope >= 0.03) slopeScore = 85
  else if (weightedLogSlope >= -0.03) slopeScore = 60
  else if (weightedLogSlope >= -0.08) slopeScore = 30
  else slopeScore = 10
  totalWeightedScore += slopeScore * 0.35
  metrics.push({
    name: 'Weighted Log Slope',
    value: weightedLogSlope,
    formattedValue: formatPercent(weightedLogSlope),
    weight: 0.35,
    interpretation: weightedLogSlope >= 0.03 ? 'Growing' : weightedLogSlope <= -0.03 ? 'Declining' : 'Stable'
  })

  // b. Core-Revenue Growth Consistency Ratio - 20%
  let growthMonths = 0
  if (M2 > M3) growthMonths++
  if (M1 > M2) growthMonths++
  const consistencyRatio = growthMonths / 2

  let consistencyScore: number
  if (consistencyRatio === 1.0) consistencyScore = 100
  else if (consistencyRatio === 0.5) consistencyScore = 60
  else consistencyScore = 20
  totalWeightedScore += consistencyScore * 0.20
  metrics.push({
    name: 'Growth Consistency',
    value: consistencyRatio,
    formattedValue: `${growthMonths}/2 months`,
    weight: 0.20
  })

  // c. Downside Momentum Severity - 30%
  const delta1 = M2 - M3
  const delta2 = M1 - M2
  const negativeSum = (delta1 < 0 ? Math.abs(delta1) : 0) + (delta2 < 0 ? Math.abs(delta2) : 0)
  const totalMovement = Math.abs(delta1) + Math.abs(delta2)
  const downsideSeverity = totalMovement > 0 ? negativeSum / totalMovement : 0

  let downsideScore: number
  if (downsideSeverity === 0) downsideScore = 100
  else if (downsideSeverity <= 0.30) downsideScore = 80
  else if (downsideSeverity <= 0.55) downsideScore = 55
  else if (downsideSeverity <= 0.80) downsideScore = 30
  else downsideScore = 10
  totalWeightedScore += downsideScore * 0.30
  metrics.push({
    name: 'Downside Severity',
    value: downsideSeverity,
    formattedValue: formatPercent(downsideSeverity),
    weight: 0.30,
    interpretation: downsideSeverity <= 0.30 ? 'Low risk' : 'High downside'
  })

  // d. Direction Index - 15%
  const sign = (x: number) => x > 0 ? 1 : x < 0 ? -1 : 0
  const directionIndex = sign(M1 - M2) + sign(M2 - M3)

  let directionScore: number
  if (directionIndex === 2) directionScore = 100
  else if (directionIndex === 1) directionScore = 75
  else if (directionIndex === 0) directionScore = 50
  else if (directionIndex === -1) directionScore = 25
  else directionScore = 5
  totalWeightedScore += directionScore * 0.15
  metrics.push({
    name: 'Direction Index',
    value: directionIndex,
    formattedValue: directionIndex >= 0 ? `+${directionIndex}` : `${directionIndex}`,
    weight: 0.15
  })

  const finalScore = Math.round(clamp(totalWeightedScore, 1, 100))

  return {
    name: 'Revenue Trend & Momentum',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics
  }
}

// ============================================================================
// 4. REVENUE CONCENTRATION SCORE (RevConcScore)
// Weight: 15% of overall Revenue Quality
// 4 metrics
// ============================================================================

function calculateRevenueConcentrationScore(data: RevenueData): SubsectionScore {
  const monthlyData = groupByMonth(data.transactions)
  const metrics: MetricValue[] = []
  let totalWeightedScore = 0

  // a. Top Core-Revenue Source Share (EWA) - 25%
  const topSourceShares = monthlyData.map(m => {
    if (m.totalCoreRevenue === 0 || m.sources.size === 0) return 0
    const maxSourceRevenue = Math.max(...Array.from(m.sources.values()))
    return maxSourceRevenue / m.totalCoreRevenue
  })
  const topShareEWA = calculateEWA(topSourceShares)

  let topShareScore: number
  if (topShareEWA <= 0.15) topShareScore = 100
  else if (topShareEWA <= 0.25) topShareScore = 85
  else if (topShareEWA <= 0.40) topShareScore = 60
  else if (topShareEWA <= 0.60) topShareScore = 30
  else topShareScore = 10
  totalWeightedScore += topShareScore * 0.25
  metrics.push({
    name: 'Top Source Share',
    value: topShareEWA,
    formattedValue: formatPercent(topShareEWA),
    weight: 0.25,
    interpretation: topShareEWA <= 0.25 ? 'Diversified' : 'Concentrated'
  })

  // b. Core-Revenue HHI (EWA) - 25%
  const monthlyHHIs = monthlyData.map(m => {
    if (m.totalCoreRevenue === 0) return 1
    let hhi = 0
    for (const amount of m.sources.values()) {
      const share = amount / m.totalCoreRevenue
      hhi += share * share
    }
    return hhi
  })
  const hhiEWA = calculateEWA(monthlyHHIs)

  let hhiScore: number
  if (hhiEWA <= 0.10) hhiScore = 100
  else if (hhiEWA <= 0.18) hhiScore = 80
  else if (hhiEWA <= 0.30) hhiScore = 55
  else if (hhiEWA <= 0.45) hhiScore = 30
  else hhiScore = 10
  totalWeightedScore += hhiScore * 0.25
  metrics.push({
    name: 'Revenue HHI',
    value: hhiEWA,
    formattedValue: hhiEWA.toFixed(3),
    weight: 0.25
  })

  // c. Core-Revenue Concentration Index (EWA) - 25%
  // max(monthly revenue) / total revenue
  const totalCoreRevenue = monthlyData.reduce((sum, m) => sum + m.totalCoreRevenue, 0)
  const concentrationIndices = monthlyData.map(m =>
    totalCoreRevenue > 0 ? m.totalCoreRevenue / totalCoreRevenue : 0
  )
  const maxMonthShare = Math.max(...concentrationIndices)

  let concIndexScore: number
  if (maxMonthShare <= 0.40) concIndexScore = 100
  else if (maxMonthShare <= 0.55) concIndexScore = 80
  else if (maxMonthShare <= 0.70) concIndexScore = 50
  else if (maxMonthShare <= 0.85) concIndexScore = 25
  else concIndexScore = 5
  totalWeightedScore += concIndexScore * 0.25
  metrics.push({
    name: 'Temporal Concentration',
    value: maxMonthShare,
    formattedValue: formatPercent(maxMonthShare),
    weight: 0.25,
    interpretation: maxMonthShare <= 0.55 ? 'Even' : 'Lumpy'
  })

  // d. Source Churn Concentration (EWA) - 25%
  // Sources that appear in only one month
  const sourceAppearances = new Map<string, number>()
  for (const month of monthlyData) {
    for (const source of month.sources.keys()) {
      sourceAppearances.set(source, (sourceAppearances.get(source) || 0) + 1)
    }
  }
  const oneTimeOnlySources = new Set(
    Array.from(sourceAppearances.entries())
      .filter(([, count]) => count === 1)
      .map(([source]) => source)
  )

  const churnConcentrations = monthlyData.map(m => {
    if (m.totalCoreRevenue === 0) return 0
    let oneTimeRevenue = 0
    for (const [source, amount] of m.sources) {
      if (oneTimeOnlySources.has(source)) {
        oneTimeRevenue += amount
      }
    }
    return oneTimeRevenue / m.totalCoreRevenue
  })
  const churnEWA = calculateEWA(churnConcentrations)

  let churnScore: number
  if (churnEWA <= 0.10) churnScore = 100
  else if (churnEWA <= 0.20) churnScore = 80
  else if (churnEWA <= 0.35) churnScore = 55
  else if (churnEWA <= 0.55) churnScore = 30
  else churnScore = 10
  totalWeightedScore += churnScore * 0.25
  metrics.push({
    name: 'Source Churn',
    value: churnEWA,
    formattedValue: formatPercent(churnEWA),
    weight: 0.25
  })

  const finalScore = Math.round(clamp(totalWeightedScore, 1, 100))

  return {
    name: 'Revenue Concentration',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics
  }
}

// ============================================================================
// 5. REVENUE SUFFICIENCY SCORE (RevSuffScore)
// Weight: 35% of overall Revenue Quality
// 7 metrics
// ============================================================================

function calculateRevenueSufficiencyScore(data: RevenueData, totalExpenses: number, mcaPayments: number): SubsectionScore {
  const monthlyData = groupByMonth(data.transactions)
  const metrics: MetricValue[] = []
  let totalWeightedScore = 0

  // Get daily data for rolling calculations
  const dailyRevenue = new Map<string, number>()
  const dailyMcaPayments = new Map<string, number>()

  for (const t of data.transactions) {
    const dayKey = getDateKey(new Date(t.date))
    const flags = getTransactionFlags(t)

    if (flags.isCoreRevenue && t.amount > 0) {
      dailyRevenue.set(dayKey, (dailyRevenue.get(dayKey) || 0) + t.amount)
    }

    if (flags.isMcaRepayment) {
      dailyMcaPayments.set(dayKey, (dailyMcaPayments.get(dayKey) || 0) + Math.abs(t.amount))
    }
  }

  const sortedDays = Array.from(new Set([...dailyRevenue.keys(), ...dailyMcaPayments.keys()])).sort()

  // a. Monthly Coverage Ratio (EWA) - 25%
  const monthlyCoverages = monthlyData.map(m => {
    if (m.mcaRepayments === 0) return 10 // No MCA payments = excellent coverage
    return m.totalCoreRevenue / m.mcaRepayments
  })
  const coverageEWA = calculateEWA(monthlyCoverages)
  const cappedCoverage = Math.min(coverageEWA, 10)

  let coverageScore: number
  if (cappedCoverage >= 2.00) coverageScore = 100
  else if (cappedCoverage >= 1.60) coverageScore = 90
  else if (cappedCoverage >= 1.30) coverageScore = 80
  else if (cappedCoverage >= 1.10) coverageScore = 65
  else if (cappedCoverage >= 0.95) coverageScore = 45
  else if (cappedCoverage >= 0.80) coverageScore = 25
  else coverageScore = 10
  totalWeightedScore += coverageScore * 0.25
  metrics.push({
    name: 'Monthly Coverage Ratio',
    value: coverageEWA,
    formattedValue: `${Math.min(coverageEWA, 99).toFixed(2)}x`,
    weight: 0.25,
    interpretation: coverageEWA >= 1.30 ? 'Sufficient' : 'Insufficient'
  })

  // b. Worst 30-Day Coverage - 20%
  let worst30DayCoverage = 10
  for (let i = 29; i < sortedDays.length; i++) {
    let rev30 = 0
    let mca30 = 0
    for (let j = i - 29; j <= i; j++) {
      const day = sortedDays[j]
      rev30 += dailyRevenue.get(day) || 0
      mca30 += dailyMcaPayments.get(day) || 0
    }
    if (mca30 > 0) {
      const coverage = rev30 / mca30
      worst30DayCoverage = Math.min(worst30DayCoverage, coverage)
    }
  }

  let worst30Score: number
  if (worst30DayCoverage >= 1.50) worst30Score = 100
  else if (worst30DayCoverage >= 1.25) worst30Score = 85
  else if (worst30DayCoverage >= 1.10) worst30Score = 70
  else if (worst30DayCoverage >= 1.00) worst30Score = 55
  else if (worst30DayCoverage >= 0.90) worst30Score = 40
  else if (worst30DayCoverage >= 0.75) worst30Score = 25
  else worst30Score = 10
  totalWeightedScore += worst30Score * 0.20
  metrics.push({
    name: 'Worst 30-Day Coverage',
    value: worst30DayCoverage,
    formattedValue: `${Math.min(worst30DayCoverage, 99).toFixed(2)}x`,
    weight: 0.20
  })

  // c. Coverage Volatility (Weekly CV) - 10%
  const weeks = aggregateIntoWeeklyWindows(data.transactions)
  const weeklyCoverages: number[] = []
  for (const week of weeks) {
    // Get MCA payments for this week
    let weekMca = 0
    for (const t of data.transactions) {
      const tDate = new Date(t.date)
      if (tDate >= week.weekStart && tDate <= week.weekEnd && getTransactionFlags(t).isMcaRepayment) {
        weekMca += Math.abs(t.amount)
      }
    }
    if (weekMca > 0) {
      weeklyCoverages.push(week.revenue / weekMca)
    }
  }
  const coverageCV = weeklyCoverages.length >= 2 ? coefficientOfVariation(weeklyCoverages) : 0.5

  let coverageCVScore: number
  if (coverageCV <= 0.25) coverageCVScore = 100
  else if (coverageCV <= 0.40) coverageCVScore = 85
  else if (coverageCV <= 0.60) coverageCVScore = 70
  else if (coverageCV <= 0.85) coverageCVScore = 50
  else if (coverageCV <= 1.10) coverageCVScore = 30
  else coverageCVScore = 15
  totalWeightedScore += coverageCVScore * 0.10
  metrics.push({
    name: 'Coverage Volatility',
    value: coverageCV,
    formattedValue: coverageCV.toFixed(2),
    weight: 0.10
  })

  // d. Revenue Gap Coverage - 10%
  // Find longest revenue gap
  let maxGapDays = 0
  let maxGapStart = -1
  let currentGap = 0
  let currentGapStart = -1

  for (let i = 0; i < sortedDays.length; i++) {
    const rev = dailyRevenue.get(sortedDays[i]) || 0
    if (rev === 0) {
      if (currentGap === 0) currentGapStart = i
      currentGap++
    } else {
      if (currentGap > maxGapDays) {
        maxGapDays = currentGap
        maxGapStart = currentGapStart
      }
      currentGap = 0
    }
  }
  if (currentGap > maxGapDays) {
    maxGapDays = currentGap
    maxGapStart = currentGapStart
  }

  // Calculate pre-gap revenue and gap MCA payments
  let preGapRevenue = 0
  let gapMcaPayments = 0
  if (maxGapStart >= 0) {
    // 15 days before gap
    for (let i = Math.max(0, maxGapStart - 15); i < maxGapStart; i++) {
      preGapRevenue += dailyRevenue.get(sortedDays[i]) || 0
    }
    // MCA during gap
    for (let i = maxGapStart; i < maxGapStart + maxGapDays && i < sortedDays.length; i++) {
      gapMcaPayments += dailyMcaPayments.get(sortedDays[i]) || 0
    }
  }

  const gapCoverage = gapMcaPayments > 0 ? preGapRevenue / gapMcaPayments : 10
  let gapCoverageScore: number
  if (gapCoverage >= 2.00) gapCoverageScore = 100
  else if (gapCoverage >= 1.50) gapCoverageScore = 85
  else if (gapCoverage >= 1.20) gapCoverageScore = 70
  else if (gapCoverage >= 1.00) gapCoverageScore = 55
  else if (gapCoverage >= 0.80) gapCoverageScore = 40
  else if (gapCoverage >= 0.60) gapCoverageScore = 25
  else gapCoverageScore = 10
  totalWeightedScore += gapCoverageScore * 0.10
  metrics.push({
    name: 'Revenue Gap Coverage',
    value: gapCoverage,
    formattedValue: `${Math.min(gapCoverage, 99).toFixed(2)}x`,
    weight: 0.10
  })

  // e. Revenue Payment Stress Ratio - 15%
  // Days where MA-30 revenue < MA-30 MCA payment
  let stressDays = 0
  const last60Start = Math.max(0, sortedDays.length - 60)

  for (let i = last60Start + 29; i < sortedDays.length; i++) {
    let ma30Rev = 0
    let ma30Mca = 0
    for (let j = i - 29; j <= i; j++) {
      ma30Rev += dailyRevenue.get(sortedDays[j]) || 0
      ma30Mca += dailyMcaPayments.get(sortedDays[j]) || 0
    }
    ma30Rev /= 30
    ma30Mca /= 30

    if (ma30Rev < ma30Mca) stressDays++
  }

  const totalDaysChecked = Math.max(1, sortedDays.length - last60Start - 29)
  const stressRatio = stressDays / totalDaysChecked

  let stressScore: number
  if (stressRatio <= 0.05) stressScore = 100
  else if (stressRatio <= 0.10) stressScore = 90
  else if (stressRatio <= 0.20) stressScore = 75
  else if (stressRatio <= 0.35) stressScore = 55
  else if (stressRatio <= 0.50) stressScore = 35
  else stressScore = 15
  totalWeightedScore += stressScore * 0.15
  metrics.push({
    name: 'Payment Stress Ratio',
    value: stressRatio,
    formattedValue: formatPercent(stressRatio),
    weight: 0.15
  })

  // f. Payment Coverage Days Ratio - 10%
  // Days where MA-30 revenue >= actual daily MCA payment
  let coverageDays = 0
  for (let i = last60Start + 29; i < sortedDays.length; i++) {
    let ma30Rev = 0
    for (let j = i - 29; j <= i; j++) {
      ma30Rev += dailyRevenue.get(sortedDays[j]) || 0
    }
    ma30Rev /= 30

    const actualMca = dailyMcaPayments.get(sortedDays[i]) || 0
    if (ma30Rev >= actualMca) coverageDays++
  }

  const coverageDaysRatio = coverageDays / Math.max(1, totalDaysChecked)

  let coverageDaysScore: number
  if (coverageDaysRatio >= 0.95) coverageDaysScore = 100
  else if (coverageDaysRatio >= 0.90) coverageDaysScore = 90
  else if (coverageDaysRatio >= 0.80) coverageDaysScore = 75
  else if (coverageDaysRatio >= 0.70) coverageDaysScore = 55
  else if (coverageDaysRatio >= 0.60) coverageDaysScore = 35
  else coverageDaysScore = 15
  totalWeightedScore += coverageDaysScore * 0.10
  metrics.push({
    name: 'Payment Coverage Days',
    value: coverageDaysRatio,
    formattedValue: formatPercent(coverageDaysRatio),
    weight: 0.10
  })

  // g. Consecutive Shortfall Run Length - 10%
  // Using MA-21 revenue vs actual MCA payment
  let maxRunLength = 0
  let currentRun = 0

  for (let i = last60Start + 20; i < sortedDays.length; i++) {
    let ma21Rev = 0
    for (let j = i - 20; j <= i; j++) {
      ma21Rev += dailyRevenue.get(sortedDays[j]) || 0
    }
    ma21Rev /= 21

    const actualMca = dailyMcaPayments.get(sortedDays[i]) || 0

    if (ma21Rev < actualMca && actualMca > 0) {
      currentRun++
      maxRunLength = Math.max(maxRunLength, currentRun)
    } else {
      currentRun = 0
    }
  }

  let runLengthScore: number
  if (maxRunLength <= 2) runLengthScore = 100
  else if (maxRunLength <= 5) runLengthScore = 85
  else if (maxRunLength <= 9) runLengthScore = 65
  else if (maxRunLength <= 14) runLengthScore = 45
  else if (maxRunLength <= 21) runLengthScore = 25
  else runLengthScore = 10
  totalWeightedScore += runLengthScore * 0.10
  metrics.push({
    name: 'Max Shortfall Run',
    value: maxRunLength,
    formattedValue: `${maxRunLength} days`,
    weight: 0.10
  })

  const finalScore = Math.round(clamp(totalWeightedScore, 1, 100))

  return {
    name: 'Revenue Sufficiency',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.35,
    metrics
  }
}

// ============================================================================
// MAIN EXPORT: Calculate Revenue Quality Section
// ============================================================================

export function calculateRevenueQualitySection(
  transactions: Transaction[],
  monthlyData: MonthlyMetrics[],
  totalRevenue: number,
  avgMonthlyRevenue: number,
  revenueBreakdown: RevenueBreakdown,
  mcaFundingReceived: number,
  totalExpenses: number,
  mcaPayments: number
): SectionScore {
  const data: RevenueData = {
    transactions,
    monthlyData,
    totalRevenue,
    avgMonthlyRevenue,
    revenueBreakdown,
    monthsAnalyzed: monthlyData.length,
    mcaFundingReceived,
  }

  // Calculate all subsections based on PDF specifications
  // Weights: Stability 20%, Durability 15%, Trend 15%, Concentration 15%, Sufficiency 35%
  const subsections: SubsectionScore[] = [
    calculateRevenueStabilityScore(data),      // 20%
    calculateRevenueDurabilityScore(data),     // 15%
    calculateRevenueTrendScore(data),          // 15%
    calculateRevenueConcentrationScore(data),  // 15%
    calculateRevenueSufficiencyScore(data, totalExpenses, mcaPayments), // 35%
  ]

  // Calculate weighted section score
  let weightedSum = 0
  let totalWeight = 0

  for (const sub of subsections) {
    weightedSum += sub.score * sub.weight
    totalWeight += sub.weight
  }

  const sectionScore = Math.round(weightedSum / totalWeight)

  return {
    name: 'Revenue Quality',
    score: sectionScore,
    rating: scoreToRating(sectionScore),
    weight: 0.25,
    subsections,
  }
}
