/**
 * Chat Types for MCA Deal Analysis
 */

export interface ChatMessage {
  id: string
  dealId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date | string
  tokensUsed?: number
  latencyMs?: number
}

export interface ChatRequest {
  dealId: string
  message: string
  conversationHistory: ChatMessage[]
}

export interface ChatResponse {
  message: ChatMessage
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

// Context passed to the system prompt builder
export interface DealChatContext {
  deal: {
    id: string
    merchantName: string
    status: string
    decision?: string | null
    decisionNotes?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }
  transactions: Array<{
    id: string
    date: Date | string
    description: string
    amount: number
    type: 'CREDIT' | 'DEBIT'
    runningBalance: number
    category?: string | null
    subcategory?: string | null
    parseQuality?: string | null
    rawCategory?: string | null
  }>
  analytics: {
    periodStart: Date | string
    periodEnd: Date | string
    monthsAnalyzed: number
    totalRevenue: number
    totalExpenses: number
    netCashFlow: number
    avgMonthlyRevenue: number
    avgMonthlyExpenses: number
    revenue: Record<string, number>
    expenses: Record<string, number>
    mca: {
      fundingReceived: number
      paymentsTotal: number
      paymentCount: number
      uniqueMCACount: number
      mcaNames: string[]
    }
    nsf: {
      count: number
      totalFees: number
      negativeBalanceDays: number
      lowestBalance: number
    }
    monthlyData: Array<{
      month: string
      revenue: number
      expenses: number
      netCashFlow: number
      mcaPayments: number
      nsfCount: number
      negativeDays: number
    }>
    scorecard?: {
      overallScore: number
      overallRating: number
      recommendation: string
      sections: {
        revenueQuality: { score: number; rating: number }
        expenseQuality: { score: number; rating: number }
        existingDebtImpact: { score: number; rating: number }
        cashflowCharges: { score: number; rating: number }
      }
      redFlags: Array<{
        type: string
        severity: string
        description: string
      }>
    }
  }
}
