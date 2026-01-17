/**
 * System Prompt Builder for MCA Deal Chat
 * Constructs comprehensive context for Claude to analyze deals
 */

import type { DealChatContext } from '@/types/chat'

export function buildSystemPrompt(context: DealChatContext): string {
  const { deal, transactions, analytics } = context

  const periodStart = new Date(analytics.periodStart).toLocaleDateString()
  const periodEnd = new Date(analytics.periodEnd).toLocaleDateString()

  return `You are an expert MCA (Merchant Cash Advance) underwriting analyst assistant. You have complete access to all data for this deal and can answer any questions about it.

## YOUR ROLE
- Help underwriters analyze MCA deals by answering questions about the data
- Provide specific numbers, dates, and transaction details when asked
- Explain scoring decisions and flag concerns
- Be precise and cite specific data points
- If asked to compare or calculate, show your work

## CURRENT DEAL: ${deal.merchantName}
Deal ID: ${deal.id}
Status: ${deal.status}
${deal.decision ? `Decision: ${deal.decision}` : ''}
${deal.decisionNotes ? `Notes: ${deal.decisionNotes}` : ''}
Analysis Period: ${periodStart} - ${periodEnd}
Months Analyzed: ${analytics.monthsAnalyzed}

## FINANCIAL SUMMARY
- Total Revenue: $${formatNumber(analytics.totalRevenue)}
- Total Expenses: $${formatNumber(analytics.totalExpenses)}
- Net Cash Flow: $${formatNumber(analytics.netCashFlow)}
- Avg Monthly Revenue: $${formatNumber(analytics.avgMonthlyRevenue)}
- Avg Monthly Expenses: $${formatNumber(analytics.avgMonthlyExpenses)}

## MCA SUMMARY
- MCA Funding Received: $${formatNumber(analytics.mca.fundingReceived)}
- MCA Payments Total: $${formatNumber(analytics.mca.paymentsTotal)}
- MCA Payment Count: ${analytics.mca.paymentCount}
- Active MCA Lenders: ${analytics.mca.uniqueMCACount}
${analytics.mca.mcaNames.length > 0 ? `- Lenders: ${analytics.mca.mcaNames.join(', ')}` : ''}

## NSF & CASH FLOW HEALTH
- NSF Events: ${analytics.nsf.count}
- NSF Fees: $${formatNumber(analytics.nsf.totalFees)}
- Negative Balance Days: ${analytics.nsf.negativeBalanceDays}
- Lowest Balance: $${formatNumber(analytics.nsf.lowestBalance)}

${analytics.scorecard ? formatScorecard(analytics.scorecard) : ''}

## MONTHLY BREAKDOWN
${formatMonthlyTable(analytics.monthlyData)}

## REVENUE BREAKDOWN
${formatBreakdown(analytics.revenue, 'Revenue')}

## EXPENSE BREAKDOWN
${formatBreakdown(analytics.expenses, 'Expense')}

## TRANSACTION DATA
You have access to ${transactions.length} transactions.

### Income Transactions Summary
${formatTransactionSummary(transactions.filter(t => t.type === 'CREDIT'))}

### Expense Transactions Summary
${formatTransactionSummary(transactions.filter(t => t.type === 'DEBIT'))}

### MCA Transactions
${formatMCATransactions(transactions)}

### NSF/Overdraft Events
${formatNSFTransactions(transactions)}

### Recent Transactions (Last 50)
${formatRecentTransactions(transactions.slice(0, 50))}

## INSTRUCTIONS
1. When answering questions, reference specific data points from above
2. If asked about a specific transaction, look it up in the transaction list
3. If asked "why" a score is what it is, explain the factors that contributed
4. If asked to find patterns, analyze the transaction data
5. Be concise but thorough - underwriters need accurate information
6. If you're unsure about something, say so rather than guessing
7. You can perform calculations on the data if asked

## EXAMPLE QUERIES YOU CAN HANDLE
- "Why is the NSF score so low?"
- "Show me all MCA payments"
- "What's the biggest expense category?"
- "Is there any stacking happening?"
- "Calculate the daily MCA burden"
- "What caused the negative balance?"
- "Are there any suspicious transactions?"
- "Compare month-over-month revenue"
- "Should I approve this deal?"`
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatScorecard(scorecard: NonNullable<DealChatContext['analytics']['scorecard']>): string {
  return `
## SCORECARD SUMMARY
Overall Score: ${scorecard.overallScore}/100 (Rating: ${scorecard.overallRating}/5)
Recommendation: ${scorecard.recommendation}

### Section Scores
| Section | Score | Rating |
|---------|-------|--------|
| Revenue Quality | ${scorecard.sections.revenueQuality.score} | ${scorecard.sections.revenueQuality.rating}/5 |
| Expense Quality | ${scorecard.sections.expenseQuality.score} | ${scorecard.sections.expenseQuality.rating}/5 |
| Existing Debt (MCA) | ${scorecard.sections.existingDebtImpact.score} | ${scorecard.sections.existingDebtImpact.rating}/5 |
| Cashflow & Charges | ${scorecard.sections.cashflowCharges.score} | ${scorecard.sections.cashflowCharges.rating}/5 |

### Red Flags (${scorecard.redFlags.length})
${scorecard.redFlags.length === 0 ? 'No red flags detected.' :
  scorecard.redFlags.map(f => `- [${f.severity}] ${f.type}: ${f.description}`).join('\n')}`
}

function formatMonthlyTable(monthly: DealChatContext['analytics']['monthlyData']): string {
  if (!monthly || monthly.length === 0) return 'No monthly data available.'

  let table = '| Month | Revenue | Expenses | Net | MCA Pmts | NSF | Neg Days |\n'
  table += '|-------|---------|----------|-----|----------|-----|----------|\n'

  for (const m of monthly) {
    table += `| ${m.month} | $${formatNumber(m.revenue)} | $${formatNumber(m.expenses)} | $${formatNumber(m.netCashFlow)} | $${formatNumber(m.mcaPayments)} | ${m.nsfCount} | ${m.negativeDays} |\n`
  }

  return table
}

function formatBreakdown(data: Record<string, number>, type: string): string {
  const entries = Object.entries(data)
    .filter(([key, value]) => typeof value === 'number' && value > 0 && !key.includes('total') && !key.includes('Count'))
    .sort((a, b) => b[1] - a[1])

  if (entries.length === 0) return `No ${type.toLowerCase()} breakdown available.`

  const total = entries.reduce((sum, [, val]) => sum + val, 0)

  let output = `| Category | Amount | % of Total |\n|----------|--------|------------|\n`
  for (const [category, amount] of entries.slice(0, 15)) {
    const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0'
    const formattedCategory = category.replace(/([A-Z])/g, ' $1').trim()
    output += `| ${formattedCategory} | $${formatNumber(amount)} | ${pct}% |\n`
  }

  return output
}

function formatTransactionSummary(transactions: DealChatContext['transactions']): string {
  if (transactions.length === 0) return 'No transactions.'

  const byCategory = new Map<string, { count: number; total: number }>()

  for (const t of transactions) {
    const cat = t.category || 'Uncategorized'
    const current = byCategory.get(cat) || { count: 0, total: 0 }
    current.count++
    current.total += Math.abs(t.amount)
    byCategory.set(cat, current)
  }

  const sorted = Array.from(byCategory.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)

  let output = `Total: ${transactions.length} transactions\n\n`
  output += '| Category | Count | Total |\n|----------|-------|-------|\n'

  for (const [cat, { count, total }] of sorted) {
    output += `| ${cat} | ${count} | $${formatNumber(total)} |\n`
  }

  return output
}

function formatMCATransactions(transactions: DealChatContext['transactions']): string {
  const mcaTransactions = transactions.filter(t => {
    const cat = (t.category || '').toLowerCase()
    const desc = t.description.toLowerCase()
    return cat.includes('mca') || desc.includes('mca') ||
      cat.includes('merchant cash') || desc.includes('merchant cash')
  })

  if (mcaTransactions.length === 0) return 'No MCA transactions detected.'

  // Group by potential lender (from category/description)
  const disbursals = mcaTransactions.filter(t => t.type === 'CREDIT')
  const repayments = mcaTransactions.filter(t => t.type === 'DEBIT')

  let output = `### Disbursals (${disbursals.length})\n`
  if (disbursals.length > 0) {
    output += '| Date | Description | Amount |\n|------|-------------|--------|\n'
    for (const t of disbursals.slice(0, 10)) {
      const date = new Date(t.date).toLocaleDateString()
      output += `| ${date} | ${t.description.slice(0, 40)} | $${formatNumber(t.amount)} |\n`
    }
  }

  output += `\n### Repayments (${repayments.length})\n`
  if (repayments.length > 0) {
    output += '| Date | Description | Amount | Balance After |\n|------|-------------|--------|---------------|\n'
    for (const t of repayments.slice(0, 20)) {
      const date = new Date(t.date).toLocaleDateString()
      output += `| ${date} | ${t.description.slice(0, 30)} | $${formatNumber(Math.abs(t.amount))} | $${formatNumber(t.runningBalance)} |\n`
    }
    if (repayments.length > 20) {
      output += `\n... and ${repayments.length - 20} more repayments`
    }
  }

  return output
}

function formatNSFTransactions(transactions: DealChatContext['transactions']): string {
  const nsfTransactions = transactions.filter(t => {
    const cat = (t.category || '').toLowerCase()
    const desc = t.description.toLowerCase()
    return cat.includes('nsf') || cat.includes('overdraft') ||
      desc.includes('nsf') || desc.includes('overdraft') ||
      desc.includes('insufficient') || desc.includes('returned item')
  })

  if (nsfTransactions.length === 0) return 'No NSF/overdraft events detected.'

  let output = `Total NSF Events: ${nsfTransactions.length}\n\n`
  output += '| Date | Description | Fee | Balance After |\n|------|-------------|-----|---------------|\n'

  for (const t of nsfTransactions.slice(0, 20)) {
    const date = new Date(t.date).toLocaleDateString()
    output += `| ${date} | ${t.description.slice(0, 30)} | $${formatNumber(Math.abs(t.amount))} | $${formatNumber(t.runningBalance)} |\n`
  }

  if (nsfTransactions.length > 20) {
    output += `\n... and ${nsfTransactions.length - 20} more NSF events`
  }

  return output
}

function formatRecentTransactions(transactions: DealChatContext['transactions']): string {
  if (transactions.length === 0) return 'No transactions.'

  // Sort by date descending
  const sorted = [...transactions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  let output = '| Date | Type | Category | Description | Amount | Balance |\n'
  output += '|------|------|----------|-------------|--------|--------|\n'

  for (const t of sorted) {
    const date = new Date(t.date).toLocaleDateString()
    const type = t.type === 'CREDIT' ? '➕' : '➖'
    const cat = (t.category || 'Other').slice(0, 15)
    const desc = t.description.slice(0, 25)
    const amount = t.type === 'CREDIT' ? t.amount : -Math.abs(t.amount)
    output += `| ${date} | ${type} | ${cat} | ${desc} | $${formatNumber(amount)} | $${formatNumber(t.runningBalance)} |\n`
  }

  return output
}
