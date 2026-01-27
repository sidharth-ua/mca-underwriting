/**
 * Agentic Scorecard Types
 *
 * Types for LLM-based qualitative assessments that complement the deterministic scorecard.
 */

// ============================================================================
// DIMENSION ASSESSMENT (used by all agentic subsections)
// ============================================================================

export interface DimensionAssessment {
  name: string
  observedPatterns: string
  implications: string
  score: number  // 1-100
  weight: number // Percentage, e.g., 15 for 15%
  justification: string
}

// ============================================================================
// RED FLAG (used by all agentic assessments)
// ============================================================================

export interface AgenticRedFlag {
  description: string
  reason: string  // Why it threatens predictability/stability
  severity: 'Low' | 'Moderate' | 'High'
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export interface AuditTrail {
  model: string
  processingTimeMs: number
  transactionCount: number
  dateRange: {
    start: string
    end: string
  }
  promptTokens?: number
  completionTokens?: number
}

// ============================================================================
// BASE AGENTIC SCORE INTERFACE
// ============================================================================

export interface BaseAgenticScore {
  redFlags: AgenticRedFlag[]
  aggregation: {
    preDeductionScore: number
    redFlagDeduction: number
    finalScore: number
    riskRating: 1 | 2 | 3 | 4 | 5
  }
  overallJustification: string
  confidence: 'High' | 'Medium' | 'Low'
  confidenceJustification: string
  generatedAt: string
  auditTrail?: AuditTrail
}

// ============================================================================
// REVENUE STABILITY AGENTIC SCORECARD (20% weight)
// ============================================================================

export interface RevenueStabilityAgenticScore extends BaseAgenticScore {
  dimensions: {
    weeklyRevenueMagnitudeVolatility: DimensionAssessment
    monthToMonthRevenueDispersion: DimensionAssessment
    robustWeeklyDispersion: DimensionAssessment
    typicalDeviationFromNormal: DimensionAssessment
    weekOverWeekPersistence: DimensionAssessment
    directionalStability: DimensionAssessment
    normalizedWeeklyVariability: DimensionAssessment
    regularityOfRevenueTiming: DimensionAssessment
    dependenceOnExtremeRevenueDays: DimensionAssessment
    smoothedShortTermInstability: DimensionAssessment
  }
}

// ============================================================================
// REVENUE DURABILITY AGENTIC SCORECARD (15% weight)
// ============================================================================

export interface RevenueDurabilityAgenticScore extends BaseAgenticScore {
  dimensions: {
    nonOperatingDepositReliance: DimensionAssessment
    mcaLoanFundingDependency: DimensionAssessment
    internalTransferActivity: DimensionAssessment
    coreRevenueReplacementBehavior: DimensionAssessment
    repeatSourceRevenuePersistence: DimensionAssessment
    revenueSourceSurvivalRate: DimensionAssessment
    newSourceDependencyRisk: DimensionAssessment
    coreRevenueRetention: DimensionAssessment
    revenueCarryoverStrength: DimensionAssessment
    operatingRevenueQuality: DimensionAssessment
  }
}

// ============================================================================
// REVENUE TREND & MOMENTUM AGENTIC SCORECARD (15% weight)
// ============================================================================

export interface RevenueTrendAgenticScore extends BaseAgenticScore {
  dimensions: {
    logRevenueTrajectory: DimensionAssessment
    growthConsistencyPattern: DimensionAssessment
    downsideMovementSeverity: DimensionAssessment
    directionalStability: DimensionAssessment
    accelerationDecelerationSignal: DimensionAssessment
    recoveryCapability: DimensionAssessment
    trendReversalRisk: DimensionAssessment
    momentumSustainability: DimensionAssessment
    seasonalPatternRecognition: DimensionAssessment
    growthQualityAssessment: DimensionAssessment
  }
}

// ============================================================================
// REVENUE CONCENTRATION AGENTIC SCORECARD (15% weight)
// ============================================================================

export interface RevenueConcentrationAgenticScore extends BaseAgenticScore {
  dimensions: {
    topSourceDominance: DimensionAssessment
    revenueSourceDiversity: DimensionAssessment
    temporalRevenueConcentration: DimensionAssessment
    oneTimeSourceDependency: DimensionAssessment
    customerChannelDiversification: DimensionAssessment
    revenueChannelMixHealth: DimensionAssessment
    geographicIndustryExposure: DimensionAssessment
    singlePointOfFailureRisk: DimensionAssessment
    concentrationTrendDirection: DimensionAssessment
    diversificationQuality: DimensionAssessment
  }
}

// ============================================================================
// REVENUE SUFFICIENCY AGENTIC SCORECARD (35% weight)
// ============================================================================

export interface RevenueSufficiencyAgenticScore extends BaseAgenticScore {
  dimensions: {
    monthlyCoverageAdequacy: DimensionAssessment
    worstPeriodCoverage: DimensionAssessment
    coverageConsistency: DimensionAssessment
    revenueGapRisk: DimensionAssessment
    paymentStressFrequency: DimensionAssessment
    paymentCoverageReliability: DimensionAssessment
    consecutiveShortfallRisk: DimensionAssessment
    cashCushionAdequacy: DimensionAssessment
    stressTestResilience: DimensionAssessment
    paymentCapacityMargin: DimensionAssessment
  }
}

// ============================================================================
// AGENTIC SUBSECTION TYPE
// ============================================================================

export type AgenticSubsectionType =
  | 'revenue-stability'
  | 'revenue-durability'
  | 'revenue-trend'
  | 'revenue-concentration'
  | 'revenue-sufficiency'

// ============================================================================
// AGENT WEIGHTS (must sum to 100)
// ============================================================================

export const AGENT_WEIGHTS: Record<AgenticSubsectionType, number> = {
  'revenue-stability': 20,
  'revenue-durability': 15,
  'revenue-trend': 15,
  'revenue-concentration': 15,
  'revenue-sufficiency': 35,
}

// ============================================================================
// AGENT LABELS
// ============================================================================

export const AGENT_LABELS: Record<AgenticSubsectionType, string> = {
  'revenue-stability': 'Revenue Stability',
  'revenue-durability': 'Revenue Durability',
  'revenue-trend': 'Revenue Trend & Momentum',
  'revenue-concentration': 'Revenue Concentration',
  'revenue-sufficiency': 'Revenue Sufficiency',
}

// ============================================================================
// LEGACY AGENTIC SCORECARD (for backwards compatibility)
// ============================================================================

export interface AgenticScorecard {
  revenueStability?: RevenueStabilityAgenticScore
  revenueDurability?: RevenueDurabilityAgenticScore
  revenueTrend?: RevenueTrendAgenticScore
  revenueConcentration?: RevenueConcentrationAgenticScore
  revenueSufficiency?: RevenueSufficiencyAgenticScore
  generatedAt: string
  dealId: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
}

// ============================================================================
// FULL AGENTIC SCORECARD (with aggregation)
// ============================================================================

export interface FullAgenticScorecard {
  dealId: string
  generatedAt: string
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'error'

  // Individual agent results
  revenueStability?: RevenueStabilityAgenticScore
  revenueDurability?: RevenueDurabilityAgenticScore
  revenueTrend?: RevenueTrendAgenticScore
  revenueConcentration?: RevenueConcentrationAgenticScore
  revenueSufficiency?: RevenueSufficiencyAgenticScore

  // Aggregated results
  aggregatedScore?: {
    weightedScore: number  // 0-100
    recommendation: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW'
    recommendationReason: string
    agentScores: {
      section: AgenticSubsectionType
      score: number
      weight: number
      weightedContribution: number
    }[]
    keyFindings: string[]
    criticalConcerns: string[]
  }

  // Processing metadata
  processingDetails?: {
    totalProcessingTimeMs: number
    agentsSucceeded: AgenticSubsectionType[]
    agentsFailed: AgenticSubsectionType[]
    errors: { section: AgenticSubsectionType; error: string }[]
  }

  error?: string
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface AgenticScorecardRequest {
  dealId: string
  sections?: AgenticSubsectionType[]  // If not provided, generates all
  regenerate?: AgenticSubsectionType  // If provided, regenerates only this section
}

export interface AgenticScorecardResponse {
  success: boolean
  scorecard?: FullAgenticScorecard
  error?: string
}

// ============================================================================
// TRANSACTION DATA FOR AGENTIC ASSESSMENT
// (Enriched fields as specified in the PDF prompt)
// ============================================================================

export interface EnrichedTransaction {
  date: string
  description: string
  amount: number
  balance: number
  category: string | null
  subcategory: string | null
  // Enriched fields for agentic assessment
  coreRevenueInflow: boolean
  nonOperatingDepositInflow: boolean
  mcaOrLoanInflow: boolean
  internalCircularTransfer: boolean
  coreRevenueSourceName: string | null
}
