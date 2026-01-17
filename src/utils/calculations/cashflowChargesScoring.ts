/**
 * Cashflow & Charges Scoring Module (NSF/OD Analysis)
 *
 * 6 Subsections:
 * 1. NSF Frequency Score (25%)
 * 2. NSF Severity Score (20%)
 * 3. NSF Trend Score (15%)
 * 4. Negative Balance Score (20%)
 * 5. Balance Volatility Score (10%)
 * 6. Liquidity Buffer Score (10%)
 */

import {
  SubsectionScore,
  SectionScore,
  scoreToRating,
  calculateCV,
  calculateTrendDirection,
  clamp,
  formatCurrency,
  formatPercent,
} from './scoringFramework'
import type { Transaction, MonthlyMetrics, NSFMetrics, CashFlowMetrics } from './metricsCalculator'

interface CashflowData {
  transactions: Transaction[]
  monthlyData: MonthlyMetrics[]
  nsfMetrics: NSFMetrics & {
    frequency: number
    trend: 'IMPROVING' | 'STABLE' | 'WORSENING'
  }
  cashFlowMetrics: CashFlowMetrics & {
    volatility: number
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  }
  totalRevenue: number
  totalExpenses: number
  monthsAnalyzed: number
  totalDaysAnalyzed: number
  periodStart: Date
  periodEnd: Date
}

// ============================================================================
// 1. NSF FREQUENCY SCORE (Weight: 25%)
// ============================================================================

function calculateNSFFrequencyScore(data: CashflowData): SubsectionScore {
  const monthlyNSFCounts = data.monthlyData.map(m => m.nsf.count)
  const totalNSF = data.nsfMetrics.count
  const nsfPerMonth = totalNSF / data.monthsAnalyzed

  // Metric 1: NSF per Month - 60%
  let frequencyScore: number
  if (nsfPerMonth === 0) frequencyScore = 100
  else if (nsfPerMonth <= 0.5) frequencyScore = 90
  else if (nsfPerMonth <= 1) frequencyScore = 77
  else if (nsfPerMonth <= 3) frequencyScore = 60
  else if (nsfPerMonth <= 5) frequencyScore = 45
  else if (nsfPerMonth <= 10) frequencyScore = 30
  else frequencyScore = 15

  // Metric 2: NSF-Free Months - 25%
  const nsfFreeMonths = monthlyNSFCounts.filter(c => c === 0).length
  const nsfFreeRatio = nsfFreeMonths / data.monthsAnalyzed

  let nsfFreeScore: number
  if (nsfFreeRatio >= 1.0) nsfFreeScore = 100
  else if (nsfFreeRatio >= 0.8) nsfFreeScore = 85
  else if (nsfFreeRatio >= 0.6) nsfFreeScore = 70
  else if (nsfFreeRatio >= 0.4) nsfFreeScore = 50
  else nsfFreeScore = 30

  // Metric 3: Max NSF in Single Month - 15%
  const maxNSFMonth = Math.max(...monthlyNSFCounts)

  let maxScore: number
  if (maxNSFMonth === 0) maxScore = 100
  else if (maxNSFMonth <= 1) maxScore = 85
  else if (maxNSFMonth <= 3) maxScore = 65
  else if (maxNSFMonth <= 5) maxScore = 45
  else maxScore = 25

  const finalScore = Math.round(frequencyScore * 0.60 + nsfFreeScore * 0.25 + maxScore * 0.15)

  return {
    name: 'NSF Frequency',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.25,
    metrics: [
      { name: 'NSF per Month', value: nsfPerMonth, formattedValue: `${nsfPerMonth.toFixed(1)}`, weight: 0.60, interpretation: nsfPerMonth === 0 ? 'Perfect' : nsfPerMonth <= 1 ? 'Rare' : 'Frequent' },
      { name: 'NSF-Free Months', value: nsfFreeMonths, formattedValue: `${nsfFreeMonths}/${data.monthsAnalyzed}`, weight: 0.25 },
      { name: 'Max NSF (Single Month)', value: maxNSFMonth, formattedValue: `${maxNSFMonth}`, weight: 0.15 },
    ],
  }
}

// ============================================================================
// 2. NSF SEVERITY SCORE (Weight: 20%)
// ============================================================================

function calculateNSFSeverityScore(data: CashflowData): SubsectionScore {
  const totalNSFFees = data.nsfMetrics.totalFees
  const avgFee = data.nsfMetrics.avgFee

  // Metric 1: Total NSF Fees - 40%
  let feeScore: number
  if (totalNSFFees === 0) feeScore = 100
  else if (totalNSFFees < 100) feeScore = 90
  else if (totalNSFFees < 300) feeScore = 75
  else if (totalNSFFees < 500) feeScore = 60
  else if (totalNSFFees < 1000) feeScore = 45
  else feeScore = 25

  // Metric 2: NSF Fees vs Revenue - 35%
  const nsfRevenueRatio = data.totalRevenue > 0 ? totalNSFFees / data.totalRevenue : 0

  let ratioScore: number
  if (nsfRevenueRatio === 0) ratioScore = 100
  else if (nsfRevenueRatio < 0.001) ratioScore = 90    // < 0.1%
  else if (nsfRevenueRatio < 0.003) ratioScore = 75    // < 0.3%
  else if (nsfRevenueRatio < 0.005) ratioScore = 55    // < 0.5%
  else if (nsfRevenueRatio < 0.01) ratioScore = 35     // < 1%
  else ratioScore = 15

  // Metric 3: Average Fee Amount - 25%
  // High avg fee (>$35) may indicate punitive bank relationship
  let avgFeeScore: number
  if (totalNSFFees === 0) avgFeeScore = 100
  else if (avgFee < 25) avgFeeScore = 85
  else if (avgFee < 35) avgFeeScore = 70
  else if (avgFee < 45) avgFeeScore = 55
  else avgFeeScore = 40

  const finalScore = Math.round(feeScore * 0.40 + ratioScore * 0.35 + avgFeeScore * 0.25)

  return {
    name: 'NSF Severity',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.20,
    metrics: [
      { name: 'Total NSF Fees', value: totalNSFFees, formattedValue: formatCurrency(totalNSFFees), weight: 0.40, interpretation: totalNSFFees === 0 ? 'None' : totalNSFFees < 500 ? 'Moderate' : 'High' },
      { name: 'NSF Fees / Revenue', value: nsfRevenueRatio, formattedValue: formatPercent(nsfRevenueRatio, 2), weight: 0.35 },
      { name: 'Average Fee', value: avgFee, formattedValue: totalNSFFees > 0 ? formatCurrency(avgFee) : 'N/A', weight: 0.25 },
    ],
  }
}

// ============================================================================
// 3. NSF TREND SCORE (Weight: 15%)
// ============================================================================

function calculateNSFTrendScore(data: CashflowData): SubsectionScore {
  const monthlyNSFCounts = data.monthlyData.map(m => m.nsf.count)

  // Metric 1: Trend Direction (first half vs second half) - 50%
  const midpoint = Math.floor(monthlyNSFCounts.length / 2)
  const firstHalfNSF = monthlyNSFCounts.slice(0, midpoint).reduce((a, b) => a + b, 0)
  const secondHalfNSF = monthlyNSFCounts.slice(midpoint).reduce((a, b) => a + b, 0)

  let trendChange: number
  if (firstHalfNSF === 0 && secondHalfNSF === 0) {
    trendChange = 0  // No NSF at all - perfect
  } else if (firstHalfNSF === 0) {
    trendChange = 1  // NSF appearing - bad
  } else {
    trendChange = (secondHalfNSF - firstHalfNSF) / firstHalfNSF
  }

  let trendScore: number
  let trendLabel: string
  if (trendChange <= -0.5) {
    trendScore = 95
    trendLabel = 'Strongly Improving'
  } else if (trendChange <= -0.2) {
    trendScore = 82
    trendLabel = 'Improving'
  } else if (trendChange <= 0.2) {
    trendScore = 65
    trendLabel = 'Stable'
  } else if (trendChange <= 0.5) {
    trendScore = 45
    trendLabel = 'Worsening'
  } else {
    trendScore = 25
    trendLabel = 'Strongly Worsening'
  }

  // Perfect score if no NSF at all
  if (data.nsfMetrics.count === 0) {
    trendScore = 100
    trendLabel = 'No NSF'
  }

  // Metric 2: Recent Month Impact - 30%
  const mostRecentNSF = monthlyNSFCounts[monthlyNSFCounts.length - 1]
  const monthlyAvg = data.nsfMetrics.count / data.monthsAnalyzed

  let recentScore: number
  if (mostRecentNSF === 0) recentScore = 95
  else if (mostRecentNSF <= monthlyAvg) recentScore = 70
  else if (mostRecentNSF <= monthlyAvg * 1.5) recentScore = 50
  else recentScore = 30

  // Metric 3: Month-over-Month Improvement - 20%
  let improvingMonths = 0
  for (let i = 1; i < monthlyNSFCounts.length; i++) {
    if (monthlyNSFCounts[i] < monthlyNSFCounts[i - 1]) improvingMonths++
    else if (monthlyNSFCounts[i] === 0 && monthlyNSFCounts[i - 1] === 0) improvingMonths++ // Both zero = good
  }
  const improvementRatio = monthlyNSFCounts.length > 1 ? improvingMonths / (monthlyNSFCounts.length - 1) : 1

  let improvementScore: number
  if (improvementRatio >= 0.6) improvementScore = 90
  else if (improvementRatio >= 0.4) improvementScore = 70
  else improvementScore = 45

  const finalScore = Math.round(trendScore * 0.50 + recentScore * 0.30 + improvementScore * 0.20)

  return {
    name: 'NSF Trend',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Trend Direction', value: trendChange, formattedValue: trendLabel, weight: 0.50, interpretation: trendLabel },
      { name: 'Recent Month NSF', value: mostRecentNSF, formattedValue: `${mostRecentNSF}`, weight: 0.30 },
      { name: 'Improving Months', value: improvingMonths, formattedValue: formatPercent(improvementRatio), weight: 0.20 },
    ],
  }
}

// ============================================================================
// 4. NEGATIVE BALANCE SCORE (Weight: 20%)
// ============================================================================

function calculateNegativeBalanceScore(data: CashflowData): SubsectionScore {
  // Count unique negative balance days
  const negativeDates = new Set<string>()
  let lowestBalance = 0

  for (const txn of data.transactions) {
    if (txn.runningBalance !== undefined && txn.runningBalance < 0) {
      const dateKey = new Date(txn.date).toISOString().split('T')[0]
      negativeDates.add(dateKey)
      if (txn.runningBalance < lowestBalance) {
        lowestBalance = txn.runningBalance
      }
    }
  }

  const negativeDays = negativeDates.size
  const negativeDayRatio = data.totalDaysAnalyzed > 0 ? negativeDays / data.totalDaysAnalyzed : 0

  // Metric 1: Negative Day Ratio - 50%
  let negativeRatioScore: number
  if (negativeDayRatio === 0) negativeRatioScore = 100
  else if (negativeDayRatio <= 0.05) negativeRatioScore = 87
  else if (negativeDayRatio <= 0.15) negativeRatioScore = 70
  else if (negativeDayRatio <= 0.30) negativeRatioScore = 50
  else negativeRatioScore = 25

  // Metric 2: Deepest Negative - 25%
  let depthScore: number
  if (lowestBalance >= 0) depthScore = 100
  else if (lowestBalance >= -1000) depthScore = 85
  else if (lowestBalance >= -3000) depthScore = 65
  else if (lowestBalance >= -5000) depthScore = 45
  else depthScore = 25

  // Metric 3: Recovery Speed (avg days to recover from negative) - 25%
  // Simplified: if negative days are < 5% of total, assume quick recovery
  let recoveryScore: number
  if (negativeDays === 0) recoveryScore = 100
  else if (negativeDayRatio <= 0.03) recoveryScore = 90  // Very quick recovery
  else if (negativeDayRatio <= 0.10) recoveryScore = 70  // Decent recovery
  else if (negativeDayRatio <= 0.20) recoveryScore = 50
  else recoveryScore = 30

  const finalScore = Math.round(negativeRatioScore * 0.50 + depthScore * 0.25 + recoveryScore * 0.25)

  return {
    name: 'Negative Balance',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.20,
    metrics: [
      { name: 'Negative Days', value: negativeDays, formattedValue: `${negativeDays} days (${formatPercent(negativeDayRatio)})`, weight: 0.50, interpretation: negativeDays === 0 ? 'Never negative' : negativeDayRatio <= 0.10 ? 'Rarely' : 'Frequently' },
      { name: 'Lowest Balance', value: lowestBalance, formattedValue: formatCurrency(lowestBalance), weight: 0.25, interpretation: lowestBalance >= 0 ? 'Never negative' : lowestBalance >= -1000 ? 'Minor' : 'Significant' },
      { name: 'Recovery Speed', value: recoveryScore, formattedValue: negativeDays === 0 ? 'N/A' : negativeDayRatio <= 0.05 ? 'Fast' : 'Slow', weight: 0.25 },
    ],
  }
}

// ============================================================================
// 5. BALANCE VOLATILITY SCORE (Weight: 10%)
// ============================================================================

function calculateBalanceVolatilityScore(data: CashflowData): SubsectionScore {
  // Get daily ending balances
  const balancesByDate = new Map<string, number>()

  for (const txn of data.transactions) {
    if (txn.runningBalance !== undefined) {
      const dateKey = new Date(txn.date).toISOString().split('T')[0]
      balancesByDate.set(dateKey, txn.runningBalance)
    }
  }

  const dailyBalances = Array.from(balancesByDate.values())

  // Metric 1: Balance CV - 50%
  const balanceCV = calculateCV(dailyBalances)

  let cvScore: number
  if (balanceCV < 30) cvScore = 95
  else if (balanceCV < 50) cvScore = 82
  else if (balanceCV < 80) cvScore = 65
  else if (balanceCV < 120) cvScore = 45
  else cvScore = 25

  // Metric 2: Swing Frequency (days with >50% balance change) - 30%
  let swingDays = 0
  const balanceArray = Array.from(balancesByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  for (let i = 1; i < balanceArray.length; i++) {
    const prevBalance = balanceArray[i - 1][1]
    const currBalance = balanceArray[i][1]
    if (prevBalance !== 0) {
      const change = Math.abs(currBalance - prevBalance) / Math.abs(prevBalance)
      if (change > 0.5) swingDays++
    }
  }

  const swingRatio = balanceArray.length > 1 ? swingDays / (balanceArray.length - 1) : 0

  let swingScore: number
  if (swingRatio <= 0.05) swingScore = 95
  else if (swingRatio <= 0.10) swingScore = 80
  else if (swingRatio <= 0.20) swingScore = 60
  else swingScore = 40

  // Metric 3: Balance Range (max - min) vs Average - 20%
  const minBalance = Math.min(...dailyBalances)
  const maxBalance = Math.max(...dailyBalances)
  const avgBalance = dailyBalances.reduce((a, b) => a + b, 0) / dailyBalances.length
  const rangeRatio = avgBalance > 0 ? (maxBalance - minBalance) / avgBalance : 0

  let rangeScore: number
  if (rangeRatio < 1) rangeScore = 95
  else if (rangeRatio < 2) rangeScore = 80
  else if (rangeRatio < 4) rangeScore = 60
  else rangeScore = 40

  const finalScore = Math.round(cvScore * 0.50 + swingScore * 0.30 + rangeScore * 0.20)

  return {
    name: 'Balance Volatility',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Balance CV', value: balanceCV, formattedValue: `${balanceCV.toFixed(1)}%`, weight: 0.50, interpretation: balanceCV < 50 ? 'Stable' : 'Volatile' },
      { name: 'Swing Frequency', value: swingRatio, formattedValue: formatPercent(swingRatio), weight: 0.30, interpretation: swingRatio <= 0.10 ? 'Low' : 'High' },
      { name: 'Range/Avg', value: rangeRatio, formattedValue: `${rangeRatio.toFixed(1)}x`, weight: 0.20 },
    ],
  }
}

// ============================================================================
// 6. LIQUIDITY BUFFER SCORE (Weight: 10%)
// ============================================================================

function calculateLiquidityBufferScore(data: CashflowData): SubsectionScore {
  const avgDailyBalance = data.cashFlowMetrics.avgDailyBalance
  const minBalance = data.cashFlowMetrics.minBalance
  const avgDailyExpenses = data.totalExpenses / data.totalDaysAnalyzed

  // Metric 1: Days of Runway (Avg Balance / Avg Daily Expenses) - 40%
  const daysOfRunway = avgDailyExpenses > 0 ? avgDailyBalance / avgDailyExpenses : 0

  let runwayScore: number
  if (daysOfRunway >= 30) runwayScore = 95
  else if (daysOfRunway >= 15) runwayScore = 82
  else if (daysOfRunway >= 7) runwayScore = 65
  else if (daysOfRunway >= 3) runwayScore = 45
  else runwayScore = 25

  // Metric 2: Average Daily Balance - 30%
  let avgBalanceScore: number
  if (avgDailyBalance >= 50000) avgBalanceScore = 95
  else if (avgDailyBalance >= 25000) avgBalanceScore = 85
  else if (avgDailyBalance >= 10000) avgBalanceScore = 70
  else if (avgDailyBalance >= 5000) avgBalanceScore = 55
  else if (avgDailyBalance >= 0) avgBalanceScore = 40
  else avgBalanceScore = 20

  // Metric 3: Min Balance Buffer - 30%
  const minRunway = avgDailyExpenses > 0 ? minBalance / avgDailyExpenses : 0

  let minBufferScore: number
  if (minBalance >= 10000) minBufferScore = 95
  else if (minBalance >= 5000) minBufferScore = 85
  else if (minBalance >= 1000) minBufferScore = 70
  else if (minBalance >= 0) minBufferScore = 55
  else if (minBalance >= -1000) minBufferScore = 40
  else minBufferScore = 20

  const finalScore = Math.round(runwayScore * 0.40 + avgBalanceScore * 0.30 + minBufferScore * 0.30)

  return {
    name: 'Liquidity Buffer',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Days of Runway', value: daysOfRunway, formattedValue: `${daysOfRunway.toFixed(1)} days`, weight: 0.40, interpretation: daysOfRunway >= 15 ? 'Good cushion' : daysOfRunway >= 7 ? 'Adequate' : 'Thin' },
      { name: 'Avg Daily Balance', value: avgDailyBalance, formattedValue: formatCurrency(avgDailyBalance), weight: 0.30 },
      { name: 'Min Balance', value: minBalance, formattedValue: formatCurrency(minBalance), weight: 0.30 },
    ],
  }
}

// ============================================================================
// MAIN EXPORT: Calculate Cashflow & Charges Section
// ============================================================================

export function calculateCashflowChargesSection(
  transactions: Transaction[],
  monthlyData: MonthlyMetrics[],
  nsfMetrics: NSFMetrics & {
    frequency: number
    trend: 'IMPROVING' | 'STABLE' | 'WORSENING'
  },
  cashFlowMetrics: CashFlowMetrics & {
    volatility: number
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  },
  totalRevenue: number,
  totalExpenses: number,
  totalDaysAnalyzed: number,
  periodStart: Date,
  periodEnd: Date
): SectionScore {
  const data: CashflowData = {
    transactions,
    monthlyData,
    nsfMetrics,
    cashFlowMetrics,
    totalRevenue,
    totalExpenses,
    monthsAnalyzed: monthlyData.length,
    totalDaysAnalyzed,
    periodStart,
    periodEnd,
  }

  // Calculate all subsections
  const subsections: SubsectionScore[] = [
    calculateNSFFrequencyScore(data),
    calculateNSFSeverityScore(data),
    calculateNSFTrendScore(data),
    calculateNegativeBalanceScore(data),
    calculateBalanceVolatilityScore(data),
    calculateLiquidityBufferScore(data),
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
    name: 'Cashflow & Charges',
    score: sectionScore,
    rating: scoreToRating(sectionScore),
    weight: 0.25,
    subsections,
  }
}
