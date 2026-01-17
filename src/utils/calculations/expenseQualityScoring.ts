/**
 * Expense Quality Scoring Module
 *
 * 7 Subsections:
 * 1. Expense Ratio Score (20%)
 * 2. Expense Stability Score (15%)
 * 3. Expense Categorization Score (10%)
 * 4. Fixed vs Variable Score (15%)
 * 5. Owner Draw Score (15%)
 * 6. Expense RedFlags Score (15%)
 * 7. Expense Trend Score (10%)
 */

import {
  SubsectionScore,
  SectionScore,
  MetricValue,
  RedFlagDetail,
  EXPENSE_RED_FLAG_PATTERNS,
  FIXED_EXPENSE_CATEGORIES,
  scoreToRating,
  calculateCV,
  clamp,
  formatCurrency,
  formatPercent,
} from './scoringFramework'
import type { Transaction, MonthlyMetrics, ExpenseBreakdown } from './metricsCalculator'

interface ExpenseData {
  transactions: Transaction[]
  monthlyData: MonthlyMetrics[]
  totalExpenses: number
  totalRevenue: number
  avgMonthlyExpenses: number
  expenseBreakdown: ExpenseBreakdown
  monthsAnalyzed: number
  mcaPayments: number
  ownerDraws: number
  netIncome: number
}

// ============================================================================
// 1. EXPENSE RATIO SCORE (Weight: 20%)
// ============================================================================

function calculateExpenseRatioScore(data: ExpenseData): SubsectionScore {
  // Metric 1: Operating Expense Ratio (excluding MCA) - 50%
  const operatingExpenses = data.totalExpenses - data.mcaPayments
  const opExpenseRatio = data.totalRevenue > 0 ? operatingExpenses / data.totalRevenue : 1

  let ratioScore: number
  if (opExpenseRatio < 0.60) ratioScore = 95
  else if (opExpenseRatio < 0.70) ratioScore = 82
  else if (opExpenseRatio < 0.80) ratioScore = 67
  else if (opExpenseRatio < 0.90) ratioScore = 50
  else ratioScore = 25

  // Metric 2: Net Margin - 30%
  const netMargin = data.totalRevenue > 0 ? (data.totalRevenue - data.totalExpenses) / data.totalRevenue : -1

  let marginScore: number
  if (netMargin >= 0.15) marginScore = 95
  else if (netMargin >= 0.08) marginScore = 80
  else if (netMargin >= 0.03) marginScore = 65
  else if (netMargin >= 0) marginScore = 50
  else marginScore = 25

  // Metric 3: Expense Coverage (Revenue / Expenses) - 20%
  const expenseCoverage = data.totalExpenses > 0 ? data.totalRevenue / data.totalExpenses : 0

  let coverageScore: number
  if (expenseCoverage >= 1.3) coverageScore = 95
  else if (expenseCoverage >= 1.15) coverageScore = 80
  else if (expenseCoverage >= 1.05) coverageScore = 65
  else if (expenseCoverage >= 1.0) coverageScore = 50
  else coverageScore = 25

  const finalScore = Math.round(ratioScore * 0.50 + marginScore * 0.30 + coverageScore * 0.20)

  return {
    name: 'Expense Ratio',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.20,
    metrics: [
      { name: 'Op Expense Ratio', value: opExpenseRatio, formattedValue: formatPercent(opExpenseRatio), weight: 0.50, interpretation: opExpenseRatio < 0.70 ? 'Healthy' : 'High' },
      { name: 'Net Margin', value: netMargin, formattedValue: formatPercent(netMargin), weight: 0.30, interpretation: netMargin >= 0.05 ? 'Profitable' : 'Thin' },
      { name: 'Expense Coverage', value: expenseCoverage, formattedValue: `${expenseCoverage.toFixed(2)}x`, weight: 0.20 },
    ],
  }
}

// ============================================================================
// 2. EXPENSE STABILITY SCORE (Weight: 15%)
// ============================================================================

function calculateExpenseStabilityScore(data: ExpenseData): SubsectionScore {
  const monthlyExpenses = data.monthlyData.map(m => m.expenses.total)

  // Metric 1: Expense CV - 40%
  const expenseCV = calculateCV(monthlyExpenses)

  let cvScore: number
  if (expenseCV < 10) cvScore = 95
  else if (expenseCV < 20) cvScore = 82
  else if (expenseCV < 30) cvScore = 67
  else if (expenseCV < 50) cvScore = 50
  else cvScore = 30

  // Metric 2: Max Month-to-Month Variance - 30%
  let maxVariance = 0
  for (let i = 1; i < monthlyExpenses.length; i++) {
    const variance = Math.abs(monthlyExpenses[i] - monthlyExpenses[i - 1]) / (monthlyExpenses[i - 1] || 1)
    if (variance > maxVariance) maxVariance = variance
  }

  let varianceScore: number
  if (maxVariance < 0.15) varianceScore = 95
  else if (maxVariance < 0.25) varianceScore = 80
  else if (maxVariance < 0.40) varianceScore = 65
  else if (maxVariance < 0.60) varianceScore = 45
  else varianceScore = 25

  // Metric 3: Predictability (% of expenses that are recurring) - 30%
  const recurringExpenses = data.expenseBreakdown.recurring + data.expenseBreakdown.rent +
    data.expenseBreakdown.utilities + data.expenseBreakdown.insurance +
    data.expenseBreakdown.softwareSubscriptions + data.expenseBreakdown.payroll
  const predictabilityRatio = data.totalExpenses > 0 ? recurringExpenses / data.totalExpenses : 0

  let predictabilityScore: number
  if (predictabilityRatio >= 0.5) predictabilityScore = 95
  else if (predictabilityRatio >= 0.35) predictabilityScore = 80
  else if (predictabilityRatio >= 0.20) predictabilityScore = 65
  else predictabilityScore = 45

  const finalScore = Math.round(cvScore * 0.40 + varianceScore * 0.30 + predictabilityScore * 0.30)

  return {
    name: 'Expense Stability',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Expense CV', value: expenseCV, formattedValue: `${expenseCV.toFixed(1)}%`, weight: 0.40, interpretation: expenseCV < 20 ? 'Stable' : 'Volatile' },
      { name: 'Max Variance', value: maxVariance, formattedValue: formatPercent(maxVariance), weight: 0.30 },
      { name: 'Predictability', value: predictabilityRatio, formattedValue: formatPercent(predictabilityRatio), weight: 0.30 },
    ],
  }
}

// ============================================================================
// 3. EXPENSE CATEGORIZATION SCORE (Weight: 10%)
// ============================================================================

function calculateExpenseCategorizationScore(data: ExpenseData): SubsectionScore {
  const breakdown = data.expenseBreakdown

  // Calculate categorized vs uncategorized
  const uncategorized = breakdown.otherExpenses + breakdown.unassignedExpenses
  const categorized = data.totalExpenses - uncategorized

  const categorizedPct = data.totalExpenses > 0 ? categorized / data.totalExpenses : 0
  const unknownPct = data.totalExpenses > 0 ? uncategorized / data.totalExpenses : 0

  // Metric 1: Categorized Percentage - 60%
  let categorizedScore: number
  if (categorizedPct >= 0.90) categorizedScore = 95
  else if (categorizedPct >= 0.80) categorizedScore = 82
  else if (categorizedPct >= 0.70) categorizedScore = 67
  else if (categorizedPct >= 0.50) categorizedScore = 50
  else categorizedScore = 30

  // Metric 2: Unknown/Other Penalty - 40%
  let unknownScore: number
  if (unknownPct <= 0.05) unknownScore = 95
  else if (unknownPct <= 0.10) unknownScore = 82
  else if (unknownPct <= 0.20) unknownScore = 67
  else if (unknownPct <= 0.30) unknownScore = 50
  else unknownScore = 30

  const finalScore = Math.round(categorizedScore * 0.60 + unknownScore * 0.40)

  return {
    name: 'Expense Categorization',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Categorized', value: categorizedPct, formattedValue: formatPercent(categorizedPct), weight: 0.60, interpretation: categorizedPct >= 0.80 ? 'Transparent' : 'Opaque' },
      { name: 'Unknown/Other', value: unknownPct, formattedValue: formatPercent(unknownPct), weight: 0.40 },
    ],
  }
}

// ============================================================================
// 4. FIXED VS VARIABLE SCORE (Weight: 15%)
// ============================================================================

function calculateFixedVsVariableScore(data: ExpenseData): SubsectionScore {
  const breakdown = data.expenseBreakdown

  // Fixed expenses
  const fixedExpenses = breakdown.rent + breakdown.recurring + breakdown.insurance +
    breakdown.softwareSubscriptions + breakdown.utilities + (breakdown.payroll * 0.7) // Assume 70% of payroll is fixed

  // Variable expenses
  const variableExpenses = data.totalExpenses - fixedExpenses - data.mcaPayments

  // Metric 1: Fixed Expense Ratio - 40%
  const fixedRatio = data.totalExpenses > 0 ? fixedExpenses / (data.totalExpenses - data.mcaPayments) : 0

  let fixedScore: number
  if (fixedRatio < 0.30) fixedScore = 95      // Very flexible
  else if (fixedRatio < 0.45) fixedScore = 80
  else if (fixedRatio < 0.60) fixedScore = 65
  else if (fixedRatio < 0.75) fixedScore = 45
  else fixedScore = 25                         // Rigid cost structure

  // Metric 2: Fixed Coverage (Revenue / Fixed Expenses) - 35%
  const fixedCoverage = fixedExpenses > 0 ? data.totalRevenue / fixedExpenses : 99

  let coverageScore: number
  if (fixedCoverage >= 4) coverageScore = 95
  else if (fixedCoverage >= 3) coverageScore = 80
  else if (fixedCoverage >= 2) coverageScore = 65
  else if (fixedCoverage >= 1.5) coverageScore = 50
  else coverageScore = 30

  // Metric 3: Flexibility Index (variable expenses that could be cut) - 25%
  const discretionaryExpenses = breakdown.travelEntertainment + breakdown.marketing +
    breakdown.otherExpenses + breakdown.businessExpenses
  const flexibilityRatio = data.totalExpenses > 0 ? discretionaryExpenses / data.totalExpenses : 0

  let flexibilityScore: number
  if (flexibilityRatio >= 0.25) flexibilityScore = 95   // Lots of room to cut
  else if (flexibilityRatio >= 0.15) flexibilityScore = 75
  else if (flexibilityRatio >= 0.10) flexibilityScore = 60
  else flexibilityScore = 45

  const finalScore = Math.round(fixedScore * 0.40 + coverageScore * 0.35 + flexibilityScore * 0.25)

  return {
    name: 'Fixed vs Variable',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Fixed Expense Ratio', value: fixedRatio, formattedValue: formatPercent(fixedRatio), weight: 0.40, interpretation: fixedRatio < 0.50 ? 'Flexible' : 'Rigid' },
      { name: 'Fixed Coverage', value: fixedCoverage, formattedValue: `${fixedCoverage.toFixed(1)}x`, weight: 0.35 },
      { name: 'Flexibility Index', value: flexibilityRatio, formattedValue: formatPercent(flexibilityRatio), weight: 0.25 },
    ],
  }
}

// ============================================================================
// 5. OWNER DRAW SCORE (Weight: 15%)
// ============================================================================

function calculateOwnerDrawScore(data: ExpenseData): SubsectionScore {
  const redFlags: RedFlagDetail[] = []

  // Metric 1: Draw Ratio (Owner Draws / Net Income) - 50%
  const drawRatio = data.netIncome > 0 ? data.ownerDraws / data.netIncome : (data.ownerDraws > 0 ? 2 : 0)

  let drawScore: number
  if (drawRatio <= 0) drawScore = 95          // No draws or negative income with no draws
  else if (drawRatio < 0.30) drawScore = 90
  else if (drawRatio < 0.50) drawScore = 77
  else if (drawRatio < 0.70) drawScore = 62
  else if (drawRatio <= 1.0) drawScore = 47
  else drawScore = 25                          // Drawing more than profit

  // Metric 2: Draw Consistency - 25%
  const monthlyDraws = data.monthlyData.map(m => m.expenses.ownerDraws || 0)
  const drawCV = calculateCV(monthlyDraws.filter(d => d > 0))

  let consistencyScore: number
  if (data.ownerDraws === 0) consistencyScore = 100  // No draws = perfect
  else if (drawCV < 20) consistencyScore = 85
  else if (drawCV < 40) consistencyScore = 70
  else if (drawCV < 60) consistencyScore = 55
  else consistencyScore = 40

  // Metric 3: Draw vs MCA (Owner draws relative to MCA payments) - 25%
  let mcaCompareScore: number
  if (data.mcaPayments === 0) {
    mcaCompareScore = 100  // No MCA, no concern
  } else if (data.ownerDraws <= data.mcaPayments * 0.5) {
    mcaCompareScore = 90   // Prioritizing MCA over draws
  } else if (data.ownerDraws <= data.mcaPayments) {
    mcaCompareScore = 70
  } else {
    mcaCompareScore = 40   // Drawing more than MCA payments
    redFlags.push({
      type: 'DRAWS_EXCEED_MCA',
      severity: 'MEDIUM',
      description: `Owner draws (${formatCurrency(data.ownerDraws)}) exceed MCA payments (${formatCurrency(data.mcaPayments)})`,
      pointsDeducted: 10,
    })
  }

  const finalScore = Math.round(drawScore * 0.50 + consistencyScore * 0.25 + mcaCompareScore * 0.25)

  return {
    name: 'Owner Draw',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Draw / Net Income', value: drawRatio, formattedValue: drawRatio > 0 ? formatPercent(drawRatio) : 'N/A', weight: 0.50, interpretation: drawRatio < 0.50 ? 'Conservative' : 'Aggressive' },
      { name: 'Draw Consistency', value: drawCV, formattedValue: data.ownerDraws > 0 ? `${drawCV.toFixed(1)}% CV` : 'N/A', weight: 0.25 },
      { name: 'Draw vs MCA', value: data.mcaPayments > 0 ? data.ownerDraws / data.mcaPayments : 0, formattedValue: data.mcaPayments > 0 ? `${(data.ownerDraws / data.mcaPayments).toFixed(2)}x` : 'N/A', weight: 0.25 },
    ],
    redFlags: redFlags.length > 0 ? redFlags : undefined,
  }
}

// ============================================================================
// 6. EXPENSE RED FLAGS SCORE (Weight: 15%)
// ============================================================================

function calculateExpenseRedFlagsScore(data: ExpenseData): SubsectionScore {
  let baseScore = 100
  const redFlags: RedFlagDetail[] = []

  // Check for gambling transactions
  for (const t of data.transactions.filter(t => t.type === 'DEBIT')) {
    const desc = t.description.toLowerCase()

    // Gambling
    if (EXPENSE_RED_FLAG_PATTERNS.GAMBLING.some(p => p.test(desc))) {
      baseScore -= 25
      redFlags.push({
        type: 'GAMBLING',
        severity: 'CRITICAL',
        description: `Gambling transaction detected: ${t.description}`,
        pointsDeducted: 25,
        date: new Date(t.date),
      })
      break // Only penalize once
    }

    // Cash advances
    if (EXPENSE_RED_FLAG_PATTERNS.CASH_ADVANCE.some(p => p.test(desc))) {
      baseScore -= 15
      redFlags.push({
        type: 'CASH_ADVANCE',
        severity: 'HIGH',
        description: `Cash advance detected: ${t.description}`,
        pointsDeducted: 15,
        date: new Date(t.date),
      })
      break
    }

    // Collection agency
    if (EXPENSE_RED_FLAG_PATTERNS.COLLECTION.some(p => p.test(desc))) {
      baseScore -= 20
      redFlags.push({
        type: 'COLLECTION',
        severity: 'CRITICAL',
        description: `Collection agency payment: ${t.description}`,
        pointsDeducted: 20,
        date: new Date(t.date),
      })
      break
    }
  }

  // Check for excessive ATM withdrawals (>$5K/month avg)
  const atmWithdrawals = data.expenseBreakdown.atmWithdrawals
  const monthlyATM = atmWithdrawals / data.monthsAnalyzed
  if (monthlyATM > 5000) {
    baseScore -= 15
    redFlags.push({
      type: 'EXCESSIVE_ATM',
      severity: 'HIGH',
      description: `Avg ATM withdrawals ${formatCurrency(monthlyATM)}/month exceeds $5,000`,
      pointsDeducted: 15,
    })
  }

  // Check for large crypto/trading transactions
  let cryptoTotal = 0
  for (const t of data.transactions.filter(t => t.type === 'DEBIT')) {
    if (EXPENSE_RED_FLAG_PATTERNS.CRYPTO.some(p => p.test(t.description))) {
      cryptoTotal += t.amount
    }
  }
  if (cryptoTotal > 5000) {
    baseScore -= 10
    redFlags.push({
      type: 'CRYPTO_TRADING',
      severity: 'MEDIUM',
      description: `Crypto/trading activity: ${formatCurrency(cryptoTotal)}`,
      pointsDeducted: 10,
    })
  }

  // Check for late payment fees
  let lateFees = 0
  for (const t of data.transactions.filter(t => t.type === 'DEBIT')) {
    if (/late\s*(fee|payment|charge)|past\s*due/i.test(t.description)) {
      lateFees += t.amount
    }
  }
  if (lateFees > 500) {
    baseScore -= 10
    redFlags.push({
      type: 'LATE_FEES',
      severity: 'MEDIUM',
      description: `Late payment fees: ${formatCurrency(lateFees)}`,
      pointsDeducted: 10,
    })
  }

  const finalScore = clamp(baseScore, 0, 100)

  return {
    name: 'Expense Red Flags',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Red Flags Found', value: redFlags.length, formattedValue: `${redFlags.length}`, weight: 1.0, interpretation: redFlags.length === 0 ? 'None' : 'Review needed' },
    ],
    redFlags,
  }
}

// ============================================================================
// 7. EXPENSE TREND SCORE (Weight: 10%)
// ============================================================================

function calculateExpenseTrendScore(data: ExpenseData): SubsectionScore {
  const monthlyExpenses = data.monthlyData.map(m => m.expenses.total)
  const monthlyRevenues = data.monthlyData.map(m => m.revenue.total)

  // Metric 1: Expense Growth Rate (vs Revenue Growth) - 40%
  const midpoint = Math.floor(monthlyExpenses.length / 2)

  const firstHalfExpense = monthlyExpenses.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint
  const secondHalfExpense = monthlyExpenses.slice(midpoint).reduce((a, b) => a + b, 0) / (monthlyExpenses.length - midpoint)
  const expenseGrowth = firstHalfExpense > 0 ? (secondHalfExpense - firstHalfExpense) / firstHalfExpense : 0

  const firstHalfRevenue = monthlyRevenues.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint
  const secondHalfRevenue = monthlyRevenues.slice(midpoint).reduce((a, b) => a + b, 0) / (monthlyRevenues.length - midpoint)
  const revenueGrowth = firstHalfRevenue > 0 ? (secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue : 0

  // Expense vs Revenue Growth Differential
  const growthDiff = expenseGrowth - revenueGrowth

  let growthScore: number
  if (growthDiff < -0.10) growthScore = 95    // Expenses growing slower than revenue
  else if (growthDiff < 0) growthScore = 80
  else if (growthDiff < 0.10) growthScore = 65
  else if (growthDiff < 0.25) growthScore = 45
  else growthScore = 25

  // Metric 2: Most Recent Month Expense - 40%
  const recentExpense = monthlyExpenses[monthlyExpenses.length - 1]
  const avgExpense = data.avgMonthlyExpenses
  const recentRatio = avgExpense > 0 ? recentExpense / avgExpense : 1

  let recentScore: number
  if (recentRatio <= 0.8) recentScore = 95     // Recent month lower than avg
  else if (recentRatio <= 1.0) recentScore = 80
  else if (recentRatio <= 1.15) recentScore = 65
  else if (recentRatio <= 1.3) recentScore = 45
  else recentScore = 25

  // Metric 3: Trend Direction - 20%
  let trendScore: number
  if (expenseGrowth < -0.10) trendScore = 95   // Expenses decreasing
  else if (expenseGrowth < 0) trendScore = 80
  else if (expenseGrowth < 0.10) trendScore = 65
  else if (expenseGrowth < 0.20) trendScore = 45
  else trendScore = 25

  const finalScore = Math.round(growthScore * 0.40 + recentScore * 0.40 + trendScore * 0.20)

  const trendDirection = growthDiff < 0 ? 'Favorable' : growthDiff > 0.10 ? 'Unfavorable' : 'Neutral'

  return {
    name: 'Expense Trend',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Expense vs Revenue Growth', value: growthDiff, formattedValue: `${(growthDiff * 100).toFixed(1)}%`, weight: 0.40, interpretation: trendDirection },
      { name: 'Recent Month vs Avg', value: recentRatio, formattedValue: `${(recentRatio * 100).toFixed(0)}%`, weight: 0.40 },
      { name: 'Expense Growth', value: expenseGrowth, formattedValue: formatPercent(expenseGrowth), weight: 0.20 },
    ],
  }
}

// ============================================================================
// MAIN EXPORT: Calculate Expense Quality Section
// ============================================================================

export function calculateExpenseQualitySection(
  transactions: Transaction[],
  monthlyData: MonthlyMetrics[],
  totalExpenses: number,
  totalRevenue: number,
  avgMonthlyExpenses: number,
  expenseBreakdown: ExpenseBreakdown,
  mcaPayments: number,
  ownerDraws: number
): SectionScore {
  const netIncome = totalRevenue - totalExpenses

  const data: ExpenseData = {
    transactions,
    monthlyData,
    totalExpenses,
    totalRevenue,
    avgMonthlyExpenses,
    expenseBreakdown,
    monthsAnalyzed: monthlyData.length,
    mcaPayments,
    ownerDraws,
    netIncome,
  }

  // Calculate all subsections
  const subsections: SubsectionScore[] = [
    calculateExpenseRatioScore(data),
    calculateExpenseStabilityScore(data),
    calculateExpenseCategorizationScore(data),
    calculateFixedVsVariableScore(data),
    calculateOwnerDrawScore(data),
    calculateExpenseRedFlagsScore(data),
    calculateExpenseTrendScore(data),
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
    name: 'Expense Quality',
    score: sectionScore,
    rating: scoreToRating(sectionScore),
    weight: 0.25,
    subsections,
  }
}
