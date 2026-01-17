/**
 * Overall Scorecard Aggregation Module
 *
 * Combines all 4 sections (25% each) into a final scorecard:
 * 1. Revenue Quality
 * 2. Expense Quality
 * 3. Existing Debt Impact
 * 4. Cashflow & Charges
 */

import {
  OverallScorecard,
  SectionScore,
  scoreToRating,
  generateRecommendation,
} from './scoringFramework'
import { calculateRevenueQualitySection } from './revenueQualityScoring'
import { calculateExpenseQualitySection } from './expenseQualityScoring'
import { calculateExistingDebtSection } from './existingDebtScoring'
import { calculateCashflowChargesSection } from './cashflowChargesScoring'
import type {
  Transaction,
  AggregatedMetrics,
  MonthlyMetrics,
  RevenueBreakdown,
  ExpenseBreakdown,
  MCAMetrics,
  NSFMetrics,
  CashFlowMetrics,
} from './metricsCalculator'

// ============================================================================
// INPUT INTERFACE
// ============================================================================

export interface ScorecardInput {
  transactions: Transaction[]
  metrics: AggregatedMetrics
}

// ============================================================================
// MAIN EXPORT: Calculate Overall Scorecard
// ============================================================================

export function calculateOverallScorecard(input: ScorecardInput): OverallScorecard {
  const { transactions, metrics } = input

  // Ensure we have valid date objects
  const periodStart = metrics.periodStart instanceof Date
    ? metrics.periodStart
    : new Date(metrics.periodStart)
  const periodEnd = metrics.periodEnd instanceof Date
    ? metrics.periodEnd
    : new Date(metrics.periodEnd)

  // ============================================================================
  // SECTION 1: Revenue Quality (25%)
  // ============================================================================
  const revenueQuality = calculateRevenueQualitySection(
    transactions,
    metrics.monthlyData,
    metrics.totalRevenue,
    metrics.avgMonthlyRevenue,
    metrics.revenue,
    metrics.revenue.mcaFunding,
    metrics.totalExpenses,
    metrics.mca.paymentsTotal
  )

  // ============================================================================
  // SECTION 2: Expense Quality (25%)
  // ============================================================================
  const expenseQuality = calculateExpenseQualitySection(
    transactions,
    metrics.monthlyData,
    metrics.totalExpenses,
    metrics.totalRevenue,
    metrics.avgMonthlyExpenses,
    metrics.expenses,
    metrics.mca.paymentsTotal,
    metrics.expenses.ownerDraws
  )

  // ============================================================================
  // SECTION 3: Existing Debt Impact (25%)
  // ============================================================================
  const existingDebtImpact = calculateExistingDebtSection(
    transactions,
    metrics.monthlyData,
    metrics.mca,
    metrics.totalRevenue,
    metrics.totalExpenses,
    periodStart,
    periodEnd
  )

  // ============================================================================
  // SECTION 4: Cashflow & Charges (25%)
  // ============================================================================
  const cashflowCharges = calculateCashflowChargesSection(
    transactions,
    metrics.monthlyData,
    metrics.nsf,
    metrics.cashFlow,
    metrics.totalRevenue,
    metrics.totalExpenses,
    metrics.totalDaysAnalyzed,
    periodStart,
    periodEnd
  )

  // ============================================================================
  // CALCULATE OVERALL SCORE (Equal 25% weights)
  // ============================================================================
  const overallScore = Math.round(
    revenueQuality.score * 0.25 +
    expenseQuality.score * 0.25 +
    existingDebtImpact.score * 0.25 +
    cashflowCharges.score * 0.25
  )

  const overallRating = scoreToRating(overallScore)
  const recommendation = generateRecommendation(overallScore)

  return {
    overallScore,
    overallRating,
    recommendation,
    sections: {
      revenueQuality,
      expenseQuality,
      existingDebtImpact,
      cashflowCharges,
    },
    generatedAt: new Date(),
    periodStart,
    periodEnd,
    monthsAnalyzed: metrics.monthsAnalyzed,
  }
}

// ============================================================================
// HELPER: Get Section Summary for Display
// ============================================================================

export interface SectionSummary {
  name: string
  score: number
  rating: number
  ratingLabel: string
  weight: string
  topMetrics: Array<{
    name: string
    value: string
    interpretation?: string
  }>
  redFlagsCount: number
  criticalIssues: string[]
}

export function getSectionSummary(section: SectionScore): SectionSummary {
  const ratingLabels = ['', 'Critical', 'Poor', 'Fair', 'Good', 'Excellent']

  // Collect critical issues from red flags
  const criticalIssues: string[] = []
  let redFlagsCount = 0

  for (const subsection of section.subsections) {
    if (subsection.redFlags) {
      for (const flag of subsection.redFlags) {
        redFlagsCount++
        if (flag.severity === 'CRITICAL' || flag.severity === 'HIGH') {
          criticalIssues.push(flag.description)
        }
      }
    }
  }

  // Get top 3 metrics from subsections
  const topMetrics: SectionSummary['topMetrics'] = []
  for (const subsection of section.subsections.slice(0, 3)) {
    if (subsection.metrics.length > 0) {
      const metric = subsection.metrics[0]
      topMetrics.push({
        name: `${subsection.name}: ${metric.name}`,
        value: metric.formattedValue,
        interpretation: metric.interpretation,
      })
    }
  }

  return {
    name: section.name,
    score: section.score,
    rating: section.rating,
    ratingLabel: ratingLabels[section.rating] || 'Unknown',
    weight: `${(section.weight * 100).toFixed(0)}%`,
    topMetrics,
    redFlagsCount,
    criticalIssues,
  }
}

// ============================================================================
// HELPER: Get Overall Summary for Dashboard
// ============================================================================

export interface OverallSummary {
  score: number
  rating: number
  ratingLabel: string
  recommendation: string
  recommendationColor: string
  recommendationDescription: string
  sections: SectionSummary[]
  totalRedFlags: number
  criticalIssues: string[]
  monthsAnalyzed: number
  periodRange: string
}

export function getOverallSummary(scorecard: OverallScorecard): OverallSummary {
  const ratingLabels = ['', 'Critical', 'Poor', 'Fair', 'Good', 'Excellent']

  const recommendationDetails: Record<string, { color: string; description: string }> = {
    APPROVE: { color: 'green', description: 'Strong candidate for funding' },
    APPROVE_WITH_CONDITIONS: { color: 'blue', description: 'Approvable with additional terms' },
    MANUAL_REVIEW: { color: 'yellow', description: 'Requires underwriter review' },
    DECLINE_SOFT: { color: 'orange', description: 'Not recommended, may reconsider' },
    DECLINE: { color: 'red', description: 'Do not fund' },
  }

  const sections = [
    getSectionSummary(scorecard.sections.revenueQuality),
    getSectionSummary(scorecard.sections.expenseQuality),
    getSectionSummary(scorecard.sections.existingDebtImpact),
    getSectionSummary(scorecard.sections.cashflowCharges),
  ]

  const totalRedFlags = sections.reduce((sum, s) => sum + s.redFlagsCount, 0)
  const criticalIssues = sections.flatMap(s => s.criticalIssues)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  return {
    score: scorecard.overallScore,
    rating: scorecard.overallRating,
    ratingLabel: ratingLabels[scorecard.overallRating] || 'Unknown',
    recommendation: scorecard.recommendation.replace(/_/g, ' '),
    recommendationColor: recommendationDetails[scorecard.recommendation]?.color || 'gray',
    recommendationDescription: recommendationDetails[scorecard.recommendation]?.description || '',
    sections,
    totalRedFlags,
    criticalIssues,
    monthsAnalyzed: scorecard.monthsAnalyzed,
    periodRange: `${formatDate(scorecard.periodStart)} - ${formatDate(scorecard.periodEnd)}`,
  }
}

// ============================================================================
// HELPER: Get Subsection Details for Drill-Down
// ============================================================================

export interface SubsectionDetail {
  name: string
  score: number
  rating: number
  ratingLabel: string
  weight: string
  metrics: Array<{
    name: string
    value: number | string
    formattedValue: string
    weight: string
    interpretation?: string
  }>
  redFlags: Array<{
    type: string
    severity: string
    description: string
    pointsDeducted: number
  }>
}

export function getSubsectionDetails(section: SectionScore): SubsectionDetail[] {
  const ratingLabels = ['', 'Critical', 'Poor', 'Fair', 'Good', 'Excellent']

  return section.subsections.map(sub => ({
    name: sub.name,
    score: sub.score,
    rating: sub.rating,
    ratingLabel: ratingLabels[sub.rating] || 'Unknown',
    weight: `${(sub.weight * 100).toFixed(0)}%`,
    metrics: sub.metrics.map(m => ({
      name: m.name,
      value: m.value,
      formattedValue: m.formattedValue,
      weight: `${(m.weight * 100).toFixed(0)}%`,
      interpretation: m.interpretation,
    })),
    redFlags: (sub.redFlags || []).map(f => ({
      type: f.type,
      severity: f.severity,
      description: f.description,
      pointsDeducted: f.pointsDeducted,
    })),
  }))
}
