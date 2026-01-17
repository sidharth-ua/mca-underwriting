/**
 * Chat API Route
 * Handles AI chat requests for deal analysis with streaming responses
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { buildSystemPrompt } from '@/lib/chat/buildSystemPrompt'
import { calculateAggregatedMetrics, type Transaction as MetricTransaction } from '@/utils/calculations/metricsCalculator'
import { calculateOverallScorecard, getOverallSummary } from '@/utils/calculations/overallScorecard'
import type { DealChatContext } from '@/types/chat'
import type { Document, BankAccount, Transaction } from '@prisma/client'

const openai = new OpenAI()

interface DocumentWithBankAccounts extends Document {
  bankAccounts: (BankAccount & {
    transactions: Transaction[]
  })[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dealId, message, conversationHistory = [] } = body

    if (!dealId || !message) {
      return NextResponse.json(
        { error: 'Missing dealId or message' },
        { status: 400 }
      )
    }

    // Load deal context
    const context = await loadDealContext(dealId)

    if (!context) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Build system prompt with full deal context
    const systemPrompt = buildSystemPrompt(context)

    // Build messages array for OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: messages,
      stream: true
    })

    // Convert to web ReadableStream for Next.js
    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              // Send SSE format (matching the format expected by the frontend)
              const data = JSON.stringify({
                type: 'content_block_delta',
                delta: { text: content }
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
            if (chunk.choices[0]?.finish_reason === 'stop') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            }
          }
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      }
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function loadDealContext(dealId: string): Promise<DealChatContext | null> {
  // Load deal with all related data
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      documents: {
        include: {
          bankAccounts: {
            include: {
              transactions: {
                orderBy: { date: 'desc' }
              }
            }
          }
        }
      },
      metrics: true
    }
  })

  if (!deal) return null

  // Extract all transactions from all bank accounts
  const transactions = (deal.documents as DocumentWithBankAccounts[]).flatMap((doc) =>
    doc.bankAccounts.flatMap((ba) =>
      ba.transactions.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type as 'CREDIT' | 'DEBIT',
        runningBalance: t.runningBalance || 0,
        category: t.category,
        subcategory: t.subcategory,
        parseQuality: t.parseQuality,
        rawCategory: t.rawCategory
      }))
    )
  )

  // Sort transactions by date
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Calculate analytics if we have transactions
  let analytics: DealChatContext['analytics']

  if (transactions.length > 0) {
    try {
      // Convert transactions for metrics calculator
      const metricsTransactions: MetricTransaction[] = transactions.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        runningBalance: t.runningBalance,
        category: t.category,
        subcategory: t.subcategory,
        parseQuality: t.parseQuality as 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSIGNED' | null | undefined,
        rawCategory: t.rawCategory
      }))

      // Use the existing metrics calculator
      const aggregatedMetrics = calculateAggregatedMetrics(metricsTransactions)

      if (!aggregatedMetrics) {
        analytics = getBasicAnalytics(transactions)
      } else {
        // Calculate scorecard
        let scorecard: DealChatContext['analytics']['scorecard'] | undefined
        try {
          const fullScorecard = calculateOverallScorecard({
            transactions: metricsTransactions,
            metrics: aggregatedMetrics
          })
          const summary = getOverallSummary(fullScorecard)

          // Get section scores from the scorecard sections
          const revenueSection = fullScorecard.sections.revenueQuality
          const expenseSection = fullScorecard.sections.expenseQuality
          const debtSection = fullScorecard.sections.existingDebtImpact
          const cashflowSection = fullScorecard.sections.cashflowCharges

          // Collect red flags from all sections
          const allRedFlags: Array<{ type: string; severity: string; description: string }> = []

          // Helper to collect red flags from subsections
          const collectRedFlags = (section: typeof revenueSection) => {
            section.subsections.forEach((sub) => {
              sub.redFlags?.forEach((f) => {
                allRedFlags.push({
                  type: f.type,
                  severity: f.severity,
                  description: f.description || f.type
                })
              })
            })
          }

          collectRedFlags(revenueSection)
          collectRedFlags(expenseSection)
          collectRedFlags(debtSection)
          collectRedFlags(cashflowSection)

          scorecard = {
            overallScore: summary.score,
            overallRating: summary.rating,
            recommendation: summary.recommendation,
            sections: {
              revenueQuality: {
                score: revenueSection.score,
                rating: revenueSection.rating
              },
              expenseQuality: {
                score: expenseSection.score,
                rating: expenseSection.rating
              },
              existingDebtImpact: {
                score: debtSection.score,
                rating: debtSection.rating
              },
              cashflowCharges: {
                score: cashflowSection.score,
                rating: cashflowSection.rating
              }
            },
            redFlags: allRedFlags
          }
        } catch (e) {
          console.error('Error calculating scorecard:', e)
        }

        analytics = {
          periodStart: aggregatedMetrics.periodStart,
          periodEnd: aggregatedMetrics.periodEnd,
          monthsAnalyzed: aggregatedMetrics.monthsAnalyzed,
          totalRevenue: aggregatedMetrics.totalRevenue,
          totalExpenses: aggregatedMetrics.totalExpenses,
          netCashFlow: aggregatedMetrics.netCashFlow,
          avgMonthlyRevenue: aggregatedMetrics.avgMonthlyRevenue,
          avgMonthlyExpenses: aggregatedMetrics.avgMonthlyExpenses,
          revenue: {
            regularRevenue: aggregatedMetrics.revenue.regularRevenue,
            mcaFunding: aggregatedMetrics.revenue.mcaFunding,
            loanProceeds: aggregatedMetrics.revenue.loanProceeds,
            wireTransfers: aggregatedMetrics.revenue.wireTransfers,
            creditCardSales: aggregatedMetrics.revenue.creditCardSales,
            achDeposits: aggregatedMetrics.revenue.achDeposits,
            checkDeposits: aggregatedMetrics.revenue.checkDeposits,
            refundsReceived: aggregatedMetrics.revenue.refundsReceived,
            otherRevenue: aggregatedMetrics.revenue.otherRevenue,
            total: aggregatedMetrics.revenue.total
          },
          expenses: {
            recurring: aggregatedMetrics.expenses.recurring,
            payroll: aggregatedMetrics.expenses.payroll,
            vendorPayments: aggregatedMetrics.expenses.vendorPayments,
            ownerDraws: aggregatedMetrics.expenses.ownerDraws,
            cogs: aggregatedMetrics.expenses.cogs,
            marketing: aggregatedMetrics.expenses.marketing,
            professionalServices: aggregatedMetrics.expenses.professionalServices,
            insurance: aggregatedMetrics.expenses.insurance,
            taxes: aggregatedMetrics.expenses.taxes,
            bankFees: aggregatedMetrics.expenses.bankFees,
            otherExpenses: aggregatedMetrics.expenses.otherExpenses,
            total: aggregatedMetrics.expenses.total
          },
          mca: {
            fundingReceived: aggregatedMetrics.mca.fundingReceived,
            paymentsTotal: aggregatedMetrics.mca.paymentsTotal,
            paymentCount: aggregatedMetrics.mca.paymentCount,
            uniqueMCACount: aggregatedMetrics.mca.uniqueMCACount,
            mcaNames: aggregatedMetrics.mca.mcaNames
          },
          nsf: {
            count: aggregatedMetrics.nsf.count,
            totalFees: aggregatedMetrics.nsf.totalFees,
            negativeBalanceDays: aggregatedMetrics.nsf.negativeBalanceDays,
            lowestBalance: aggregatedMetrics.nsf.lowestBalance
          },
          monthlyData: aggregatedMetrics.monthlyData.map((m) => ({
            month: m.month,
            revenue: m.revenue.total,
            expenses: m.expenses.total,
            netCashFlow: m.cashFlow.netCashFlow,
            mcaPayments: m.mca.paymentsTotal,
            nsfCount: m.nsf.count,
            negativeDays: m.nsf.negativeBalanceDays
          })),
          scorecard
        }
      }
    } catch (e) {
      console.error('Error calculating analytics:', e)
      // Return basic analytics if calculation fails
      analytics = getBasicAnalytics(transactions)
    }
  } else {
    // No transactions - return empty analytics
    analytics = getBasicAnalytics([])
  }

  return {
    deal: {
      id: deal.id,
      merchantName: deal.merchantName,
      status: deal.status,
      decision: deal.decision,
      decisionNotes: deal.decisionNotes,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt
    },
    transactions,
    analytics
  }
}

function getBasicAnalytics(transactions: DealChatContext['transactions']): DealChatContext['analytics'] {
  const credits = transactions.filter((t) => t.type === 'CREDIT')
  const debits = transactions.filter((t) => t.type === 'DEBIT')

  const totalRevenue = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = debits.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const dates = transactions.map((t) => new Date(t.date))
  const periodStart = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date()
  const periodEnd = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date()

  return {
    periodStart,
    periodEnd,
    monthsAnalyzed: 0,
    totalRevenue,
    totalExpenses,
    netCashFlow: totalRevenue - totalExpenses,
    avgMonthlyRevenue: totalRevenue,
    avgMonthlyExpenses: totalExpenses,
    revenue: { total: totalRevenue },
    expenses: { total: totalExpenses },
    mca: {
      fundingReceived: 0,
      paymentsTotal: 0,
      paymentCount: 0,
      uniqueMCACount: 0,
      mcaNames: []
    },
    nsf: {
      count: 0,
      totalFees: 0,
      negativeBalanceDays: 0,
      lowestBalance: 0
    },
    monthlyData: []
  }
}
