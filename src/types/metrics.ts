export type StackingStatus = 'CLEAN' | 'STACKED' | 'HEAVY'

export type RiskTier = 'A' | 'B' | 'C' | 'D'

export type Verdict = 'APPROVE' | 'CAUTION' | 'DECLINE'

export interface DealMetrics {
  id: string
  dealId: string

  // Revenue metrics
  totalRevenue?: number | null
  averageMonthlyRevenue?: number | null
  revenueTrend?: number | null
  revenueConsistency?: number | null

  // Expense metrics
  totalExpenses?: number | null
  expenseToRevenueRatio?: number | null
  ownerWithdrawals?: number | null

  // MCA/Debt metrics
  activeMcaCount?: number | null
  dailyMcaObligation?: number | null
  debtToRevenueRatio?: number | null
  stackingStatus?: StackingStatus | null

  // Risk metrics
  nsfCount?: number | null
  negativeBalanceDays?: number | null
  lowestBalance?: number | null
  redFlagCount?: number | null

  // Scores (0-100)
  revenueScore?: number | null
  expenseScore?: number | null
  debtScore?: number | null
  riskScore?: number | null
  overallScore?: number | null

  // Risk tier and verdict
  riskTier?: RiskTier | null
  verdict?: Verdict | null

  createdAt: string
  updatedAt: string
}

export interface RevenueMetrics {
  totalRevenue: number
  averageMonthlyRevenue: number
  revenueTrend: number
  revenueConsistency: number
  revenueByMonth: Record<string, number>
  revenueByCategory: Record<string, number>
}

export interface ExpenseMetrics {
  totalExpenses: number
  expenseToRevenueRatio: number
  ownerWithdrawals: number
  expensesByCategory: Record<string, number>
}

export interface McaMetrics {
  activeMcaCount: number
  dailyMcaObligation: number
  debtToRevenueRatio: number
  stackingStatus: StackingStatus
  mcaPayments: Array<{
    funder: string
    amount: number
    frequency: string
  }>
}

export interface RiskMetrics {
  nsfCount: number
  negativeBalanceDays: number
  lowestBalance: number
  redFlagCount: number
  redFlags: string[]
}

export interface Scores {
  revenueScore: number
  expenseScore: number
  debtScore: number
  riskScore: number
  overallScore: number
  riskTier: RiskTier
  verdict: Verdict
}

// Risk tier thresholds
export const RISK_TIER_THRESHOLDS = {
  A: 80, // Score >= 80
  B: 65, // Score 65-79
  C: 50, // Score 50-64
  D: 0,  // Score < 50
} as const

// Red flag triggers
export const RED_FLAG_THRESHOLDS = {
  nsfCountMax: 5,           // NSF count > 5 in 90 days
  negativeBalanceDaysMax: 10, // Negative balance > 10 days
  debtToRevenueRatioMax: 0.30, // Debt-to-revenue ratio > 30%
  revenueDeclineMax: 0.20,    // Revenue decline > 20%
  ownerWithdrawalsMax: 0.25,  // Owner withdrawals > 25% of revenue
} as const
