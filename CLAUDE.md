# MCA Underwriting Platform - Project Guidelines

## Project Overview

An autonomous agentic underwriting platform for Merchant Cash Advance (MCA) lending. The system processes bank statement data (CSV) and generates analytical scorecards to assess merchant risk.

**Tech Stack**: Next.js 14, TypeScript, TailwindCSS, shadcn/ui

---

## Core Principles

### 1. Data Integrity First
- **Every number shown must be verifiable** against source data
- Category breakdowns MUST sum to displayed totals
- When in doubt, show "Uncategorized" rather than guess
- Always preserve raw data alongside categorized data

### 2. Conservative Classification
- Only classify transactions when confidence is HIGH
- Unknown/ambiguous transactions go to "Other" category
- Never hide or drop transactions - everything must be accounted for

### 3. Audit Trail
- Keep mapping of every transaction to its category
- Log classification decisions for review
- Enable drill-down from summary to individual transactions

---

## CSV Parsing Rules

### Expected Input Format
Bank statement CSVs typically contain:
```
Date, Description, Amount, Balance, [Optional: Tag, Category]
```

### Column Detection
```typescript
// Auto-detect columns by common header names
const DATE_HEADERS = ['date', 'posted', 'post date', 'transaction date', 'trans date'];
const DESC_HEADERS = ['description', 'transaction description', 'memo', 'details', 'narrative'];
const AMOUNT_HEADERS = ['amount', 'transaction amount', 'debit/credit', 'value'];
const BALANCE_HEADERS = ['balance', 'running balance', 'available balance', 'ledger balance'];
const DEBIT_HEADERS = ['debit', 'withdrawal', 'dr'];
const CREDIT_HEADERS = ['credit', 'deposit', 'cr'];
```

### Amount Sign Convention
```typescript
// Handle different bank formats
// Format A: Single amount column (negative = expense, positive = income)
// Format B: Separate debit/credit columns
// Format C: All positive with type indicator

function normalizeAmount(row: CSVRow): number {
  // If separate debit/credit columns
  if (row.debit && row.credit) {
    return row.credit ? parseFloat(row.credit) : -parseFloat(row.debit);
  }
  // Single amount column
  return parseFloat(row.amount);
}
```

### Date Parsing
```typescript
// Support multiple date formats
const DATE_FORMATS = [
  'MM/DD/YYYY', 'MM-DD-YYYY', 'MM DD YY',
  'DD/MM/YYYY', 'DD-MM-YYYY',
  'YYYY-MM-DD', 'YYYY/MM/DD',
  'MMM DD, YYYY', 'DD MMM YYYY'
];

function parseDate(dateStr: string): Date {
  // Try each format, return first successful parse
  // Validate: date should be within reasonable range (not future, not > 10 years old)
}
```

### Row Filtering
```typescript
// Exclude non-transaction rows
const EXCLUDE_PATTERNS = [
  /^previous balance/i,
  /^opening balance/i,
  /^beginning balance/i,
  /^closing balance/i,
  /^ending balance/i,
  /^new balance/i,
  /^balance forward/i,
  /^statement period/i,
];

function isValidTransaction(row: CSVRow): boolean {
  const desc = row.description?.toLowerCase() || '';
  return !EXCLUDE_PATTERNS.some(pattern => pattern.test(desc));
}
```

---

## Transaction Classification

### MCA Detection (CRITICAL)

MCA transactions are the most important to identify accurately.

#### MCA Lender Keywords
```typescript
const MCA_LENDER_PATTERNS = [
  // Major MCA providers
  /ebf\s*holdings/i, /everest\s*business\s*fund/i,
  /lendingpoint/i, /lending\s*point/i,
  /fundbox/i,
  /bluevine/i, /blue\s*vine/i,
  /ondeck/i, /on\s*deck/i,
  /kabbage/i,
  /can\s*capital/i,
  /rapid\s*finance/i, /rapidfinance/i,
  /credibly/i,
  /fora\s*financial/i,
  /pearl\s*capital/i,
  /forward\s*financing/i,
  /clearco/i,
  /pipe\s/i,
  /capify/i,
  /libertas/i,
  /bizfi/i,
  /bizfund/i,
  /yellowstone\s*capital/i,
  /national\s*funding/i,
  /payability/i,
  /behalf/i,
  /fundkite/i,
  /kalamata/i,
  /cloudfund/i,
  /itria\s*ventures/i,
  /merchant\s*cash/i,
  /business\s*advance/i,
  /revenue\s*based/i,
  /daily\s*ach/i,
  /split\s*funding/i,
];
```

#### MCA Classification Logic
```typescript
interface MCATransaction {
  lender: string;
  type: 'disbursal' | 'repayment';
  amount: number;
  date: Date;
}

function classifyMCA(transaction: Transaction): MCATransaction | null {
  const desc = transaction.description.toLowerCase();

  // Check against known lender patterns
  for (const pattern of MCA_LENDER_PATTERNS) {
    if (pattern.test(desc)) {
      return {
        lender: extractLenderName(desc, pattern),
        type: transaction.amount > 0 ? 'disbursal' : 'repayment',
        amount: Math.abs(transaction.amount),
        date: transaction.date
      };
    }
  }

  return null;
}

// Extract clean lender name from description
function extractLenderName(desc: string, matchedPattern: RegExp): string {
  const match = desc.match(matchedPattern);
  if (match) {
    return match[0]
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return 'Unknown MCA';
}
```

#### MCA Stacking Detection
```typescript
function detectMCAStacking(transactions: Transaction[]): StackingAlert[] {
  const alerts: StackingAlert[] = [];
  const activeMCAs: Map<string, { startDate: Date; lastPayment: Date }> = new Map();

  // Sort chronologically
  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const t of sorted) {
    const mca = classifyMCA(t);
    if (!mca) continue;

    if (mca.type === 'disbursal') {
      // Check if other MCAs are still active (payment within last 45 days)
      const now = mca.date.getTime();
      for (const [lender, status] of activeMCAs) {
        const daysSincePayment = (now - status.lastPayment.getTime()) / (1000 * 60 * 60 * 24);
        if (lender !== mca.lender && daysSincePayment < 45) {
          alerts.push({
            type: 'STACKING',
            message: `New MCA from ${mca.lender} while ${lender} still active`,
            date: t.date,
            severity: 'HIGH'
          });
        }
      }
      activeMCAs.set(mca.lender, { startDate: t.date, lastPayment: t.date });
    } else {
      // Update last payment date
      const existing = activeMCAs.get(mca.lender);
      if (existing) {
        existing.lastPayment = t.date;
      } else {
        // Payment to unknown MCA - might be from before statement period
        activeMCAs.set(mca.lender, { startDate: t.date, lastPayment: t.date });
      }
    }
  }

  return alerts;
}
```

### Income Classification

```typescript
const INCOME_CATEGORIES = {
  // Payment processors / Card sales
  CARD_SALES: [
    /square/i, /stripe/i, /paypal\s*(deposit|transfer|settlement)/i,
    /clover/i, /toast\s*deposit/i, /shopify/i,
    /merchant\s*services/i, /card\s*settlement/i,
    /visa\s*(settlement|deposit)/i, /mastercard\s*(settlement|deposit)/i,
    /amex\s*(settlement|deposit)/i, /discover\s*settlement/i,
    /first\s*data/i, /worldpay/i, /heartland/i, /tsys/i
  ],

  // ACH / Electronic deposits
  ACH_DEPOSITS: [
    /ach\s*(credit|deposit)/i, /electronic\s*deposit/i,
    /direct\s*deposit/i, /eft\s*credit/i,
    /online\s*(transfer|banking)/i, /ext\s*trnsfr/i
  ],

  // Wire transfers
  WIRE_TRANSFERS: [
    /wire\s*(credit|transfer|in)/i, /incoming\s*wire/i,
    /fed\s*wire/i, /swift/i, /intl\s*wire/i
  ],

  // Check deposits
  CHECK_DEPOSITS: [
    /check\s*deposit/i, /mobile\s*deposit/i, /remote\s*deposit/i,
    /counter\s*deposit/i, /atm\s*deposit/i, /branch\s*deposit/i
  ],

  // Cash deposits
  CASH_DEPOSITS: [
    /cash\s*deposit/i, /currency\s*deposit/i
  ],

  // Refunds
  REFUNDS: [
    /refund/i, /return(?!ed\s*item)/i, /reversal/i,
    /credit\s*adjustment/i, /chargeback\s*(won|reversal)/i,
    /purchase\s*return/i
  ],

  // Loans (non-MCA)
  LOAN_PROCEEDS: [
    /loan\s*proceed/i, /sba\s*(loan|deposit)/i,
    /line\s*of\s*credit/i, /loc\s*advance/i,
    /term\s*loan/i, /business\s*loan/i
  ],

  // P2P transfers
  P2P_INCOME: [
    /zelle.*(from|credit)/i, /venmo.*(from|deposit)/i,
    /cash\s*app.*(from|deposit)/i, /paypal.*from/i
  ],

  // Interest
  INTEREST_INCOME: [
    /interest\s*(paid|earned|credit)/i, /dividend/i
  ]
};

function classifyIncome(transaction: Transaction): string {
  const desc = transaction.description.toLowerCase();

  // First check if it's MCA disbursal (takes priority)
  if (classifyMCA(transaction)?.type === 'disbursal') {
    return 'MCA_FUNDING';
  }

  // Check each category
  for (const [category, patterns] of Object.entries(INCOME_CATEGORIES)) {
    if (patterns.some(p => p.test(desc))) {
      return category;
    }
  }

  return 'OTHER_INCOME';
}
```

### Expense Classification

```typescript
const EXPENSE_CATEGORIES = {
  // MCA Repayments - handled separately via classifyMCA()

  // Payroll
  PAYROLL: [
    /payroll/i, /gusto/i, /adp/i, /paychex/i,
    /quickbooks\s*payroll/i, /square\s*payroll/i,
    /salary/i, /wages/i, /direct\s*dep.*payroll/i,
    /paycor/i, /zenefits/i, /rippling/i
  ],

  // Rent / Lease
  RENT: [
    /\brent\b/i, /lease\s*payment/i, /property\s*management/i,
    /landlord/i, /realty/i, /commercial\s*lease/i,
    /office\s*space/i, /warehouse\s*rent/i
  ],

  // Utilities
  UTILITIES: [
    /electric/i, /\bgas\s*(bill|company|service)/i,
    /water\s*(bill|utility)/i, /utility/i,
    /power\s*company/i, /energy\s*(company|service)/i,
    /sewage/i, /trash/i, /waste\s*management/i,
    /\bfpl\b/i, /duke\s*energy/i, /pge/i, /con\s*edison/i
  ],

  // Telecom / Internet
  TELECOM: [
    /at&t/i, /verizon/i, /t-mobile/i, /sprint/i,
    /comcast/i, /xfinity/i, /spectrum/i, /cox/i,
    /\binternet\b/i, /phone\s*(bill|service)/i,
    /centurylink/i, /frontier/i, /windstream/i
  ],

  // Insurance
  INSURANCE: [
    /insurance/i, /geico/i, /state\s*farm/i, /allstate/i,
    /progressive/i, /liberty\s*mutual/i, /travelers/i,
    /workers\s*comp/i, /liability/i, /premium/i,
    /hartford/i, /nationwide/i, /usaa/i
  ],

  // Bank Fees (includes NSF)
  BANK_FEES: [
    /\bnsf\b/i, /overdraft/i, /insufficient\s*fund/i,
    /returned\s*item/i, /service\s*charge/i,
    /monthly\s*(fee|maintenance)/i, /account\s*fee/i,
    /wire\s*fee/i, /atm\s*fee/i, /foreign\s*transaction/i,
    /analysis\s*(fee|charge)/i
  ],

  // Professional Services
  PROFESSIONAL_SERVICES: [
    /attorney/i, /lawyer/i, /\blegal\b/i, /law\s*office/i,
    /accountant/i, /\bcpa\b/i, /accounting/i,
    /consultant/i, /bookkeep/i, /tax\s*prep/i
  ],

  // Inventory / COGS / Suppliers
  COGS: [
    /inventory/i, /supplier/i, /wholesale/i, /distributor/i,
    /raw\s*material/i, /manufacturer/i, /vendor\s*payment/i,
    /purchase\s*order/i, /\bpo\s*#/i, /merchandise/i,
    /cost\s*of\s*goods/i, /supplies/i
  ],

  // Marketing / Advertising
  MARKETING: [
    /google\s*(ads|adwords)/i, /facebook\s*(ads|advertising)/i,
    /\bmarketing\b/i, /advertising/i, /\byelp\b/i,
    /social\s*media/i, /\bseo\b/i, /instagram\s*ads/i,
    /tiktok\s*ads/i, /linkedin\s*ads/i, /mailchimp/i,
    /constant\s*contact/i, /hubspot/i
  ],

  // Software / Subscriptions
  SUBSCRIPTIONS: [
    /subscription/i, /monthly\s*(plan|fee)/i,
    /\bsaas\b/i, /software/i,
    /quickbooks/i, /adobe/i, /microsoft/i,
    /zoom/i, /slack/i, /dropbox/i, /google\s*workspace/i,
    /salesforce/i, /shopify\s*(fee|subscription)/i
  ],

  // Taxes
  TAXES: [
    /\birs\b/i, /tax\s*payment/i, /federal\s*tax/i,
    /state\s*tax/i, /sales\s*tax/i, /payroll\s*tax/i,
    /\beftps\b/i, /quarterly\s*tax/i, /estimated\s*tax/i,
    /property\s*tax/i, /franchise\s*tax/i
  ],

  // Owner Draws / Distributions
  OWNER_DRAWS: [
    /owner\s*(draw|distribution)/i, /shareholder/i,
    /member\s*distribution/i, /partner\s*draw/i,
    /\bdistribution\b/i
  ],

  // Credit Card Payments
  CREDIT_CARD_PAYMENTS: [
    /credit\s*card\s*payment/i, /card\s*payment/i,
    /chase\s*card/i, /amex\s*payment/i, /visa\s*payment/i,
    /mastercard\s*payment/i, /capital\s*one\s*payment/i,
    /citi\s*card/i, /discover\s*payment/i
  ],

  // P2P Outgoing
  P2P_PAYMENTS: [
    /zelle.*(to|send|payment)/i, /venmo.*(to|send|payment)/i,
    /cash\s*app.*(to|send|payment)/i
  ],

  // ATM / Cash Withdrawals
  ATM_WITHDRAWALS: [
    /atm\s*(withdrawal|w\/d)/i, /cash\s*withdrawal/i,
    /counter\s*withdrawal/i
  ],

  // Vehicle / Transportation
  VEHICLE: [
    /\bgas\b(?!\s*(bill|company|service))/i, /fuel/i,
    /car\s*payment/i, /auto\s*loan/i, /vehicle/i,
    /sunpass/i, /ezpass/i, /toll/i, /parking/i,
    /uber(?!\s*eats)/i, /lyft/i
  ],

  // Shipping / Logistics
  SHIPPING: [
    /fedex/i, /\bups\b/i, /usps/i, /dhl/i,
    /shipping/i, /freight/i, /postage/i, /stamps\.com/i
  ]
};

function classifyExpense(transaction: Transaction): string {
  const desc = transaction.description.toLowerCase();

  // First check if it's MCA repayment (takes priority)
  const mca = classifyMCA(transaction);
  if (mca?.type === 'repayment') {
    return `MCA_REPAYMENT_${mca.lender.toUpperCase().replace(/\s+/g, '_')}`;
  }

  // Check each category
  for (const [category, patterns] of Object.entries(EXPENSE_CATEGORIES)) {
    if (patterns.some(p => p.test(desc))) {
      return category;
    }
  }

  return 'OTHER_EXPENSE';
}
```

---

## Metrics Calculation

### NSF / Overdraft Tracking

```typescript
interface NSFMetrics {
  totalCount: number;
  totalFees: number;
  avgFeeAmount: number;
  frequencyPerMonth: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  monthlyBreakdown: Map<string, { count: number; fees: number }>;
}

function calculateNSFMetrics(transactions: Transaction[], months: number): NSFMetrics {
  // Filter to NSF/overdraft fee transactions only
  const nsfPattern = /\bnsf\b|overdraft|insufficient\s*fund|returned\s*item/i;

  const nsfTransactions = transactions.filter(t =>
    t.amount < 0 && nsfPattern.test(t.description)
  );

  const totalCount = nsfTransactions.length;
  const totalFees = nsfTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Monthly breakdown
  const monthlyBreakdown = new Map<string, { count: number; fees: number }>();
  for (const t of nsfTransactions) {
    const monthKey = formatMonthKey(t.date); // "YYYY-MM"
    const existing = monthlyBreakdown.get(monthKey) || { count: 0, fees: 0 };
    existing.count++;
    existing.fees += Math.abs(t.amount);
    monthlyBreakdown.set(monthKey, existing);
  }

  // Calculate trend
  const sortedMonths = Array.from(monthlyBreakdown.keys()).sort();
  const counts = sortedMonths.map(m => monthlyBreakdown.get(m)!.count);
  const trend = calculateTrend(counts);

  return {
    totalCount,
    totalFees,
    avgFeeAmount: totalCount > 0 ? totalFees / totalCount : 0,
    frequencyPerMonth: totalCount / months,
    trend,
    monthlyBreakdown
  };
}

function calculateTrend(values: number[]): 'INCREASING' | 'STABLE' | 'DECREASING' {
  if (values.length < 2) return 'STABLE';

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = (secondAvg - firstAvg) / (firstAvg || 1);

  if (change > 0.20) return 'INCREASING';
  if (change < -0.20) return 'DECREASING';
  return 'STABLE';
}
```

### Negative Balance Days (CRITICAL)

```typescript
interface BalanceHealth {
  negativeDays: number;        // Count of UNIQUE DATES with negative balance
  lowestBalance: number;
  highestBalance: number;
  endingBalance: number;
  avgDailyBalance: number;
  daysAnalyzed: number;
  monthlyNegativeDays: Map<string, number>;
}

function calculateBalanceHealth(transactions: Transaction[]): BalanceHealth {
  // CRITICAL: Use SET to count UNIQUE DATES, not transaction count
  const negativeDates = new Set<string>();
  const dailyEndingBalances = new Map<string, number>();
  const monthlyNegativeDays = new Map<string, Set<string>>();

  let lowestBalance = Infinity;
  let highestBalance = -Infinity;

  for (const t of transactions) {
    // Skip non-transaction rows
    if (/previous\s*balance|new\s*balance|opening|closing/i.test(t.description)) {
      continue;
    }

    const dateKey = formatDateKey(t.date);  // "YYYY-MM-DD"
    const monthKey = formatMonthKey(t.date); // "YYYY-MM"

    // Track daily ending balance (will be overwritten with last transaction of day)
    dailyEndingBalances.set(dateKey, t.balance);

    // Track if ANY transaction on this day resulted in negative balance
    if (t.balance < 0) {
      negativeDates.add(dateKey);

      // Also track by month
      if (!monthlyNegativeDays.has(monthKey)) {
        monthlyNegativeDays.set(monthKey, new Set());
      }
      monthlyNegativeDays.get(monthKey)!.add(dateKey);
    }

    // Track extremes
    lowestBalance = Math.min(lowestBalance, t.balance);
    highestBalance = Math.max(highestBalance, t.balance);
  }

  // Calculate average daily balance
  const balances = Array.from(dailyEndingBalances.values());
  const avgDailyBalance = balances.length > 0
    ? balances.reduce((a, b) => a + b, 0) / balances.length
    : 0;

  // Get ending balance (last date's balance)
  const sortedDates = Array.from(dailyEndingBalances.keys()).sort();
  const endingBalance = sortedDates.length > 0
    ? dailyEndingBalances.get(sortedDates[sortedDates.length - 1])!
    : 0;

  // Convert monthly sets to counts
  const monthlyNegativeDayCounts = new Map<string, number>();
  for (const [month, dates] of monthlyNegativeDays) {
    monthlyNegativeDayCounts.set(month, dates.size);
  }

  return {
    negativeDays: negativeDates.size,  // SIZE OF SET = unique dates
    lowestBalance: lowestBalance === Infinity ? 0 : lowestBalance,
    highestBalance: highestBalance === -Infinity ? 0 : highestBalance,
    endingBalance,
    avgDailyBalance,
    daysAnalyzed: dailyEndingBalances.size,
    monthlyNegativeDays: monthlyNegativeDayCounts
  };
}
```

### Revenue Analysis

```typescript
interface RevenueAnalysis {
  totalRevenue: number;
  byCategory: Map<string, number>;
  monthlyTrend: Map<string, number>;
  topSources: { source: string; amount: number; percentage: number }[];
}

function analyzeRevenue(transactions: Transaction[]): RevenueAnalysis {
  const incomeTransactions = transactions.filter(t =>
    t.amount > 0 &&
    !/previous\s*balance|new\s*balance/i.test(t.description)
  );

  const totalRevenue = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Categorize each transaction
  const byCategory = new Map<string, number>();
  for (const t of incomeTransactions) {
    const category = classifyIncome(t);
    byCategory.set(category, (byCategory.get(category) || 0) + t.amount);
  }

  // VALIDATION: Categories must sum to total
  const categorySum = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
  if (Math.abs(categorySum - totalRevenue) > 0.01) {
    console.error(`Revenue category mismatch: ${categorySum} vs ${totalRevenue}`);
    // Add difference to OTHER_INCOME to balance
    const diff = totalRevenue - categorySum;
    byCategory.set('OTHER_INCOME', (byCategory.get('OTHER_INCOME') || 0) + diff);
  }

  // Monthly trend
  const monthlyTrend = new Map<string, number>();
  for (const t of incomeTransactions) {
    const monthKey = formatMonthKey(t.date);
    monthlyTrend.set(monthKey, (monthlyTrend.get(monthKey) || 0) + t.amount);
  }

  // Top sources
  const topSources = Array.from(byCategory.entries())
    .map(([source, amount]) => ({
      source,
      amount,
      percentage: (amount / totalRevenue) * 100
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return { totalRevenue, byCategory, monthlyTrend, topSources };
}
```

### Expense Analysis

```typescript
interface ExpenseAnalysis {
  totalExpenses: number;
  byCategory: Map<string, number>;
  monthlyTrend: Map<string, number>;
  mcaRepayments: number;
  mcaByLender: Map<string, number>;
  operatingExpenses: number;
}

function analyzeExpenses(transactions: Transaction[]): ExpenseAnalysis {
  const expenseTransactions = transactions.filter(t =>
    t.amount < 0 &&
    !/previous\s*balance|new\s*balance/i.test(t.description)
  );

  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Categorize - MUST track MCA separately
  const byCategory = new Map<string, number>();
  const mcaByLender = new Map<string, number>();
  let mcaRepayments = 0;

  for (const t of expenseTransactions) {
    const category = classifyExpense(t);
    const amount = Math.abs(t.amount);

    byCategory.set(category, (byCategory.get(category) || 0) + amount);

    // Track MCA separately
    if (category.startsWith('MCA_REPAYMENT_')) {
      mcaRepayments += amount;
      const lender = category.replace('MCA_REPAYMENT_', '');
      mcaByLender.set(lender, (mcaByLender.get(lender) || 0) + amount);
    }
  }

  // VALIDATION: Categories MUST sum to total
  const categorySum = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
  if (Math.abs(categorySum - totalExpenses) > 0.01) {
    console.error(`CRITICAL: Expense categories (${categorySum}) != total (${totalExpenses})`);
    // Add difference to OTHER_EXPENSE to balance
    const diff = totalExpenses - categorySum;
    byCategory.set('OTHER_EXPENSE', (byCategory.get('OTHER_EXPENSE') || 0) + diff);
  }

  // Monthly trend
  const monthlyTrend = new Map<string, number>();
  for (const t of expenseTransactions) {
    const monthKey = formatMonthKey(t.date);
    monthlyTrend.set(monthKey, (monthlyTrend.get(monthKey) || 0) + Math.abs(t.amount));
  }

  return {
    totalExpenses,
    byCategory,
    monthlyTrend,
    mcaRepayments,
    mcaByLender,
    operatingExpenses: totalExpenses - mcaRepayments
  };
}
```

---

## Scoring System

### Score Calculation (0-100)

```typescript
function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

### Revenue Score
- **Base**: 70 points
- **Consistency** (+/-15): CV < 15% = +15, CV > 40% = -15
- **Trend** (+/-10): Growing = +10, Declining = -10
- **Diversity** (+/-10): Top source < 50% = +10, > 80% = -10
- **MCA Dependency** (+/-5): MCA funding > 30% of revenue = -5

### Expense Score
- **Base**: 70 points
- **Expense Ratio** (+/-15): < 70% = +15, > 95% = -15
- **Uncategorized** (+/-10): > 30% uncategorized = -10
- **MCA Burden** (+/-10): MCA > 20% of revenue = -10

### MCA Score
- **Base**: 100 points (deduct for risk)
- **Active positions**: 1 = -10, 2+ = -10 - (n-1)*20
- **Missed payments**: -15
- **Recent refinance**: -10
- **Stacking detected**: -20

### NSF Score
- **0 NSFs**: 100
- **<=1/month**: 80
- **<=3/month**: 60
- **<=5/month**: 40
- **>5/month**: 20
- **Trend adjustment**: Improving +10, Worsening -10

### Cash Flow Score
- **Base**: 70 points
- **Negative days** (+/-20): 0 = +20, < 10% = +10, > 30% = -20
- **Lowest balance** (+/-15): Always positive = +15, < -$5K = -15
- **Ending balance** (+/-10): Above avg = +10, Negative = -10

### Overall Score
```typescript
const weights = {
  revenue: 0.25,
  expenses: 0.20,
  mca: 0.25,
  nsf: 0.15,
  cashFlow: 0.15
};

overallScore =
  revenueScore * 0.25 +
  expenseScore * 0.20 +
  mcaScore * 0.25 +
  nsfScore * 0.15 +
  cashFlowScore * 0.15;
```

---

## Validation Checklist

### Before Displaying Any Dashboard

```typescript
function validateBeforeRender(analysis: FullAnalysis): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Revenue categories = Total revenue
  const revSum = sum(analysis.revenue.byCategory.values());
  if (Math.abs(revSum - analysis.revenue.totalRevenue) > 1) {
    errors.push(`Revenue breakdown doesn't sum to total`);
  }

  // 2. Expense categories = Total expenses (INCLUDING MCA)
  const expSum = sum(analysis.expenses.byCategory.values());
  if (Math.abs(expSum - analysis.expenses.totalExpenses) > 1) {
    errors.push(`Expense breakdown doesn't sum to total`);
  }

  // 3. Monthly totals = Overall totals
  const monthlyRevSum = sum(analysis.revenue.monthlyTrend.values());
  if (Math.abs(monthlyRevSum - analysis.revenue.totalRevenue) > 1) {
    errors.push(`Monthly revenue doesn't sum to total`);
  }

  // 4. Scores are within bounds
  for (const [name, score] of Object.entries(analysis.scores)) {
    if (score < 0 || score > 100) {
      errors.push(`${name} score out of bounds: ${score}`);
    }
  }

  // 5. Warn on high uncategorized
  const uncatPct = (analysis.expenses.byCategory.get('OTHER_EXPENSE') || 0)
                   / analysis.expenses.totalExpenses;
  if (uncatPct > 0.25) {
    warnings.push(`${(uncatPct * 100).toFixed(0)}% expenses uncategorized`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Common Bugs to Avoid

| Bug | Cause | Fix |
|-----|-------|-----|
| Categories don't sum to total | MCA excluded from expense breakdown | Always include MCA as line item |
| Wrong negative day count | Counting transactions instead of dates | Use Set<dateString>.size |
| Missing transactions | Filtered out balance rows | Only exclude "Previous/New Balance" |
| Duplicate transactions | Multiple file uploads | Dedupe by date+description+amount |
| Wrong date parsing | Assumed format | Auto-detect format first |
| MCA not detected | Missing lender pattern | Add to MCA_LENDER_PATTERNS |

---

## Testing Requirements

- [ ] Upload CSV -> Categories sum to totals
- [ ] Monthly breakdown sums to overall total
- [ ] MCA lenders auto-detected
- [ ] NSF count = fee transactions count
- [ ] Negative days = unique dates count
- [ ] All scores between 0-100
- [ ] Validation passes before render
- [ ] Drill-down shows source transactions
