# Deal Context Enhancement Plan

## Executive Summary

The current deal context provides solid financial analytics but misses several data dimensions that would make the AI assistant significantly more useful. This plan outlines enhancements to make the chat experience smarter and more contextually aware.

---

## Current State Analysis

### What We Have Today

```
DealChatContext
├── deal: { id, merchantName, status, decision, decisionNotes, dates }
├── transactions: [] (empty in API response to reduce payload)
└── analytics:
    ├── Period & totals (revenue, expenses, net cash flow)
    ├── Revenue breakdown (by category)
    ├── Expense breakdown (by category)
    ├── MCA summary (funding, payments, lender names)
    ├── NSF metrics (count, fees, negative days, lowest balance)
    ├── Monthly data (revenue, expenses, MCA, NSF per month)
    └── Scorecard (score, rating, recommendation, section scores, red flags)
```

### What's Missing (Available in DB but Not in Context)

| Data | Location | Why It Matters |
|------|----------|----------------|
| Bank account metadata | `BankAccount` model | Knowing which bank, account type, statement dates |
| Document info | `Document` model | How many statements, processing status, file names |
| Cached deal metrics | `DealMetrics` model | Risk tier, verdict, stacking status, trends |
| Underwriter notes | `DealNote` model | Previous analyst observations |
| Activity audit trail | `DealActivity` model | Workflow history, who did what |
| Assigned underwriter | `Deal.assignedTo` | Who's responsible |
| Transaction quality | `parseQuality` field | Confidence in categorization |

---

## Proposed Enhancements

### 1. Bank Account Context (Priority: HIGH)

**Problem**: AI doesn't know which bank the statements are from or the statement periods.

**Enhancement**:
```typescript
interface BankAccountSummary {
  bankName: string
  accountType?: string
  accountNumber?: string  // masked: "****1234"
  statementPeriod: {
    start: Date
    end: Date
  }
  transactionCount: number
  totalCredits: number
  totalDebits: number
}

// Add to DealChatContext
bankAccounts: BankAccountSummary[]
```

**Why**: AI can say "Based on your Chase Business Checking statement from Oct-Dec 2024..." instead of generic statements.

---

### 2. Document Metadata (Priority: MEDIUM)

**Problem**: AI doesn't know how many documents were uploaded or their status.

**Enhancement**:
```typescript
interface DocumentSummary {
  count: number
  documents: Array<{
    originalName: string
    status: 'READY' | 'PROCESSING' | 'ERROR'
    uploadedAt: Date
    bankAccountCount: number
  }>
  totalTransactionCount: number
  coverageMonths: number
}

// Add to DealChatContext
documents: DocumentSummary
```

**Why**: AI can explain "You uploaded 3 bank statements covering 6 months" and understand data completeness.

---

### 3. Transaction Quality Metrics (Priority: HIGH)

**Problem**: AI doesn't know how confident we are in transaction categorization.

**Enhancement**:
```typescript
interface DataQualityMetrics {
  totalTransactions: number
  categorization: {
    highConfidence: number      // count
    mediumConfidence: number
    lowConfidence: number
    unassigned: number
  }
  categorizedPercentage: number
  topUnassignedPatterns: Array<{
    pattern: string
    count: number
    totalAmount: number
  }>
}

// Add to DealChatContext.analytics
dataQuality: DataQualityMetrics
```

**Why**: AI can caveat responses appropriately: "Note: 15% of transactions are uncategorized, which may affect these totals."

---

### 4. Deal Workflow Context (Priority: HIGH)

**Problem**: AI doesn't know the deal's history or previous analyst observations.

**Enhancement**:
```typescript
interface WorkflowContext {
  assignedTo?: {
    name: string
    email: string
  }
  notes: Array<{
    content: string
    author: string
    createdAt: Date
  }>
  activities: Array<{
    action: string
    details?: string
    user?: string
    timestamp: Date
  }>
  previousDecisions?: Array<{
    decision: string
    notes?: string
    timestamp: Date
  }>
}

// Add to DealChatContext
workflow: WorkflowContext
```

**Why**: AI can reference prior analyst notes: "A previous underwriter noted concerns about the high owner draws..."

---

### 5. Enhanced MCA Analysis (Priority: HIGH)

**Problem**: Current MCA data is aggregate-only. No timeline or stacking analysis.

**Enhancement**:
```typescript
interface EnhancedMCAAnalysis {
  // Existing
  fundingReceived: number
  paymentsTotal: number
  paymentCount: number
  uniqueMCACount: number
  mcaNames: string[]

  // NEW: Timeline
  timeline: Array<{
    date: Date
    lender: string
    type: 'FUNDING' | 'PAYMENT'
    amount: number
    runningMCADebt: number  // estimated outstanding
  }>

  // NEW: Stacking Analysis
  stacking: {
    status: 'CLEAN' | 'STACKED' | 'HEAVY'
    concurrentLenders: number
    maxConcurrent: number
    stackingPeriods: Array<{
      start: Date
      end: Date
      lenders: string[]
    }>
  }

  // NEW: Payment Patterns
  paymentPatterns: {
    avgDailyPayment: number
    avgWeeklyPayment: number
    paymentFrequency: 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'IRREGULAR'
    missedPaymentIndicators: number
  }

  // NEW: Burden Analysis
  burden: {
    mcaToRevenueRatio: number
    mcaPaymentsAsPercentOfExpenses: number
    estimatedPayoffMonths?: number
  }
}
```

**Why**: AI can provide detailed stacking analysis: "You had 3 concurrent MCAs from May-July, with daily payments totaling $450/day."

---

### 6. Cash Flow Patterns (Priority: MEDIUM)

**Problem**: Only monthly aggregates. No weekly patterns or anomaly detection.

**Enhancement**:
```typescript
interface CashFlowPatterns {
  // Weekly patterns (for seasonality)
  weeklyAverages: {
    monday: number
    tuesday: number
    wednesday: number
    thursday: number
    friday: number
    saturday: number
    sunday: number
  }

  // Intra-month patterns
  beginningOfMonth: number  // avg balance days 1-10
  middleOfMonth: number     // avg balance days 11-20
  endOfMonth: number        // avg balance days 21-31

  // Anomalies
  unusualTransactions: Array<{
    date: Date
    description: string
    amount: number
    reason: string  // "3x larger than average", "unusual timing", etc.
  }>

  // Velocity
  avgDailyDeposits: number
  avgDailyWithdrawals: number
  netDailyFlow: number
}

// Add to DealChatContext.analytics
cashFlowPatterns: CashFlowPatterns
```

**Why**: AI can spot patterns: "Revenue is consistently lower on weekends, suggesting B2B customer base."

---

### 7. Revenue Source Analysis (Priority: MEDIUM)

**Problem**: We categorize revenue but don't analyze source concentration/reliability.

**Enhancement**:
```typescript
interface RevenueSourceAnalysis {
  // Source concentration
  topSources: Array<{
    source: string        // "SQUARE", "ACH_DEPOSITS", etc.
    amount: number
    percentage: number
    transactionCount: number
    avgTransactionSize: number
  }>

  // Concentration risk
  concentrationRisk: {
    top1SourcePct: number
    top3SourcesPct: number
    herfindahlIndex: number  // 0-1, higher = more concentrated
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  }

  // Consistency by source
  sourceConsistency: Array<{
    source: string
    monthsPresent: number
    coefficientOfVariation: number
    trend: 'GROWING' | 'STABLE' | 'DECLINING'
  }>
}

// Add to DealChatContext.analytics
revenueAnalysis: RevenueSourceAnalysis
```

**Why**: AI can assess: "85% of revenue comes from Square, showing heavy card processing dependency."

---

### 8. Expense Flags (Priority: MEDIUM)

**Problem**: Expenses are categorized but not analyzed for red flags.

**Enhancement**:
```typescript
interface ExpenseFlags {
  // Owner activity
  ownerActivity: {
    totalDraws: number
    drawCount: number
    avgDrawAmount: number
    drawsAsPercentOfRevenue: number
    largestDraw: { amount: number; date: Date }
    concernLevel: 'NORMAL' | 'ELEVATED' | 'CONCERNING'
  }

  // Unusual patterns
  unusualExpenses: Array<{
    category: string
    description: string
    amount: number
    flag: string  // "First time payee", "Unusually large", etc.
  }>

  // Recurring obligation detection
  recurringObligations: Array<{
    description: string
    estimatedMonthly: number
    frequency: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY'
    category: string
  }>
}

// Add to DealChatContext.analytics
expenseFlags: ExpenseFlags
```

**Why**: AI can flag: "Owner draws increased 150% in the last month, which is a potential concern."

---

### 9. Comparison Benchmarks (Priority: LOW - Future)

**Problem**: No industry context for the numbers.

**Enhancement**:
```typescript
interface Benchmarks {
  // Only if we have industry data
  industry?: string
  revenueVsBenchmark?: 'BELOW' | 'AVERAGE' | 'ABOVE'
  marginVsBenchmark?: 'BELOW' | 'AVERAGE' | 'ABOVE'
  nsfVsBenchmark?: 'BELOW' | 'AVERAGE' | 'ABOVE'
}
```

**Why**: Future enhancement - would require industry data collection.

---

## Implementation Priority

### Phase 1: Critical (Week 1)
1. Bank Account Context - Easy win, high value
2. Transaction Quality Metrics - Critical for confidence
3. Deal Workflow Context (notes only) - Underwriter continuity

### Phase 2: High Value (Week 2)
4. Enhanced MCA Analysis - Core underwriting need
5. Expense Flags (owner activity) - Risk identification

### Phase 3: Polish (Week 3)
6. Document Metadata
7. Cash Flow Patterns
8. Revenue Source Analysis
9. Full workflow context (activities)

---

## Technical Implementation Notes

### Changes Required

1. **`/src/types/chat.ts`**
   - Extend `DealChatContext` interface with new fields

2. **`/src/app/api/deals/[id]/context/route.ts`**
   - Modify `loadDealContext()` to fetch and compute new data
   - Add helper functions for each analysis type

3. **`/src/lib/chat/buildSystemPrompt.ts`**
   - Add new sections to system prompt for each context type
   - Update formatting functions

4. **New utility files**:
   - `/src/utils/calculations/mcaAnalysis.ts` - MCA stacking/timeline
   - `/src/utils/calculations/cashFlowPatterns.ts` - Pattern detection
   - `/src/utils/calculations/dataQuality.ts` - Quality metrics

### Payload Considerations

Current context API excludes transactions to reduce payload. With enhancements:
- Add computed summaries, not raw data
- Keep transaction details server-side (for /api/chat to use)
- New fields are lightweight (aggregates, not arrays of transactions)

### Backward Compatibility

- All new fields should be optional (`?`)
- System prompt builder should gracefully handle missing fields
- Suggested questions should adapt based on available context

---

## Example Enhanced System Prompt Sections

```markdown
## BANK STATEMENTS
- Bank: Chase Business Checking (****4521)
- Statement Period: Oct 1, 2024 - Dec 31, 2024
- Transactions: 342 total (94% categorized)

## DATA QUALITY
- High confidence: 280 transactions (82%)
- Medium confidence: 42 transactions (12%)
- Unassigned: 20 transactions (6%)
- Top unassigned patterns: "TRANSFER", "MISC DEBIT"

## MCA STACKING ANALYSIS
- Status: STACKED (2 concurrent lenders)
- Timeline:
  - Oct 15: Funded by EBF Holdings ($50,000)
  - Oct 16: Daily payments begin ($425/day)
  - Nov 1: Funded by Rapid Finance ($35,000) ⚠️ STACKING
  - Nov 2: Combined daily payments ($725/day)
  - Dec 1: EBF Holdings payoff detected

## UNDERWRITER NOTES
- Nov 15 (John Smith): "High owner draws in October, investigate"
- Nov 18 (Jane Doe): "Spoke with merchant, owner draw was for equipment"

## CASH FLOW PATTERNS
- Peak revenue days: Monday-Wednesday
- Low activity: Weekends (suggests B2B)
- End-of-month balance typically stressed
```

---

## Success Metrics

After implementation, the AI assistant should be able to:

1. Reference specific banks and statement periods
2. Caveat answers based on data quality
3. Explain MCA stacking with specific dates and amounts
4. Reference previous underwriter observations
5. Identify unusual patterns proactively
6. Provide more confident recommendations with richer context

---

## Questions for Product/Team

1. Should underwriter notes be editable from chat? (User says "note that..." and we save it)
2. Do we want AI to proactively flag issues it discovers, or only answer questions?
3. Should we add a "confidence score" to AI responses based on data quality?
4. Priority between MCA analysis depth vs. broader context coverage?
