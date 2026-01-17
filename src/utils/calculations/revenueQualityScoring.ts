/**
 * Revenue Quality Scoring Module
 *
 * 7 Subsections:
 * 1. Revenue Stability Score (20%)
 * 2. Revenue Durability Score (15%)
 * 3. Revenue Trend & Momentum Score (15%)
 * 4. Revenue Concentration Score (10%)
 * 5. Revenue Sufficiency Score (10%)
 * 6. Revenue RedFlags Score (20%)
 * 7. Revenue Continuity Score (10%)
 */

import {
  SubsectionScore,
  SectionScore,
  MetricValue,
  RedFlagDetail,
  REVENUE_RED_FLAG_PATTERNS,
  scoreToRating,
  calculateCV,
  calculateTrendDirection,
  clamp,
  formatCurrency,
  formatPercent,
  formatNumber,
} from './scoringFramework'
import type { Transaction, MonthlyMetrics, RevenueBreakdown } from './metricsCalculator'

interface RevenueData {
  transactions: Transaction[]
  monthlyData: MonthlyMetrics[]
  totalRevenue: number
  avgMonthlyRevenue: number
  revenueBreakdown: RevenueBreakdown
  monthsAnalyzed: number
  mcaFundingReceived: number
}

// ============================================================================
// 1. REVENUE STABILITY SCORE (Weight: 20%)
// ============================================================================

function calculateRevenueStabilityScore(data: RevenueData): SubsectionScore {
  const monthlyRevenues = data.monthlyData.map(m => m.revenue.total)

  // Metric 1: Revenue CV (Coefficient of Variation) - 50%
  const revenueCV = calculateCV(monthlyRevenues)

  // Score based on CV
  let cvScore: number
  if (revenueCV < 10) cvScore = 95
  else if (revenueCV < 15) cvScore = 85
  else if (revenueCV < 20) cvScore = 75
  else if (revenueCV < 30) cvScore = 60
  else if (revenueCV < 40) cvScore = 45
  else cvScore = 25

  // Metric 2: Max Month-to-Month Variance - 30%
  let maxVariance = 0
  for (let i = 1; i < monthlyRevenues.length; i++) {
    const variance = Math.abs(monthlyRevenues[i] - monthlyRevenues[i - 1]) / (monthlyRevenues[i - 1] || 1)
    if (variance > maxVariance) maxVariance = variance
  }

  let varianceScore: number
  if (maxVariance < 0.15) varianceScore = 95
  else if (maxVariance < 0.25) varianceScore = 80
  else if (maxVariance < 0.40) varianceScore = 65
  else if (maxVariance < 0.60) varianceScore = 45
  else varianceScore = 25

  // Metric 3: Months Above Average - 20%
  const avgRevenue = data.avgMonthlyRevenue
  const monthsAboveAvg = monthlyRevenues.filter(r => r >= avgRevenue * 0.9).length
  const aboveAvgRatio = monthsAboveAvg / monthlyRevenues.length

  let consistencyScore: number
  if (aboveAvgRatio >= 0.8) consistencyScore = 95
  else if (aboveAvgRatio >= 0.6) consistencyScore = 75
  else if (aboveAvgRatio >= 0.4) consistencyScore = 55
  else consistencyScore = 35

  const finalScore = Math.round(cvScore * 0.50 + varianceScore * 0.30 + consistencyScore * 0.20)

  return {
    name: 'Revenue Stability',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.20,
    metrics: [
      { name: 'Revenue CV', value: revenueCV, formattedValue: `${revenueCV.toFixed(1)}%`, weight: 0.50, interpretation: revenueCV < 20 ? 'Stable' : 'Volatile' },
      { name: 'Max Variance', value: maxVariance, formattedValue: formatPercent(maxVariance), weight: 0.30, interpretation: maxVariance < 0.25 ? 'Low variance' : 'High variance' },
      { name: 'Months Above Avg', value: monthsAboveAvg, formattedValue: `${monthsAboveAvg}/${monthlyRevenues.length}`, weight: 0.20 },
    ],
  }
}

// ============================================================================
// 2. REVENUE DURABILITY SCORE (Weight: 15%)
// ============================================================================

function calculateRevenueDurabilityScore(data: RevenueData): SubsectionScore {
  const monthlyRevenues = data.monthlyData.map(m => m.revenue.total)

  // Metric 1: Zero Revenue Months - 50%
  const zeroMonths = monthlyRevenues.filter(r => r <= 0).length
  const zeroMonthRatio = zeroMonths / monthlyRevenues.length

  let zeroScore: number
  if (zeroMonths === 0) zeroScore = 100
  else if (zeroMonthRatio <= 0.1) zeroScore = 70
  else if (zeroMonthRatio <= 0.2) zeroScore = 50
  else zeroScore = 20

  // Metric 2: Min Revenue Month Ratio - 30%
  const minRevenue = Math.min(...monthlyRevenues.filter(r => r > 0))
  const minRatio = minRevenue / data.avgMonthlyRevenue

  let minScore: number
  if (minRatio >= 0.7) minScore = 95
  else if (minRatio >= 0.5) minScore = 75
  else if (minRatio >= 0.3) minScore = 55
  else minScore = 30

  // Metric 3: Consecutive Growth Months - 20%
  let maxConsecutiveGrowth = 0
  let currentStreak = 0
  for (let i = 1; i < monthlyRevenues.length; i++) {
    if (monthlyRevenues[i] >= monthlyRevenues[i - 1]) {
      currentStreak++
      maxConsecutiveGrowth = Math.max(maxConsecutiveGrowth, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  let growthScore: number
  if (maxConsecutiveGrowth >= 4) growthScore = 95
  else if (maxConsecutiveGrowth >= 3) growthScore = 80
  else if (maxConsecutiveGrowth >= 2) growthScore = 65
  else growthScore = 45

  const finalScore = Math.round(zeroScore * 0.50 + minScore * 0.30 + growthScore * 0.20)

  return {
    name: 'Revenue Durability',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Zero Revenue Months', value: zeroMonths, formattedValue: `${zeroMonths}`, weight: 0.50, interpretation: zeroMonths === 0 ? 'None' : 'Concerning' },
      { name: 'Min Month Ratio', value: minRatio, formattedValue: formatPercent(minRatio), weight: 0.30 },
      { name: 'Max Growth Streak', value: maxConsecutiveGrowth, formattedValue: `${maxConsecutiveGrowth} months`, weight: 0.20 },
    ],
  }
}

// ============================================================================
// 3. REVENUE TREND & MOMENTUM SCORE (Weight: 15%)
// ============================================================================

function calculateRevenueTrendScore(data: RevenueData): SubsectionScore {
  const monthlyRevenues = data.monthlyData.map(m => m.revenue.total)

  // Metric 1: Trend Direction (first half vs second half) - 50%
  const midpoint = Math.floor(monthlyRevenues.length / 2)
  const firstHalfAvg = monthlyRevenues.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint
  const secondHalfAvg = monthlyRevenues.slice(midpoint).reduce((a, b) => a + b, 0) / (monthlyRevenues.length - midpoint)

  const trendChange = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) : 0

  let trendScore: number
  if (trendChange >= 0.20) trendScore = 95      // Strong growth
  else if (trendChange >= 0.05) trendScore = 80  // Moderate growth
  else if (trendChange >= -0.05) trendScore = 65 // Stable
  else if (trendChange >= -0.20) trendScore = 45 // Declining
  else trendScore = 25                           // Sharp decline

  // Metric 2: Most Recent Month vs Average - 30%
  const recentMonth = monthlyRevenues[monthlyRevenues.length - 1]
  const recentRatio = recentMonth / data.avgMonthlyRevenue

  let recentScore: number
  if (recentRatio >= 1.2) recentScore = 95
  else if (recentRatio >= 1.0) recentScore = 80
  else if (recentRatio >= 0.8) recentScore = 60
  else if (recentRatio >= 0.6) recentScore = 40
  else recentScore = 20

  // Metric 3: Month-over-Month Growth Rate - 20%
  const growthRates: number[] = []
  for (let i = 1; i < monthlyRevenues.length; i++) {
    if (monthlyRevenues[i - 1] > 0) {
      growthRates.push((monthlyRevenues[i] - monthlyRevenues[i - 1]) / monthlyRevenues[i - 1])
    }
  }
  const avgGrowthRate = growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0

  let momScore: number
  if (avgGrowthRate >= 0.10) momScore = 95
  else if (avgGrowthRate >= 0.03) momScore = 80
  else if (avgGrowthRate >= -0.03) momScore = 65
  else if (avgGrowthRate >= -0.10) momScore = 45
  else momScore = 25

  const finalScore = Math.round(trendScore * 0.50 + recentScore * 0.30 + momScore * 0.20)

  const trendDirection = trendChange >= 0.05 ? 'Growing' : trendChange <= -0.05 ? 'Declining' : 'Stable'

  return {
    name: 'Revenue Trend & Momentum',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Trend Direction', value: trendChange, formattedValue: `${trendDirection} (${(trendChange * 100).toFixed(1)}%)`, weight: 0.50 },
      { name: 'Recent Month vs Avg', value: recentRatio, formattedValue: formatPercent(recentRatio), weight: 0.30 },
      { name: 'Avg MoM Growth', value: avgGrowthRate, formattedValue: formatPercent(avgGrowthRate), weight: 0.20 },
    ],
  }
}

// ============================================================================
// 4. REVENUE CONCENTRATION SCORE (Weight: 10%)
// ============================================================================

function calculateRevenueConcentrationScore(data: RevenueData): SubsectionScore {
  const breakdown = data.revenueBreakdown

  // Get all revenue sources
  const sources: Array<{ name: string; amount: number }> = [
    { name: 'Regular Revenue', amount: breakdown.regularRevenue },
    { name: 'Credit Card Sales', amount: breakdown.creditCardSales },
    { name: 'ACH Deposits', amount: breakdown.achDeposits },
    { name: 'Wire Transfers', amount: breakdown.wireTransfers },
    { name: 'Check Deposits', amount: breakdown.checkDeposits },
    { name: 'Zelle Income', amount: breakdown.zelleIncome },
    { name: 'State Payments', amount: breakdown.statePayments },
    { name: 'Counseling Revenue', amount: breakdown.counselingRevenue },
    { name: 'Other Revenue', amount: breakdown.otherRevenue },
    { name: 'Refunds', amount: breakdown.refundsReceived },
  ].filter(s => s.amount > 0)

  // Exclude MCA funding from concentration analysis
  const totalExMCA = data.totalRevenue - data.mcaFundingReceived

  if (totalExMCA <= 0 || sources.length === 0) {
    return {
      name: 'Revenue Concentration',
      score: 50,
      rating: 3,
      weight: 0.10,
      metrics: [{ name: 'No revenue data', value: 0, formattedValue: 'N/A', weight: 1.0 }],
    }
  }

  // Metric 1: Top Source Concentration - 50%
  const sortedSources = sources.sort((a, b) => b.amount - a.amount)
  const topSourcePct = sortedSources[0].amount / totalExMCA

  let concentrationScore: number
  if (topSourcePct < 0.40) concentrationScore = 95     // Well diversified
  else if (topSourcePct < 0.50) concentrationScore = 80
  else if (topSourcePct < 0.65) concentrationScore = 65
  else if (topSourcePct < 0.80) concentrationScore = 45
  else concentrationScore = 25                          // Highly concentrated

  // Metric 2: Number of Revenue Sources - 30%
  const activeSourceCount = sources.length

  let diversityScore: number
  if (activeSourceCount >= 5) diversityScore = 95
  else if (activeSourceCount >= 4) diversityScore = 80
  else if (activeSourceCount >= 3) diversityScore = 65
  else if (activeSourceCount >= 2) diversityScore = 45
  else diversityScore = 25

  // Metric 3: MCA Dependency - 20%
  const mcaDependency = data.mcaFundingReceived / data.totalRevenue

  let mcaScore: number
  if (mcaDependency === 0) mcaScore = 100
  else if (mcaDependency < 0.10) mcaScore = 80
  else if (mcaDependency < 0.20) mcaScore = 60
  else if (mcaDependency < 0.30) mcaScore = 40
  else mcaScore = 20

  const finalScore = Math.round(concentrationScore * 0.50 + diversityScore * 0.30 + mcaScore * 0.20)

  return {
    name: 'Revenue Concentration',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Top Source', value: topSourcePct, formattedValue: `${sortedSources[0].name}: ${formatPercent(topSourcePct)}`, weight: 0.50, interpretation: topSourcePct < 0.50 ? 'Diversified' : 'Concentrated' },
      { name: 'Source Count', value: activeSourceCount, formattedValue: `${activeSourceCount} sources`, weight: 0.30 },
      { name: 'MCA Dependency', value: mcaDependency, formattedValue: formatPercent(mcaDependency), weight: 0.20, interpretation: mcaDependency < 0.10 ? 'Low' : 'High' },
    ],
  }
}

// ============================================================================
// 5. REVENUE SUFFICIENCY SCORE (Weight: 10%)
// ============================================================================

function calculateRevenueSufficiencyScore(data: RevenueData, totalExpenses: number, mcaPayments: number): SubsectionScore {
  // Metric 1: Revenue Coverage Ratio (Revenue / Expenses) - 50%
  const coverageRatio = totalExpenses > 0 ? data.totalRevenue / totalExpenses : 0

  let coverageScore: number
  if (coverageRatio >= 1.5) coverageScore = 95
  else if (coverageRatio >= 1.25) coverageScore = 80
  else if (coverageRatio >= 1.10) coverageScore = 65
  else if (coverageRatio >= 1.0) coverageScore = 50
  else if (coverageRatio >= 0.9) coverageScore = 35
  else coverageScore = 20

  // Metric 2: MCA Coverage (Revenue - OpEx) / MCA - 30%
  const operatingExpenses = totalExpenses - mcaPayments
  const surplusAfterOpEx = data.totalRevenue - operatingExpenses
  const mcaCoverage = mcaPayments > 0 ? surplusAfterOpEx / mcaPayments : 999

  let mcaCoverageScore: number
  if (mcaPayments === 0) mcaCoverageScore = 100
  else if (mcaCoverage >= 3) mcaCoverageScore = 95
  else if (mcaCoverage >= 2) mcaCoverageScore = 80
  else if (mcaCoverage >= 1.5) mcaCoverageScore = 65
  else if (mcaCoverage >= 1.0) mcaCoverageScore = 50
  else mcaCoverageScore = 25

  // Metric 3: Net Margin - 20%
  const netMargin = data.totalRevenue > 0 ? (data.totalRevenue - totalExpenses) / data.totalRevenue : 0

  let marginScore: number
  if (netMargin >= 0.20) marginScore = 95
  else if (netMargin >= 0.10) marginScore = 80
  else if (netMargin >= 0.05) marginScore = 65
  else if (netMargin >= 0) marginScore = 50
  else marginScore = 25

  const finalScore = Math.round(coverageScore * 0.50 + mcaCoverageScore * 0.30 + marginScore * 0.20)

  return {
    name: 'Revenue Sufficiency',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Coverage Ratio', value: coverageRatio, formattedValue: `${coverageRatio.toFixed(2)}x`, weight: 0.50, interpretation: coverageRatio >= 1.0 ? 'Sufficient' : 'Insufficient' },
      { name: 'MCA Coverage', value: mcaCoverage, formattedValue: mcaPayments > 0 ? `${mcaCoverage.toFixed(2)}x` : 'N/A', weight: 0.30 },
      { name: 'Net Margin', value: netMargin, formattedValue: formatPercent(netMargin), weight: 0.20 },
    ],
  }
}

// ============================================================================
// 6. REVENUE RED FLAGS SCORE (Weight: 20%)
// ============================================================================

function calculateRevenueRedFlagsScore(data: RevenueData): SubsectionScore {
  let baseScore = 100
  const redFlags: RedFlagDetail[] = []

  // Check for suspicious large cash deposits
  const cashDeposits = data.transactions.filter(
    t => t.type === 'CREDIT' && /cash\s*deposit/i.test(t.description)
  )

  // Large round cash deposits (potential structuring)
  const largeRoundCash = cashDeposits.filter(t => t.amount >= 5000 && t.amount % 1000 === 0)
  if (largeRoundCash.length > 0) {
    const deduction = Math.min(largeRoundCash.length * 5, 20)
    baseScore -= deduction
    redFlags.push({
      type: 'LARGE_ROUND_CASH',
      severity: 'MEDIUM',
      description: `${largeRoundCash.length} large round cash deposit(s) detected`,
      pointsDeducted: deduction,
    })
  }

  // Heavy reliance on MCA funding
  const mcaFundingRatio = data.mcaFundingReceived / data.totalRevenue
  if (mcaFundingRatio > 0.40) {
    baseScore -= 20
    redFlags.push({
      type: 'HIGH_MCA_DEPENDENCY',
      severity: 'HIGH',
      description: `${formatPercent(mcaFundingRatio)} of revenue from MCA funding`,
      pointsDeducted: 20,
    })
  } else if (mcaFundingRatio > 0.25) {
    baseScore -= 10
    redFlags.push({
      type: 'MODERATE_MCA_DEPENDENCY',
      severity: 'MEDIUM',
      description: `${formatPercent(mcaFundingRatio)} of revenue from MCA funding`,
      pointsDeducted: 10,
    })
  }

  // Revenue drop > 50% in any month
  const monthlyRevenues = data.monthlyData.map(m => m.revenue.total)
  for (let i = 1; i < monthlyRevenues.length; i++) {
    if (monthlyRevenues[i - 1] > 0) {
      const dropPct = (monthlyRevenues[i - 1] - monthlyRevenues[i]) / monthlyRevenues[i - 1]
      if (dropPct > 0.50) {
        baseScore -= 15
        redFlags.push({
          type: 'REVENUE_CLIFF',
          severity: 'HIGH',
          description: `Revenue dropped ${formatPercent(dropPct)} in ${data.monthlyData[i].month}`,
          pointsDeducted: 15,
        })
        break // Only penalize once
      }
    }
  }

  // Unassigned income > 20%
  const unassignedRatio = data.revenueBreakdown.unassignedIncome / data.totalRevenue
  if (unassignedRatio > 0.20) {
    baseScore -= 10
    redFlags.push({
      type: 'HIGH_UNASSIGNED_INCOME',
      severity: 'MEDIUM',
      description: `${formatPercent(unassignedRatio)} of income is unassigned`,
      pointsDeducted: 10,
    })
  }

  const finalScore = clamp(baseScore, 0, 100)

  return {
    name: 'Revenue Red Flags',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.20,
    metrics: [
      { name: 'Red Flags Found', value: redFlags.length, formattedValue: `${redFlags.length}`, weight: 1.0, interpretation: redFlags.length === 0 ? 'None' : 'Review needed' },
    ],
    redFlags,
  }
}

// ============================================================================
// 7. REVENUE CONTINUITY SCORE (Weight: 10%)
// ============================================================================

function calculateRevenueContinuityScore(data: RevenueData): SubsectionScore {
  const monthlyRevenues = data.monthlyData.map(m => m.revenue.total)

  // Metric 1: Revenue Gaps - 50%
  // Days between deposits (should be consistent)
  const creditTransactions = data.transactions
    .filter(t => t.type === 'CREDIT' && t.amount > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let maxGap = 0
  let avgGap = 0
  if (creditTransactions.length > 1) {
    const gaps: number[] = []
    for (let i = 1; i < creditTransactions.length; i++) {
      const gap = (new Date(creditTransactions[i].date).getTime() - new Date(creditTransactions[i - 1].date).getTime()) / (1000 * 60 * 60 * 24)
      gaps.push(gap)
      if (gap > maxGap) maxGap = gap
    }
    avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
  }

  let gapScore: number
  if (maxGap <= 5) gapScore = 95
  else if (maxGap <= 10) gapScore = 80
  else if (maxGap <= 15) gapScore = 65
  else if (maxGap <= 21) gapScore = 50
  else gapScore = 30

  // Metric 2: Deposit Frequency - 30%
  const depositsPerMonth = creditTransactions.length / data.monthsAnalyzed

  let frequencyScore: number
  if (depositsPerMonth >= 30) frequencyScore = 95    // Daily deposits
  else if (depositsPerMonth >= 15) frequencyScore = 85
  else if (depositsPerMonth >= 8) frequencyScore = 70  // Bi-weekly
  else if (depositsPerMonth >= 4) frequencyScore = 55  // Weekly
  else frequencyScore = 35

  // Metric 3: Positive Cash Flow Months - 20%
  let positiveMonths = 0
  for (const month of data.monthlyData) {
    const netFlow = month.revenue.total - month.expenses.total
    if (netFlow > 0) positiveMonths++
  }
  const positiveRatio = positiveMonths / data.monthsAnalyzed

  let positiveScore: number
  if (positiveRatio >= 0.9) positiveScore = 95
  else if (positiveRatio >= 0.75) positiveScore = 80
  else if (positiveRatio >= 0.5) positiveScore = 60
  else positiveScore = 35

  const finalScore = Math.round(gapScore * 0.50 + frequencyScore * 0.30 + positiveScore * 0.20)

  return {
    name: 'Revenue Continuity',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Max Revenue Gap', value: maxGap, formattedValue: `${maxGap.toFixed(0)} days`, weight: 0.50, interpretation: maxGap <= 7 ? 'Consistent' : 'Gaps detected' },
      { name: 'Deposits/Month', value: depositsPerMonth, formattedValue: `${depositsPerMonth.toFixed(1)}`, weight: 0.30 },
      { name: 'Positive Months', value: positiveMonths, formattedValue: `${positiveMonths}/${data.monthsAnalyzed}`, weight: 0.20 },
    ],
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

  // Calculate all subsections
  const subsections: SubsectionScore[] = [
    calculateRevenueStabilityScore(data),
    calculateRevenueDurabilityScore(data),
    calculateRevenueTrendScore(data),
    calculateRevenueConcentrationScore(data),
    calculateRevenueSufficiencyScore(data, totalExpenses, mcaPayments),
    calculateRevenueRedFlagsScore(data),
    calculateRevenueContinuityScore(data),
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
