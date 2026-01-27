/**
 * Agentic Scorecard Service
 *
 * Handles LLM-based qualitative assessments for deal analysis.
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import {
  REVENUE_STABILITY_SYSTEM_PROMPT,
  buildRevenueStabilityUserPrompt,
} from './revenueStabilityPrompt'
import {
  REVENUE_DURABILITY_SYSTEM_PROMPT,
  buildRevenueDurabilityUserPrompt,
} from './revenueDurabilityPrompt'
import {
  REVENUE_TREND_SYSTEM_PROMPT,
  buildRevenueTrendUserPrompt,
} from './revenueTrendPrompt'
import {
  REVENUE_CONCENTRATION_SYSTEM_PROMPT,
  buildRevenueConcentrationUserPrompt,
} from './revenueConcentrationPrompt'
import {
  REVENUE_SUFFICIENCY_SYSTEM_PROMPT,
  buildRevenueSufficiencyUserPrompt,
} from './revenueSufficiencyPrompt'
import type {
  RevenueStabilityAgenticScore,
  RevenueDurabilityAgenticScore,
  RevenueTrendAgenticScore,
  RevenueConcentrationAgenticScore,
  RevenueSufficiencyAgenticScore,
  AgenticScorecard,
  FullAgenticScorecard,
  EnrichedTransaction,
  AuditTrail,
  AgenticSubsectionType,
  AGENT_WEIGHTS,
} from '@/types/agenticScorecard'
import type { Document, BankAccount, Transaction } from '@prisma/client'

// Import weights constant
const WEIGHTS: Record<AgenticSubsectionType, number> = {
  'revenue-stability': 20,
  'revenue-durability': 15,
  'revenue-trend': 15,
  'revenue-concentration': 15,
  'revenue-sufficiency': 35,
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL_ID = 'claude-sonnet-4-20250514'

interface DocumentWithBankAccounts extends Document {
  bankAccounts: (BankAccount & {
    transactions: Transaction[]
  })[]
}

interface AgentCallResult<T> {
  result: T
  auditTrail: AuditTrail
}

/**
 * Generic function to call Claude for agentic assessment
 */
async function callAgentWithAudit<T>(
  systemPrompt: string,
  userPrompt: string,
  transactionCount: number,
  dateRange: { start: string; end: string }
): Promise<AgentCallResult<T>> {
  const startTime = Date.now()

  const response = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const processingTimeMs = Date.now() - startTime

  // Extract JSON from response
  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response
  let parsedResponse: T
  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    parsedResponse = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('Failed to parse Claude response:', textContent.text)
    throw new Error(`Failed to parse agentic scorecard response: ${e}`)
  }

  const auditTrail: AuditTrail = {
    model: MODEL_ID,
    processingTimeMs,
    transactionCount,
    dateRange,
    promptTokens: response.usage?.input_tokens,
    completionTokens: response.usage?.output_tokens,
  }

  return { result: parsedResponse, auditTrail }
}

// ============================================================================
// TRANSACTION ENRICHMENT
// ============================================================================

/**
 * Patterns for identifying transaction types
 */
const MCA_PATTERNS = [
  /ebf\s*holdings/i, /everest\s*business/i, /lendingpoint/i, /fundbox/i,
  /bluevine/i, /ondeck/i, /kabbage/i, /can\s*capital/i, /rapid\s*finance/i,
  /credibly/i, /fora\s*financial/i, /pearl\s*capital/i, /forward\s*financing/i,
  /clearco/i, /capify/i, /libertas/i, /bizfi/i, /yellowstone/i,
  /national\s*funding/i, /payability/i, /behalf/i, /fundkite/i, /merchant\s*cash/i,
  /mca\s*(fund|loan|advance)/i, /business\s*advance/i, /sba\s*loan/i,
]

const NON_OPERATING_PATTERNS = [
  /refund/i, /return(?!ed\s*item)/i, /reversal/i, /loan\s*proceed/i,
  /line\s*of\s*credit/i, /interest\s*(paid|earned)/i, /dividend/i,
  /insurance\s*claim/i, /legal\s*settlement/i, /asset\s*sale/i,
]

const INTERNAL_TRANSFER_PATTERNS = [
  /transfer\s*(from|to)\s*(checking|savings|account)/i,
  /internal\s*transfer/i, /self\s*transfer/i, /between\s*accounts/i,
  /move\s*funds/i, /sweep/i,
]

const CORE_REVENUE_PATTERNS = [
  /square/i, /stripe/i, /paypal\s*(deposit|transfer|settlement)/i,
  /clover/i, /toast\s*deposit/i, /shopify/i, /merchant\s*services/i,
  /card\s*settlement/i, /visa\s*settlement/i, /mastercard\s*settlement/i,
  /amex\s*settlement/i, /ach\s*(credit|deposit)/i, /wire\s*(credit|transfer|in)/i,
  /check\s*deposit/i, /cash\s*deposit/i, /customer\s*payment/i, /invoice/i,
  /sales/i, /revenue/i, /payment\s*received/i, /merch\s*dep/i,
]

/**
 * Extract source name from transaction description
 */
function extractSourceName(description: string): string | null {
  const desc = description.toLowerCase()

  if (desc.includes('square')) return 'Square'
  if (desc.includes('stripe')) return 'Stripe'
  if (desc.includes('paypal')) return 'PayPal'
  if (desc.includes('shopify')) return 'Shopify'
  if (desc.includes('clover')) return 'Clover'
  if (desc.includes('toast')) return 'Toast'
  if (desc.includes('ach')) return 'ACH Deposit'
  if (desc.includes('wire')) return 'Wire Transfer'
  if (desc.includes('check')) return 'Check Deposit'
  if (desc.includes('cash')) return 'Cash Deposit'
  if (desc.includes('zelle')) return 'Zelle'
  if (desc.includes('venmo')) return 'Venmo'
  if (desc.includes('merch dep') || desc.includes('merchant dep')) return 'Merchant Deposit'
  if (desc.includes('bnkcd')) return 'Bank Card Settlement'

  // Try to extract company name from first 2-3 words
  const words = desc.split(/\s+/).slice(0, 3).join(' ')
  if (words.length > 3) return words.substring(0, 30)

  return null
}

/**
 * Enrich a transaction with classification flags
 */
function enrichTransaction(t: Transaction): EnrichedTransaction {
  const desc = t.description.toLowerCase()
  const isCredit = t.type === 'CREDIT' && t.amount > 0

  const isMcaOrLoan = MCA_PATTERNS.some((p) => p.test(desc))
  const isNonOperating = NON_OPERATING_PATTERNS.some((p) => p.test(desc)) || isMcaOrLoan
  const isInternalTransfer = INTERNAL_TRANSFER_PATTERNS.some((p) => p.test(desc))

  // Core revenue = credit that is not non-operating, internal, or MCA
  const isCoreRevenue =
    isCredit &&
    !isNonOperating &&
    !isInternalTransfer &&
    (CORE_REVENUE_PATTERNS.some((p) => p.test(desc)) || !NON_OPERATING_PATTERNS.some((p) => p.test(desc)))

  return {
    date: t.date.toISOString().split('T')[0],
    description: t.description,
    amount: t.amount,
    balance: t.runningBalance || 0,
    category: t.category,
    subcategory: t.subcategory,
    coreRevenueInflow: isCoreRevenue,
    nonOperatingDepositInflow: isNonOperating && isCredit,
    mcaOrLoanInflow: isMcaOrLoan && isCredit,
    internalCircularTransfer: isInternalTransfer && isCredit,
    coreRevenueSourceName: isCoreRevenue ? extractSourceName(t.description) : null,
  }
}

/**
 * Shared interface for prepared transaction data
 */
interface PreparedTransactionData {
  transactionData: string
  transactionCount: number
  dateRange: { start: string; end: string }
}

/**
 * Get and prepare transactions for a deal
 */
async function getTransactionsForDeal(dealId: string): Promise<PreparedTransactionData> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      documents: {
        include: {
          bankAccounts: {
            include: {
              transactions: {
                orderBy: { date: 'desc' },
              },
            },
          },
        },
      },
    },
  })

  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`)
  }

  // Extract and enrich transactions
  const transactions = (deal.documents as DocumentWithBankAccounts[]).flatMap((doc) =>
    doc.bankAccounts.flatMap((ba) => ba.transactions)
  )

  if (transactions.length === 0) {
    throw new Error('No transactions found for deal')
  }

  // Sort by date (oldest first for chronological analysis)
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Get last 3 months of data
  const endDate = new Date(transactions[transactions.length - 1].date)
  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - 3)

  const recentTransactions = transactions.filter((t) => new Date(t.date) >= startDate)

  // Enrich transactions
  const enrichedTransactions = recentTransactions.map(enrichTransaction)

  // Format for prompt
  const transactionData = formatTransactionsForPrompt(enrichedTransactions)

  return {
    transactionData,
    transactionCount: enrichedTransactions.length,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  }
}

/**
 * Format enriched transactions for the LLM prompt
 */
function formatTransactionsForPrompt(transactions: EnrichedTransaction[]): string {
  // Filter to only credits for revenue analysis
  const credits = transactions.filter((t) => t.amount > 0)

  // Group by week for easier analysis
  const lines: string[] = []
  lines.push('Date | Description | Amount | CoreRevenue | Source | NonOperating | MCA/Loan | Internal')
  lines.push('-----|-------------|--------|-------------|--------|--------------|----------|----------')

  for (const t of credits) {
    const row = [
      t.date,
      t.description.substring(0, 50).padEnd(50),
      `$${t.amount.toFixed(2)}`.padStart(12),
      t.coreRevenueInflow ? 'Y' : 'N',
      (t.coreRevenueSourceName || '-').substring(0, 15).padEnd(15),
      t.nonOperatingDepositInflow ? 'Y' : 'N',
      t.mcaOrLoanInflow ? 'Y' : 'N',
      t.internalCircularTransfer ? 'Y' : 'N',
    ]
    lines.push(row.join(' | '))
  }

  // Add summary statistics for context
  const coreRevenue = credits.filter((t) => t.coreRevenueInflow)
  const totalCoreRevenue = coreRevenue.reduce((sum, t) => sum + t.amount, 0)
  const totalDeposits = credits.reduce((sum, t) => sum + t.amount, 0)

  lines.push('')
  lines.push('--- Summary ---')
  lines.push(`Total Deposits: $${totalDeposits.toFixed(2)}`)
  lines.push(`Core Revenue Deposits: ${coreRevenue.length}`)
  lines.push(`Total Core Revenue: $${totalCoreRevenue.toFixed(2)}`)
  lines.push(`Core Revenue %: ${((totalCoreRevenue / totalDeposits) * 100).toFixed(1)}%`)

  return lines.join('\n')
}

// ============================================================================
// INDIVIDUAL AGENT GENERATORS
// ============================================================================

/**
 * Generate Revenue Stability Agentic Scorecard for a deal
 */
export async function generateRevenueStabilityScore(
  dealId: string
): Promise<RevenueStabilityAgenticScore | null> {
  const { transactionData, transactionCount, dateRange } = await getTransactionsForDeal(dealId)
  const userPrompt = buildRevenueStabilityUserPrompt(transactionData)

  const { result, auditTrail } = await callAgentWithAudit<RevenueStabilityAgenticScore>(
    REVENUE_STABILITY_SYSTEM_PROMPT,
    userPrompt,
    transactionCount,
    dateRange
  )

  result.generatedAt = new Date().toISOString()
  result.auditTrail = auditTrail

  return result
}

/**
 * Generate Revenue Durability Agentic Scorecard for a deal
 */
export async function generateRevenueDurabilityScore(
  dealId: string
): Promise<RevenueDurabilityAgenticScore | null> {
  const { transactionData, transactionCount, dateRange } = await getTransactionsForDeal(dealId)
  const userPrompt = buildRevenueDurabilityUserPrompt(transactionData)

  const { result, auditTrail } = await callAgentWithAudit<RevenueDurabilityAgenticScore>(
    REVENUE_DURABILITY_SYSTEM_PROMPT,
    userPrompt,
    transactionCount,
    dateRange
  )

  result.generatedAt = new Date().toISOString()
  result.auditTrail = auditTrail

  return result
}

/**
 * Generate Revenue Trend Agentic Scorecard for a deal
 */
export async function generateRevenueTrendScore(
  dealId: string
): Promise<RevenueTrendAgenticScore | null> {
  const { transactionData, transactionCount, dateRange } = await getTransactionsForDeal(dealId)
  const userPrompt = buildRevenueTrendUserPrompt(transactionData)

  const { result, auditTrail } = await callAgentWithAudit<RevenueTrendAgenticScore>(
    REVENUE_TREND_SYSTEM_PROMPT,
    userPrompt,
    transactionCount,
    dateRange
  )

  result.generatedAt = new Date().toISOString()
  result.auditTrail = auditTrail

  return result
}

/**
 * Generate Revenue Concentration Agentic Scorecard for a deal
 */
export async function generateRevenueConcentrationScore(
  dealId: string
): Promise<RevenueConcentrationAgenticScore | null> {
  const { transactionData, transactionCount, dateRange } = await getTransactionsForDeal(dealId)
  const userPrompt = buildRevenueConcentrationUserPrompt(transactionData)

  const { result, auditTrail } = await callAgentWithAudit<RevenueConcentrationAgenticScore>(
    REVENUE_CONCENTRATION_SYSTEM_PROMPT,
    userPrompt,
    transactionCount,
    dateRange
  )

  result.generatedAt = new Date().toISOString()
  result.auditTrail = auditTrail

  return result
}

/**
 * Generate Revenue Sufficiency Agentic Scorecard for a deal
 */
export async function generateRevenueSufficiencyScore(
  dealId: string,
  estimatedDailyPayment?: number
): Promise<RevenueSufficiencyAgenticScore | null> {
  const { transactionData, transactionCount, dateRange } = await getTransactionsForDeal(dealId)
  const userPrompt = buildRevenueSufficiencyUserPrompt(transactionData, estimatedDailyPayment)

  const { result, auditTrail } = await callAgentWithAudit<RevenueSufficiencyAgenticScore>(
    REVENUE_SUFFICIENCY_SYSTEM_PROMPT,
    userPrompt,
    transactionCount,
    dateRange
  )

  result.generatedAt = new Date().toISOString()
  result.auditTrail = auditTrail

  return result
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Calculate aggregated score from all agent results
 */
export function calculateAggregatedScore(scorecard: FullAgenticScorecard): NonNullable<FullAgenticScorecard['aggregatedScore']> {
  const agentScores: NonNullable<FullAgenticScorecard['aggregatedScore']>['agentScores'] = []
  const keyFindings: string[] = []
  const criticalConcerns: string[] = []

  // Collect scores from each agent
  const agentResults: { section: AgenticSubsectionType; score: number | undefined; result: unknown }[] = [
    { section: 'revenue-stability', score: scorecard.revenueStability?.aggregation.finalScore, result: scorecard.revenueStability },
    { section: 'revenue-durability', score: scorecard.revenueDurability?.aggregation.finalScore, result: scorecard.revenueDurability },
    { section: 'revenue-trend', score: scorecard.revenueTrend?.aggregation.finalScore, result: scorecard.revenueTrend },
    { section: 'revenue-concentration', score: scorecard.revenueConcentration?.aggregation.finalScore, result: scorecard.revenueConcentration },
    { section: 'revenue-sufficiency', score: scorecard.revenueSufficiency?.aggregation.finalScore, result: scorecard.revenueSufficiency },
  ]

  let totalWeight = 0
  let weightedSum = 0

  for (const { section, score, result } of agentResults) {
    if (score !== undefined && result) {
      const weight = WEIGHTS[section]
      totalWeight += weight
      weightedSum += score * weight

      agentScores.push({
        section,
        score,
        weight,
        weightedContribution: (score * weight) / 100,
      })

      // Extract key findings from high scores
      if (score >= 70) {
        const agentResult = result as { overallJustification?: string }
        if (agentResult.overallJustification) {
          keyFindings.push(`${section}: ${agentResult.overallJustification.substring(0, 100)}...`)
        }
      }

      // Extract critical concerns from low scores and red flags
      const agentWithFlags = result as { redFlags?: Array<{ description: string; severity: string }> }
      if (score < 50 || (agentWithFlags.redFlags?.some(rf => rf.severity === 'High'))) {
        agentWithFlags.redFlags?.forEach(rf => {
          if (rf.severity === 'High') {
            criticalConcerns.push(`${section}: ${rf.description}`)
          }
        })
      }
    }
  }

  // Calculate weighted score
  const weightedScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  // Determine recommendation
  let recommendation: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW'
  let recommendationReason: string

  if (weightedScore >= 70 && criticalConcerns.length === 0) {
    recommendation = 'APPROVE'
    recommendationReason = 'Strong revenue quality indicators across all dimensions with no critical concerns.'
  } else if (weightedScore < 50 || criticalConcerns.length >= 3) {
    recommendation = 'DECLINE'
    recommendationReason = criticalConcerns.length >= 3
      ? `Multiple critical concerns identified: ${criticalConcerns.slice(0, 3).join('; ')}`
      : 'Overall revenue quality score indicates high risk.'
  } else {
    recommendation = 'MANUAL_REVIEW'
    recommendationReason = criticalConcerns.length > 0
      ? `Mixed signals requiring manual review. Concerns: ${criticalConcerns.slice(0, 2).join('; ')}`
      : 'Score in moderate range requires additional review.'
  }

  return {
    weightedScore,
    recommendation,
    recommendationReason,
    agentScores,
    keyFindings: keyFindings.slice(0, 5),
    criticalConcerns: criticalConcerns.slice(0, 5),
  }
}

// ============================================================================
// FULL SCORECARD GENERATION
// ============================================================================

/**
 * Generate full agentic scorecard with all 5 agents running in parallel
 */
export async function generateFullAgenticScorecard(
  dealId: string,
  sections?: AgenticSubsectionType[]
): Promise<FullAgenticScorecard> {
  const startTime = Date.now()
  const sectionsToGenerate = sections || [
    'revenue-stability',
    'revenue-durability',
    'revenue-trend',
    'revenue-concentration',
    'revenue-sufficiency',
  ]

  const scorecard: FullAgenticScorecard = {
    dealId,
    generatedAt: new Date().toISOString(),
    status: 'processing',
  }

  const agentsSucceeded: AgenticSubsectionType[] = []
  const agentsFailed: AgenticSubsectionType[] = []
  const errors: { section: AgenticSubsectionType; error: string }[] = []

  // Create promises for all requested sections
  const promises: Promise<{ section: AgenticSubsectionType; result: unknown }>[] = []

  for (const section of sectionsToGenerate) {
    let promise: Promise<unknown>

    switch (section) {
      case 'revenue-stability':
        promise = generateRevenueStabilityScore(dealId)
        break
      case 'revenue-durability':
        promise = generateRevenueDurabilityScore(dealId)
        break
      case 'revenue-trend':
        promise = generateRevenueTrendScore(dealId)
        break
      case 'revenue-concentration':
        promise = generateRevenueConcentrationScore(dealId)
        break
      case 'revenue-sufficiency':
        promise = generateRevenueSufficiencyScore(dealId)
        break
      default:
        continue
    }

    promises.push(
      promise
        .then((result) => ({ section, result }))
        .catch((error) => ({ section, result: null, error: error instanceof Error ? error.message : 'Unknown error' }))
    )
  }

  // Run all agents in parallel
  const results = await Promise.allSettled(promises)

  // Process results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { section, result: agentResult } = result.value as { section: AgenticSubsectionType; result: unknown; error?: string }

      if (agentResult) {
        switch (section) {
          case 'revenue-stability':
            scorecard.revenueStability = agentResult as RevenueStabilityAgenticScore
            break
          case 'revenue-durability':
            scorecard.revenueDurability = agentResult as RevenueDurabilityAgenticScore
            break
          case 'revenue-trend':
            scorecard.revenueTrend = agentResult as RevenueTrendAgenticScore
            break
          case 'revenue-concentration':
            scorecard.revenueConcentration = agentResult as RevenueConcentrationAgenticScore
            break
          case 'revenue-sufficiency':
            scorecard.revenueSufficiency = agentResult as RevenueSufficiencyAgenticScore
            break
        }
        agentsSucceeded.push(section)
      } else {
        agentsFailed.push(section)
        const errorValue = result.value as { error?: string }
        if (errorValue.error) {
          errors.push({ section, error: errorValue.error })
        }
      }
    } else {
      const section = (result.reason as { section?: AgenticSubsectionType })?.section
      if (section) {
        agentsFailed.push(section)
        errors.push({ section, error: result.reason?.message || 'Unknown error' })
      }
    }
  }

  // Set processing details
  scorecard.processingDetails = {
    totalProcessingTimeMs: Date.now() - startTime,
    agentsSucceeded,
    agentsFailed,
    errors,
  }

  // Calculate aggregated score if we have any results
  if (agentsSucceeded.length > 0) {
    scorecard.aggregatedScore = calculateAggregatedScore(scorecard)
  }

  // Set final status
  if (agentsFailed.length === 0) {
    scorecard.status = 'completed'
  } else if (agentsSucceeded.length > 0) {
    scorecard.status = 'partial'
  } else {
    scorecard.status = 'error'
    scorecard.error = errors.map(e => `${e.section}: ${e.error}`).join('; ')
  }

  return scorecard
}

/**
 * Generate agentic scorecard for a deal (legacy compatibility)
 */
export async function generateAgenticScorecard(
  dealId: string,
  sections: AgenticSubsectionType[] = ['revenue-stability']
): Promise<AgenticScorecard> {
  const fullScorecard = await generateFullAgenticScorecard(dealId, sections)

  // Convert to legacy format
  const scorecard: AgenticScorecard = {
    dealId: fullScorecard.dealId,
    generatedAt: fullScorecard.generatedAt,
    status: fullScorecard.status === 'partial' ? 'completed' : fullScorecard.status,
    revenueStability: fullScorecard.revenueStability,
    revenueDurability: fullScorecard.revenueDurability,
    revenueTrend: fullScorecard.revenueTrend,
    revenueConcentration: fullScorecard.revenueConcentration,
    revenueSufficiency: fullScorecard.revenueSufficiency,
    error: fullScorecard.error,
  }

  return scorecard
}
