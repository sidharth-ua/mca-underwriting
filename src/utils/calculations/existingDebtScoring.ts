/**
 * Existing Debt Impact Scoring Module (MCA Analysis)
 *
 * 6 Subsections:
 * 1. MCA Position Count Score (20%)
 * 2. MCA Burden Score (25%)
 * 3. MCA Payment Consistency Score (15%)
 * 4. MCA Stacking Score (20%)
 * 5. MCA Velocity Score (10%)
 * 6. MCA Red Flags Score (10%)
 */

import {
  SubsectionScore,
  SectionScore,
  RedFlagDetail,
  scoreToRating,
  clamp,
  formatCurrency,
  formatPercent,
  countBusinessDays,
} from './scoringFramework'
import type { Transaction, MonthlyMetrics, MCAMetrics, MCADetail } from './metricsCalculator'

interface MCAData {
  transactions: Transaction[]
  monthlyData: MonthlyMetrics[]
  mcaMetrics: MCAMetrics & {
    monthlyRepayment: number
    paymentToRevenueRatio: number
    stackingIndicator: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  }
  totalRevenue: number
  totalExpenses: number
  mcaPayments: number
  mcaFunding: number
  monthsAnalyzed: number
  periodStart: Date
  periodEnd: Date
}

interface StackingEvent {
  type: 'STACKING' | 'REFINANCE' | 'MULTIPLE_SAME_DAY'
  date: Date
  lender: string
  activeAtTime: number
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL'
  daysSinceLast?: number
}

// ============================================================================
// HELPER: Detect Active MCAs at a given date
// ============================================================================

function countActiveAtDate(
  activeMCAs: Map<string, { lastPayment: Date; fundingDate?: Date }>,
  checkDate: Date
): number {
  let count = 0
  const checkTime = checkDate.getTime()

  for (const [, status] of activeMCAs) {
    const daysSincePayment = (checkTime - status.lastPayment.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSincePayment <= 30) {
      count++
    }
  }

  return count
}

// ============================================================================
// 1. MCA POSITION COUNT SCORE (Weight: 20%)
// ============================================================================

function calculateMCAPositionCountScore(data: MCAData): SubsectionScore {
  const activeMCAs = data.mcaMetrics.uniqueMCACount

  let score: number
  let interpretation: string

  if (activeMCAs === 0) {
    score = 100
    interpretation = 'No existing MCA debt'
  } else if (activeMCAs === 1) {
    score = 85
    interpretation = 'Single position, manageable'
  } else if (activeMCAs === 2) {
    score = 67
    interpretation = 'Two positions, moderate concern'
  } else if (activeMCAs === 3) {
    score = 47
    interpretation = 'Three positions, high concern'
  } else {
    score = 20
    interpretation = 'Heavy stacking, very high risk'
  }

  return {
    name: 'MCA Position Count',
    score,
    rating: scoreToRating(score),
    weight: 0.20,
    metrics: [
      { name: 'Active MCAs', value: activeMCAs, formattedValue: `${activeMCAs}`, weight: 1.0, interpretation },
      { name: 'MCA Names', value: data.mcaMetrics.mcaNames.length, formattedValue: data.mcaMetrics.mcaNames.join(', ') || 'None', weight: 0 },
    ],
  }
}

// ============================================================================
// 2. MCA BURDEN SCORE (Weight: 25%)
// ============================================================================

function calculateMCABurdenScore(data: MCAData): SubsectionScore {
  // Metric 1: MCA-to-Revenue Ratio - 50%
  const mcaRevenueRatio = data.totalRevenue > 0 ? data.mcaPayments / data.totalRevenue : 0

  let ratioScore: number
  if (mcaRevenueRatio === 0) ratioScore = 100
  else if (mcaRevenueRatio < 0.10) ratioScore = 87
  else if (mcaRevenueRatio < 0.20) ratioScore = 70
  else if (mcaRevenueRatio < 0.30) ratioScore = 50
  else ratioScore = 25

  // Metric 2: Daily MCA Burden - 30%
  const businessDays = countBusinessDays(data.periodStart, data.periodEnd)
  const dailyMCA = businessDays > 0 ? data.mcaPayments / businessDays : 0
  const dailyDeposits = businessDays > 0 ? data.totalRevenue / businessDays : 0
  const dailyBurden = dailyDeposits > 0 ? dailyMCA / dailyDeposits : 0

  let dailyScore: number
  if (dailyMCA === 0) dailyScore = 100
  else if (dailyBurden < 0.10) dailyScore = 85
  else if (dailyBurden < 0.20) dailyScore = 70
  else if (dailyBurden < 0.30) dailyScore = 50
  else dailyScore = 25

  // Metric 3: MCA Coverage ((Revenue - OpEx) / MCA) - 20%
  const operatingExpenses = data.totalExpenses - data.mcaPayments
  const operatingSurplus = data.totalRevenue - operatingExpenses
  const mcaCoverage = data.mcaPayments > 0 ? operatingSurplus / data.mcaPayments : 999

  let coverageScore: number
  if (data.mcaPayments === 0) coverageScore = 100
  else if (mcaCoverage >= 3) coverageScore = 95
  else if (mcaCoverage >= 2) coverageScore = 80
  else if (mcaCoverage >= 1.5) coverageScore = 65
  else if (mcaCoverage >= 1) coverageScore = 50
  else coverageScore = 25

  const finalScore = Math.round(ratioScore * 0.50 + dailyScore * 0.30 + coverageScore * 0.20)

  return {
    name: 'MCA Burden',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.25,
    metrics: [
      { name: 'MCA / Revenue', value: mcaRevenueRatio, formattedValue: formatPercent(mcaRevenueRatio), weight: 0.50, interpretation: mcaRevenueRatio < 0.15 ? 'Light' : 'Heavy' },
      { name: 'Daily MCA Burden', value: dailyBurden, formattedValue: formatPercent(dailyBurden), weight: 0.30 },
      { name: 'MCA Coverage', value: mcaCoverage, formattedValue: data.mcaPayments > 0 ? `${mcaCoverage.toFixed(2)}x` : 'N/A', weight: 0.20 },
    ],
  }
}

// ============================================================================
// 3. MCA PAYMENT CONSISTENCY SCORE (Weight: 15%)
// ============================================================================

function calculateMCAPaymentConsistencyScore(data: MCAData): SubsectionScore {
  if (data.mcaPayments === 0 || data.mcaMetrics.paymentCount === 0) {
    return {
      name: 'MCA Payment Consistency',
      score: 100,
      rating: 5,
      weight: 0.15,
      metrics: [
        { name: 'No MCA Payments', value: 0, formattedValue: 'N/A', weight: 1.0, interpretation: 'No MCA debt' },
      ],
    }
  }

  // Get all MCA payment transactions
  const mcaPaymentTxns = data.transactions
    .filter(t => t.type === 'DEBIT' && t.category === 'mca_payment')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Metric 1: Payment Regularity - 50%
  // Detect expected frequency and compare actual vs expected
  const businessDays = countBusinessDays(data.periodStart, data.periodEnd)

  // Assume daily MCA payments (most common)
  // Expected: ~5 payments per week per MCA position
  const expectedPaymentsPerMCA = businessDays
  const expectedTotal = expectedPaymentsPerMCA * Math.max(1, data.mcaMetrics.uniqueMCACount)
  const actualPayments = mcaPaymentTxns.length

  const regularity = Math.min(actualPayments / expectedTotal, 1.0)

  let regularityScore: number
  if (regularity >= 0.95) regularityScore = 95
  else if (regularity >= 0.85) regularityScore = 82
  else if (regularity >= 0.75) regularityScore = 67
  else if (regularity >= 0.60) regularityScore = 50
  else regularityScore = 30

  // Metric 2: Payment Gaps - 30%
  let maxGap = 0
  if (mcaPaymentTxns.length > 1) {
    for (let i = 1; i < mcaPaymentTxns.length; i++) {
      const gap = (new Date(mcaPaymentTxns[i].date).getTime() - new Date(mcaPaymentTxns[i - 1].date).getTime()) / (1000 * 60 * 60 * 24)
      if (gap > maxGap) maxGap = gap
    }
  }

  let gapScore: number
  if (maxGap <= 3) gapScore = 95     // Within expected daily pattern
  else if (maxGap <= 7) gapScore = 80
  else if (maxGap <= 14) gapScore = 60
  else if (maxGap <= 21) gapScore = 40
  else gapScore = 20

  // Metric 3: Payment Amount Consistency - 20%
  const paymentAmounts = mcaPaymentTxns.map(t => t.amount)
  const avgPayment = paymentAmounts.reduce((a, b) => a + b, 0) / paymentAmounts.length
  let amountVariance = 0
  if (avgPayment > 0) {
    const sumSquaredDiff = paymentAmounts.reduce((sum, amt) => sum + Math.pow(amt - avgPayment, 2), 0)
    amountVariance = Math.sqrt(sumSquaredDiff / paymentAmounts.length) / avgPayment
  }

  let amountScore: number
  if (amountVariance < 0.10) amountScore = 95
  else if (amountVariance < 0.20) amountScore = 80
  else if (amountVariance < 0.35) amountScore = 65
  else amountScore = 45

  const finalScore = Math.round(regularityScore * 0.50 + gapScore * 0.30 + amountScore * 0.20)

  return {
    name: 'MCA Payment Consistency',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.15,
    metrics: [
      { name: 'Payment Regularity', value: regularity, formattedValue: formatPercent(regularity), weight: 0.50, interpretation: regularity >= 0.85 ? 'Consistent' : 'Gaps detected' },
      { name: 'Max Payment Gap', value: maxGap, formattedValue: `${maxGap.toFixed(0)} days`, weight: 0.30 },
      { name: 'Amount CV', value: amountVariance, formattedValue: formatPercent(amountVariance), weight: 0.20 },
    ],
  }
}

// ============================================================================
// 4. MCA STACKING SCORE (Weight: 20%)
// ============================================================================

function detectStackingEvents(transactions: Transaction[], periodStart: Date, periodEnd: Date): StackingEvent[] {
  const events: StackingEvent[] = []
  const activeMCAs = new Map<string, { lastPayment: Date; fundingDate?: Date }>()

  // Get MCA disbursals (funding received)
  const disbursals = transactions
    .filter(t => t.type === 'CREDIT' && (t.category === 'mca_funding' || t.category === 'mca_disbursal'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Get all MCA payments to track active positions
  const payments = transactions
    .filter(t => t.type === 'DEBIT' && t.category === 'mca_payment')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Build active MCA map from payments
  for (const payment of payments) {
    // Extract lender from subcategory if available
    const lender = payment.subcategory?.match(/MCA\s*-\s*([A-Za-z0-9]+)/i)?.[1]?.toUpperCase() || 'UNKNOWN_MCA'
    activeMCAs.set(lender, { lastPayment: new Date(payment.date) })
  }

  // Check each disbursal for stacking
  for (const disbursal of disbursals) {
    const disbursalDate = new Date(disbursal.date)
    const lender = disbursal.subcategory?.match(/MCA\s*-\s*([A-Za-z0-9]+)/i)?.[1]?.toUpperCase() || 'UNKNOWN_MCA'

    // Count active MCAs at this date
    const activeCount = countActiveAtDate(activeMCAs, disbursalDate)

    if (activeCount >= 2) {
      events.push({
        type: 'STACKING',
        date: disbursalDate,
        lender,
        activeAtTime: activeCount,
        severity: 'HIGH',
      })
    } else if (activeCount >= 1) {
      events.push({
        type: 'STACKING',
        date: disbursalDate,
        lender,
        activeAtTime: activeCount,
        severity: 'MEDIUM',
      })
    }

    // Check for refinance (same lender, new advance within 60 days)
    const previousFromLender = activeMCAs.get(lender)
    if (previousFromLender?.fundingDate) {
      const daysSinceLast = (disbursalDate.getTime() - previousFromLender.fundingDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLast < 60) {
        events.push({
          type: 'REFINANCE',
          date: disbursalDate,
          lender,
          activeAtTime: activeCount,
          severity: 'MEDIUM',
          daysSinceLast,
        })
      }
    }

    // Update tracking
    activeMCAs.set(lender, { lastPayment: disbursalDate, fundingDate: disbursalDate })
  }

  // Check for multiple disbursals on same day
  const disbursalsByDate = new Map<string, number>()
  for (const d of disbursals) {
    const dateKey = new Date(d.date).toISOString().split('T')[0]
    disbursalsByDate.set(dateKey, (disbursalsByDate.get(dateKey) || 0) + 1)
  }

  for (const [dateStr, count] of disbursalsByDate) {
    if (count > 1) {
      events.push({
        type: 'MULTIPLE_SAME_DAY',
        date: new Date(dateStr),
        lender: 'MULTIPLE',
        activeAtTime: count,
        severity: 'CRITICAL',
      })
    }
  }

  return events
}

function calculateMCAStackingScore(data: MCAData): SubsectionScore {
  const stackingEvents = detectStackingEvents(data.transactions, data.periodStart, data.periodEnd)

  let baseScore = 100
  const redFlags: RedFlagDetail[] = []

  for (const event of stackingEvents) {
    let deduction = 0
    switch (event.type) {
      case 'STACKING':
        deduction = event.activeAtTime >= 2 ? 35 : 20
        break
      case 'REFINANCE':
        deduction = 15
        break
      case 'MULTIPLE_SAME_DAY':
        deduction = 40
        break
    }

    baseScore -= deduction

    redFlags.push({
      type: event.type,
      severity: event.severity,
      description: event.type === 'STACKING'
        ? `New MCA from ${event.lender} while ${event.activeAtTime} other(s) active`
        : event.type === 'REFINANCE'
        ? `Refinance with ${event.lender} within ${event.daysSinceLast} days`
        : `Multiple disbursals on same day`,
      pointsDeducted: deduction,
      date: event.date,
    })
  }

  // Bonus for clean history
  if (stackingEvents.length === 0 && data.mcaMetrics.uniqueMCACount <= 1) {
    baseScore = Math.min(baseScore + 10, 100)
  }

  const finalScore = clamp(baseScore, 0, 100)

  return {
    name: 'MCA Stacking',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.20,
    metrics: [
      { name: 'Stacking Events', value: stackingEvents.length, formattedValue: `${stackingEvents.length}`, weight: 0.50, interpretation: stackingEvents.length === 0 ? 'None detected' : 'Stacking detected' },
      { name: 'Stacking Indicator', value: 0, formattedValue: data.mcaMetrics.stackingIndicator, weight: 0.50 },
    ],
    redFlags: redFlags.length > 0 ? redFlags : undefined,
  }
}

// ============================================================================
// 5. MCA VELOCITY SCORE (Weight: 10%)
// ============================================================================

function calculateMCAVelocityScore(data: MCAData): SubsectionScore {
  // Get disbursals in period
  const disbursals = data.transactions.filter(
    t => t.type === 'CREDIT' && (t.category === 'mca_funding' || t.category === 'mca_disbursal')
  )

  // Metric 1: Disbursals per Year (annualized) - 50%
  const disbursalCount = disbursals.length
  const annualizedDisbursals = disbursalCount * (12 / data.monthsAnalyzed)

  let velocityScore: number
  if (annualizedDisbursals <= 1) velocityScore = 95
  else if (annualizedDisbursals <= 2) velocityScore = 82
  else if (annualizedDisbursals <= 4) velocityScore = 67
  else if (annualizedDisbursals <= 6) velocityScore = 50
  else velocityScore = 30

  // Metric 2: Acceleration (first half vs second half) - 30%
  const midpoint = new Date((data.periodStart.getTime() + data.periodEnd.getTime()) / 2)
  const firstHalfDisbursals = disbursals.filter(d => new Date(d.date) < midpoint).length
  const secondHalfDisbursals = disbursals.filter(d => new Date(d.date) >= midpoint).length

  let accelerationScore: number
  if (secondHalfDisbursals < firstHalfDisbursals) {
    accelerationScore = 90  // Slowing down - good
  } else if (secondHalfDisbursals === firstHalfDisbursals) {
    accelerationScore = 70  // Stable
  } else if (secondHalfDisbursals <= firstHalfDisbursals + 1) {
    accelerationScore = 55  // Slight increase
  } else {
    accelerationScore = 35  // Accelerating - concerning
  }

  // Metric 3: Total MCA Funding vs Revenue - 20%
  const fundingRatio = data.totalRevenue > 0 ? data.mcaFunding / data.totalRevenue : 0

  let fundingScore: number
  if (fundingRatio === 0) fundingScore = 100
  else if (fundingRatio < 0.20) fundingScore = 80
  else if (fundingRatio < 0.40) fundingScore = 60
  else fundingScore = 35

  const finalScore = Math.round(velocityScore * 0.50 + accelerationScore * 0.30 + fundingScore * 0.20)

  return {
    name: 'MCA Velocity',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Annualized Disbursals', value: annualizedDisbursals, formattedValue: `${annualizedDisbursals.toFixed(1)}/year`, weight: 0.50, interpretation: annualizedDisbursals <= 2 ? 'Occasional' : 'Frequent' },
      { name: 'Acceleration', value: secondHalfDisbursals - firstHalfDisbursals, formattedValue: secondHalfDisbursals > firstHalfDisbursals ? 'Increasing' : 'Stable/Decreasing', weight: 0.30 },
      { name: 'Funding/Revenue', value: fundingRatio, formattedValue: formatPercent(fundingRatio), weight: 0.20 },
    ],
  }
}

// ============================================================================
// 6. MCA RED FLAGS SCORE (Weight: 10%)
// ============================================================================

function calculateMCARedFlagsScore(data: MCAData): SubsectionScore {
  let baseScore = 100
  const redFlags: RedFlagDetail[] = []

  // Get MCA payment transactions
  const mcaPayments = data.transactions.filter(
    t => t.type === 'DEBIT' && t.category === 'mca_payment'
  )

  // Check for MCA payment that caused negative balance
  for (const payment of mcaPayments) {
    if (payment.runningBalance !== undefined && payment.runningBalance < 0) {
      baseScore -= 15
      redFlags.push({
        type: 'MCA_CAUSED_NEGATIVE',
        severity: 'HIGH',
        description: `MCA payment drove balance negative: ${formatCurrency(payment.amount)}`,
        pointsDeducted: 15,
        date: new Date(payment.date),
      })
      break // Only penalize once
    }
  }

  // Check for NSF on MCA payment day (potential returned payment)
  const nsfTransactions = data.transactions.filter(
    t => t.type === 'DEBIT' && (t.category === 'nsf_fee' || t.category === 'nsf')
  )

  for (const nsf of nsfTransactions) {
    const nsfDate = new Date(nsf.date).toISOString().split('T')[0]
    const mcaOnSameDay = mcaPayments.some(
      p => new Date(p.date).toISOString().split('T')[0] === nsfDate
    )

    if (mcaOnSameDay) {
      baseScore -= 25
      redFlags.push({
        type: 'MCA_PAYMENT_NSF',
        severity: 'CRITICAL',
        description: 'NSF on same day as MCA payment - potential returned payment',
        pointsDeducted: 25,
        date: new Date(nsf.date),
      })
      break
    }
  }

  // Check for sudden stop in MCA payments (position might have defaulted)
  if (mcaPayments.length > 10) {
    const sortedPayments = [...mcaPayments].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    const lastPayment = new Date(sortedPayments[sortedPayments.length - 1].date)
    const daysSinceLastPayment = (data.periodEnd.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceLastPayment > 15 && data.mcaMetrics.uniqueMCACount > 0) {
      baseScore -= 20
      redFlags.push({
        type: 'MCA_PAYMENTS_STOPPED',
        severity: 'HIGH',
        description: `No MCA payments in last ${Math.round(daysSinceLastPayment)} days`,
        pointsDeducted: 20,
      })
    }
  }

  // Check for excessive MCA burden (>40% of revenue)
  const burdenRatio = data.totalRevenue > 0 ? data.mcaPayments / data.totalRevenue : 0
  if (burdenRatio > 0.40) {
    baseScore -= 15
    redFlags.push({
      type: 'EXCESSIVE_MCA_BURDEN',
      severity: 'HIGH',
      description: `MCA payments are ${formatPercent(burdenRatio)} of revenue`,
      pointsDeducted: 15,
    })
  }

  const finalScore = clamp(baseScore, 0, 100)

  return {
    name: 'MCA Red Flags',
    score: finalScore,
    rating: scoreToRating(finalScore),
    weight: 0.10,
    metrics: [
      { name: 'Red Flags Found', value: redFlags.length, formattedValue: `${redFlags.length}`, weight: 1.0, interpretation: redFlags.length === 0 ? 'None' : 'Review needed' },
    ],
    redFlags,
  }
}

// ============================================================================
// MAIN EXPORT: Calculate Existing Debt Impact Section
// ============================================================================

export function calculateExistingDebtSection(
  transactions: Transaction[],
  monthlyData: MonthlyMetrics[],
  mcaMetrics: MCAMetrics & {
    monthlyRepayment: number
    paymentToRevenueRatio: number
    stackingIndicator: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  },
  totalRevenue: number,
  totalExpenses: number,
  periodStart: Date,
  periodEnd: Date
): SectionScore {
  const data: MCAData = {
    transactions,
    monthlyData,
    mcaMetrics,
    totalRevenue,
    totalExpenses,
    mcaPayments: mcaMetrics.paymentsTotal,
    mcaFunding: mcaMetrics.fundingReceived,
    monthsAnalyzed: monthlyData.length,
    periodStart,
    periodEnd,
  }

  // Calculate all subsections
  const subsections: SubsectionScore[] = [
    calculateMCAPositionCountScore(data),
    calculateMCABurdenScore(data),
    calculateMCAPaymentConsistencyScore(data),
    calculateMCAStackingScore(data),
    calculateMCAVelocityScore(data),
    calculateMCARedFlagsScore(data),
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
    name: 'Existing Debt Impact',
    score: sectionScore,
    rating: scoreToRating(sectionScore),
    weight: 0.25,
    subsections,
  }
}
