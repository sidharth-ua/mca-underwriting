import { create } from 'zustand'

interface Deal {
  id: string
  merchantName: string
  status: string
  decision?: string
  decisionNotes?: string
  createdAt: string
  updatedAt: string
}

interface DealMetrics {
  id: string
  dealId: string
  totalRevenue?: number
  averageMonthlyRevenue?: number
  revenueTrend?: number
  revenueConsistency?: number
  totalExpenses?: number
  expenseToRevenueRatio?: number
  ownerWithdrawals?: number
  activeMcaCount?: number
  dailyMcaObligation?: number
  debtToRevenueRatio?: number
  stackingStatus?: string
  nsfCount?: number
  negativeBalanceDays?: number
  lowestBalance?: number
  redFlagCount?: number
  revenueScore?: number
  expenseScore?: number
  debtScore?: number
  riskScore?: number
  overallScore?: number
  riskTier?: string
  verdict?: string
}

interface Transaction {
  id: string
  bankAccountId: string
  date: string
  description: string
  amount: number
  type: string
  runningBalance?: number
  category?: string
  subcategory?: string
}

interface DealState {
  deal: Deal | null
  metrics: DealMetrics | null
  transactions: Transaction[]
  isLoading: boolean
  setDeal: (deal: Deal | null) => void
  setMetrics: (metrics: DealMetrics | null) => void
  setTransactions: (transactions: Transaction[]) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useDealStore = create<DealState>((set) => ({
  deal: null,
  metrics: null,
  transactions: [],
  isLoading: false,
  setDeal: (deal) => set({ deal }),
  setMetrics: (metrics) => set({ metrics }),
  setTransactions: (transactions) => set({ transactions }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ deal: null, metrics: null, transactions: [], isLoading: false }),
}))
