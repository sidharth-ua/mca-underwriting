/**
 * Robust Metrics Calculator for MCA Underwriting
 * Handles multiple months of transaction data from multiple CSV/PDF sources
 */

export interface Transaction {
  id: string
  date: string | Date
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  runningBalance: number
  category?: string | null
  subcategory?: string | null
}

export interface MonthlyMetrics {
  month: string // YYYY-MM format
  revenue: RevenueBreakdown
  expenses: ExpenseBreakdown
  mca: MCAMetrics
  nsf: NSFMetrics
  cashFlow: CashFlowMetrics
}

export interface RevenueBreakdown {
  regularRevenue: number
  mcaFunding: number
  loanProceeds: number
  wireTransfers: number
  creditCardSales: number
  achDeposits: number
  checkDeposits: number
  refundsReceived: number
  otherRevenue: number
  // DDV-specific revenue categories
  zelleIncome: number
  statePayments: number
  counselingRevenue: number
  unassignedIncome: number
  total: number
  transactionCount: number
}

export interface ExpenseBreakdown {
  recurring: number        // Rent, utilities, subscriptions
  payroll: number
  vendorPayments: number
  ownerDraws: number
  cogs: number            // Cost of goods sold
  marketing: number
  professionalServices: number
  insurance: number
  taxes: number
  bankFees: number
  otherExpenses: number
  // DDV-specific expense categories
  settlement: number           // DDV Settlement payments
  loanPayment: number         // Non-MCA loan payments
  softwareSubscriptions: number // Software & SaaS
  travelEntertainment: number   // Travel & entertainment
  utilities: number            // Distinct utilities category
  rent: number                 // Distinct rent category
  personalExpenses: number     // Personal debit purchases
  businessExpenses: number     // Business debit purchases
  zellePayments: number        // Zelle outgoing payments
  creditCardPayments: number   // Credit card payments
  atmWithdrawals: number       // ATM withdrawals
  nsfFees: number             // NSF/Overdraft fees (distinct from bankFees)
  unassignedExpenses: number   // 99.UNASSIGNED transactions
  expenseReversals: number     // Expense reversal credits
  total: number
  transactionCount: number
}

export interface MCADetail {
  name: string
  paymentsTotal: number
  paymentCount: number
  dailyPaymentAvg: number
  fundingReceived: number
}

export interface MCAMetrics {
  fundingReceived: number
  paymentsTotal: number
  paymentCount: number
  dailyPaymentAvg: number
  uniqueMCACount: number
  mcaNames: string[]
  mcaDetails: MCADetail[]  // Detailed breakdown per MCA merchant
}

export interface NSFMetrics {
  count: number
  totalFees: number
  avgFee: number
  negativeBalanceDays: number
  lowestBalance: number
  overdraftEvents: number
}

export interface CashFlowMetrics {
  netCashFlow: number
  avgDailyBalance: number
  minBalance: number
  maxBalance: number
  endingBalance: number
  daysAnalyzed: number
}

export interface AggregatedMetrics {
  periodStart: Date
  periodEnd: Date
  monthsAnalyzed: number
  totalDaysAnalyzed: number

  // Totals
  totalRevenue: number
  totalExpenses: number
  netCashFlow: number

  // Averages
  avgMonthlyRevenue: number
  avgMonthlyExpenses: number
  avgMonthlyNetCashFlow: number
  avgDailyRevenue: number
  avgDailyExpenses: number

  // Breakdowns
  revenue: RevenueBreakdown
  expenses: ExpenseBreakdown
  mca: MCAMetrics & {
    monthlyRepayment: number
    paymentToRevenueRatio: number
    stackingIndicator: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  }
  nsf: NSFMetrics & {
    frequency: number  // Per month
    trend: 'IMPROVING' | 'STABLE' | 'WORSENING'
  }
  cashFlow: CashFlowMetrics & {
    volatility: number
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  }

  // Monthly data for charts
  monthlyData: MonthlyMetrics[]

  // Scores (0-100)
  scores: {
    revenue: number
    expenses: number
    mca: number
    nsf: number
    cashFlow: number
    overall: number
  }
}

// Category mapping for classification - includes DDV normalized categories
const CATEGORY_MAPPINGS: Record<string, { type: 'revenue' | 'expense', category: string }> = {
  // Revenue categories - Standard
  'revenue': { type: 'revenue', category: 'regularRevenue' },
  'income': { type: 'revenue', category: 'regularRevenue' },
  'sales': { type: 'revenue', category: 'regularRevenue' },
  'card_processing': { type: 'revenue', category: 'creditCardSales' },
  'credit_card': { type: 'revenue', category: 'creditCardSales' },
  'pos': { type: 'revenue', category: 'creditCardSales' },
  'square': { type: 'revenue', category: 'creditCardSales' },
  'stripe': { type: 'revenue', category: 'creditCardSales' },
  'ach_deposit': { type: 'revenue', category: 'achDeposits' },
  'ach_credit': { type: 'revenue', category: 'achDeposits' },
  'deposit': { type: 'revenue', category: 'achDeposits' },
  'wire_transfer': { type: 'revenue', category: 'wireTransfers' },
  'wire': { type: 'revenue', category: 'wireTransfers' },
  'check_deposit': { type: 'revenue', category: 'checkDeposits' },
  'check': { type: 'revenue', category: 'checkDeposits' },
  'refund': { type: 'revenue', category: 'refundsReceived' },
  'return': { type: 'revenue', category: 'refundsReceived' },
  'mca_funding': { type: 'revenue', category: 'mcaFunding' },
  'loan_proceeds': { type: 'revenue', category: 'loanProceeds' },

  // Revenue categories - DDV specific
  'revenue_counseling': { type: 'revenue', category: 'counselingRevenue' },
  'zelle_income': { type: 'revenue', category: 'zelleIncome' },
  'lfg_counselling': { type: 'revenue', category: 'counselingRevenue' },
  'zelle_receival': { type: 'revenue', category: 'zelleIncome' },
  'mca_disbursal': { type: 'revenue', category: 'mcaFunding' },
  'state_payment': { type: 'revenue', category: 'statePayments' },
  'counseling_revenue': { type: 'revenue', category: 'counselingRevenue' },
  'other_income': { type: 'revenue', category: 'otherRevenue' },
  'unassigned_income': { type: 'revenue', category: 'unassignedIncome' },

  // Expense categories - Standard
  'mca_payment': { type: 'expense', category: 'mca' },
  'mca': { type: 'expense', category: 'mca' },
  'daily_debit': { type: 'expense', category: 'mca' },
  'merchant_cash': { type: 'expense', category: 'mca' },
  'payroll': { type: 'expense', category: 'payroll' },
  'salary': { type: 'expense', category: 'payroll' },
  'wages': { type: 'expense', category: 'payroll' },
  'adp': { type: 'expense', category: 'payroll' },
  'gusto': { type: 'expense', category: 'payroll' },
  'rent': { type: 'expense', category: 'recurring' },
  'lease': { type: 'expense', category: 'recurring' },
  'utilities': { type: 'expense', category: 'recurring' },
  'utility': { type: 'expense', category: 'recurring' },
  'electric': { type: 'expense', category: 'recurring' },
  'gas': { type: 'expense', category: 'recurring' },
  'water': { type: 'expense', category: 'recurring' },
  'internet': { type: 'expense', category: 'recurring' },
  'phone': { type: 'expense', category: 'recurring' },
  'subscription': { type: 'expense', category: 'recurring' },
  'vendor_payment': { type: 'expense', category: 'vendorPayments' },
  'vendor': { type: 'expense', category: 'vendorPayments' },
  'supplier': { type: 'expense', category: 'vendorPayments' },
  'owner_draw': { type: 'expense', category: 'ownerDraws' },
  'owner_withdrawal': { type: 'expense', category: 'ownerDraws' },
  'draw': { type: 'expense', category: 'ownerDraws' },
  'cogs': { type: 'expense', category: 'cogs' },
  'inventory': { type: 'expense', category: 'cogs' },
  'supplies': { type: 'expense', category: 'cogs' },
  'marketing': { type: 'expense', category: 'marketing' },
  'advertising': { type: 'expense', category: 'marketing' },
  'promo': { type: 'expense', category: 'marketing' },
  'professional': { type: 'expense', category: 'professionalServices' },
  'legal': { type: 'expense', category: 'professionalServices' },
  'accounting': { type: 'expense', category: 'professionalServices' },
  'consulting': { type: 'expense', category: 'professionalServices' },
  'insurance': { type: 'expense', category: 'insurance' },
  'tax': { type: 'expense', category: 'taxes' },
  'taxes': { type: 'expense', category: 'taxes' },
  'irs': { type: 'expense', category: 'taxes' },
  'nsf': { type: 'expense', category: 'nsf' },
  'nsf_fee': { type: 'expense', category: 'nsf' },
  'overdraft': { type: 'expense', category: 'nsf' },
  'insufficient': { type: 'expense', category: 'nsf' },
  'returned_item': { type: 'expense', category: 'nsf' },
  'bank_fee': { type: 'expense', category: 'bankFees' },
  'service_charge': { type: 'expense', category: 'bankFees' },
  'fee': { type: 'expense', category: 'bankFees' },
  'loan_payment': { type: 'expense', category: 'loanPayment' },

  // Expense categories - DDV specific (using new breakdown fields)
  'software_subscriptions': { type: 'expense', category: 'softwareSubscriptions' },
  'travel_entertainment': { type: 'expense', category: 'travelEntertainment' },
  'professional_services': { type: 'expense', category: 'professionalServices' },
  'zelle_expense': { type: 'expense', category: 'zellePayments' },
  'zelle_pmt': { type: 'expense', category: 'zellePayments' },
  'zelle_payment': { type: 'expense', category: 'zellePayments' },
  'settlement': { type: 'expense', category: 'settlement' },
  'ddv_settlement': { type: 'expense', category: 'settlement' },
  'personal_expense': { type: 'expense', category: 'personalExpenses' },
  'personal___debit_purchases': { type: 'expense', category: 'personalExpenses' },
  'business_expense': { type: 'expense', category: 'businessExpenses' },
  'business___debit_purchases': { type: 'expense', category: 'businessExpenses' },
  'credit_card_payment': { type: 'expense', category: 'creditCardPayments' },
  'pmts_to_credit_card': { type: 'expense', category: 'creditCardPayments' },
  'atm_withdrawal': { type: 'expense', category: 'atmWithdrawals' },
  'electronic_withdrawal': { type: 'expense', category: 'otherExpenses' },
  'unassigned_expense': { type: 'expense', category: 'unassignedExpenses' },
  'expense_reversal': { type: 'expense', category: 'expenseReversals' },
  'other_expense': { type: 'expense', category: 'otherExpenses' },
  'uber___ubereats': { type: 'expense', category: 'otherExpenses' },
  'telecom': { type: 'expense', category: 'recurring' },
}

// Row filtering - exclude non-transaction rows (from CLAUDE.md)
const EXCLUDE_PATTERNS: RegExp[] = [
  /^previous\s*balance/i,
  /^opening\s*balance/i,
  /^beginning\s*balance/i,
  /^closing\s*balance/i,
  /^ending\s*balance/i,
  /^new\s*balance/i,
  /^balance\s*forward/i,
  /^statement\s*period/i,
]

/**
 * Check if a row should be excluded from transaction processing
 */
export function isExcludedRow(description: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(description))
}

// Comprehensive Income Classification Patterns from CLAUDE.md
const INCOME_PATTERNS: Record<string, RegExp[]> = {
  // Payment processors / Card sales
  CARD_SALES: [
    /square/i, /stripe/i, /paypal\s*(deposit|transfer|settlement)/i,
    /clover/i, /toast\s*deposit/i, /shopify/i,
    /merchant\s*services/i, /card\s*settlement/i,
    /visa\s*(settlement|deposit)/i, /mastercard\s*(settlement|deposit)/i,
    /amex\s*(settlement|deposit)/i, /discover\s*settlement/i,
    /first\s*data/i, /worldpay/i, /heartland/i, /tsys/i,
  ],
  // ACH / Electronic deposits
  ACH_DEPOSITS: [
    /ach\s*(credit|deposit)/i, /electronic\s*deposit/i,
    /direct\s*deposit/i, /eft\s*credit/i,
    /online\s*(transfer|banking)/i, /ext\s*trnsfr/i,
  ],
  // Wire transfers
  WIRE_TRANSFERS: [
    /wire\s*(credit|transfer|in)/i, /incoming\s*wire/i,
    /fed\s*wire/i, /swift/i, /intl\s*wire/i,
  ],
  // Check deposits
  CHECK_DEPOSITS: [
    /check\s*deposit/i, /mobile\s*deposit/i, /remote\s*deposit/i,
    /counter\s*deposit/i, /atm\s*deposit/i, /branch\s*deposit/i,
  ],
  // Cash deposits
  CASH_DEPOSITS: [
    /cash\s*deposit/i, /currency\s*deposit/i,
  ],
  // Refunds
  REFUNDS: [
    /refund/i, /return(?!ed\s*item)/i, /reversal/i,
    /credit\s*adjustment/i, /chargeback\s*(won|reversal)/i,
    /purchase\s*return/i,
  ],
  // Loans (non-MCA)
  LOAN_PROCEEDS: [
    /loan\s*proceed/i, /sba\s*(loan|deposit)/i,
    /line\s*of\s*credit/i, /loc\s*advance/i,
    /term\s*loan/i, /business\s*loan/i,
  ],
  // P2P transfers
  P2P_INCOME: [
    /zelle.*(from|credit)/i, /venmo.*(from|deposit)/i,
    /cash\s*app.*(from|deposit)/i, /paypal.*from/i,
  ],
  // Interest
  INTEREST_INCOME: [
    /interest\s*(paid|earned|credit)/i, /dividend/i,
  ],
}

// Comprehensive Expense Classification Patterns from CLAUDE.md
const EXPENSE_PATTERNS: Record<string, RegExp[]> = {
  // Payroll
  PAYROLL: [
    /payroll/i, /gusto/i, /adp/i, /paychex/i,
    /quickbooks\s*payroll/i, /square\s*payroll/i,
    /salary/i, /wages/i, /direct\s*dep.*payroll/i,
    /paycor/i, /zenefits/i, /rippling/i,
  ],
  // Rent / Lease
  RENT: [
    /\brent\b/i, /lease\s*payment/i, /property\s*management/i,
    /landlord/i, /realty/i, /commercial\s*lease/i,
    /office\s*space/i, /warehouse\s*rent/i,
  ],
  // Utilities
  UTILITIES: [
    /electric/i, /\bgas\s*(bill|company|service)/i,
    /water\s*(bill|utility)/i, /utility/i,
    /power\s*company/i, /energy\s*(company|service)/i,
    /sewage/i, /trash/i, /waste\s*management/i,
    /\bfpl\b/i, /duke\s*energy/i, /pge/i, /con\s*edison/i,
  ],
  // Telecom / Internet
  TELECOM: [
    /at&t/i, /verizon/i, /t-mobile/i, /sprint/i,
    /comcast/i, /xfinity/i, /spectrum/i, /cox/i,
    /\binternet\b/i, /phone\s*(bill|service)/i,
    /centurylink/i, /frontier/i, /windstream/i,
  ],
  // Insurance
  INSURANCE: [
    /insurance/i, /geico/i, /state\s*farm/i, /allstate/i,
    /progressive/i, /liberty\s*mutual/i, /travelers/i,
    /workers\s*comp/i, /liability/i, /premium/i,
    /hartford/i, /nationwide/i, /usaa/i,
  ],
  // Bank Fees (includes NSF)
  BANK_FEES: [
    /\bnsf\b/i, /overdraft/i, /insufficient\s*fund/i,
    /returned\s*item/i, /service\s*charge/i,
    /monthly\s*(fee|maintenance)/i, /account\s*fee/i,
    /wire\s*fee/i, /atm\s*fee/i, /foreign\s*transaction/i,
    /analysis\s*(fee|charge)/i,
  ],
  // Professional Services
  PROFESSIONAL_SERVICES: [
    /attorney/i, /lawyer/i, /\blegal\b/i, /law\s*office/i,
    /accountant/i, /\bcpa\b/i, /accounting/i,
    /consultant/i, /bookkeep/i, /tax\s*prep/i,
  ],
  // Inventory / COGS / Suppliers
  COGS: [
    /inventory/i, /supplier/i, /wholesale/i, /distributor/i,
    /raw\s*material/i, /manufacturer/i, /vendor\s*payment/i,
    /purchase\s*order/i, /\bpo\s*#/i, /merchandise/i,
    /cost\s*of\s*goods/i, /supplies/i,
  ],
  // Marketing / Advertising
  MARKETING: [
    /google\s*(ads|adwords)/i, /facebook\s*(ads|advertising)/i,
    /\bmarketing\b/i, /advertising/i, /\byelp\b/i,
    /social\s*media/i, /\bseo\b/i, /instagram\s*ads/i,
    /tiktok\s*ads/i, /linkedin\s*ads/i, /mailchimp/i,
    /constant\s*contact/i, /hubspot/i,
  ],
  // Software / Subscriptions
  SUBSCRIPTIONS: [
    /subscription/i, /monthly\s*(plan|fee)/i,
    /\bsaas\b/i, /software/i,
    /quickbooks/i, /adobe/i, /microsoft/i,
    /zoom/i, /slack/i, /dropbox/i, /google\s*workspace/i,
    /salesforce/i, /shopify\s*(fee|subscription)/i,
  ],
  // Taxes
  TAXES: [
    /\birs\b/i, /tax\s*payment/i, /federal\s*tax/i,
    /state\s*tax/i, /sales\s*tax/i, /payroll\s*tax/i,
    /\beftps\b/i, /quarterly\s*tax/i, /estimated\s*tax/i,
    /property\s*tax/i, /franchise\s*tax/i,
  ],
  // Owner Draws / Distributions
  OWNER_DRAWS: [
    /owner\s*(draw|distribution)/i, /shareholder/i,
    /member\s*distribution/i, /partner\s*draw/i,
    /\bdistribution\b/i,
  ],
  // Credit Card Payments
  CREDIT_CARD_PAYMENTS: [
    /credit\s*card\s*payment/i, /card\s*payment/i,
    /chase\s*card/i, /amex\s*payment/i, /visa\s*payment/i,
    /mastercard\s*payment/i, /capital\s*one\s*payment/i,
    /citi\s*card/i, /discover\s*payment/i,
  ],
  // P2P Outgoing
  P2P_PAYMENTS: [
    /zelle.*(to|send|payment)/i, /venmo.*(to|send|payment)/i,
    /cash\s*app.*(to|send|payment)/i,
  ],
  // ATM / Cash Withdrawals
  ATM_WITHDRAWALS: [
    /atm\s*(withdrawal|w\/d)/i, /cash\s*withdrawal/i,
    /counter\s*withdrawal/i,
  ],
  // Vehicle / Transportation
  VEHICLE: [
    /\bgas\b(?!\s*(bill|company|service))/i, /fuel/i,
    /car\s*payment/i, /auto\s*loan/i, /vehicle/i,
    /sunpass/i, /ezpass/i, /toll/i, /parking/i,
    /uber(?!\s*eats)/i, /lyft/i,
  ],
  // Shipping / Logistics
  SHIPPING: [
    /fedex/i, /\bups\b/i, /usps/i, /dhl/i,
    /shipping/i, /freight/i, /postage/i, /stamps\.com/i,
  ],
}

// Comprehensive MCA lender patterns from CLAUDE.md guidelines
const MCA_LENDER_PATTERNS: RegExp[] = [
  // Major MCA providers
  /ebf\s*holdings/i, /everest\s*business\s*fund/i, /everest business/i,
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
  /capytal/i,
]

// Keywords for classification when category is not provided
const DESCRIPTION_KEYWORDS: Record<string, { type: 'revenue' | 'expense', category: string }> = {
  // Revenue keywords
  'deposit': { type: 'revenue', category: 'achDeposits' },
  'credit card': { type: 'revenue', category: 'creditCardSales' },
  'pos': { type: 'revenue', category: 'creditCardSales' },
  'square': { type: 'revenue', category: 'creditCardSales' },
  'stripe': { type: 'revenue', category: 'creditCardSales' },
  'paypal': { type: 'revenue', category: 'creditCardSales' },
  'wire in': { type: 'revenue', category: 'wireTransfers' },
  'incoming wire': { type: 'revenue', category: 'wireTransfers' },
  'wire credit': { type: 'revenue', category: 'wireTransfers' },
  'refund': { type: 'revenue', category: 'refundsReceived' },
  'funding': { type: 'revenue', category: 'mcaFunding' },
  'advance': { type: 'revenue', category: 'mcaFunding' },
  'zelle instant': { type: 'revenue', category: 'achDeposits' },
  'pmt from': { type: 'revenue', category: 'achDeposits' },

  // Expense keywords - MCA specific (common MCA company names)
  'ebf holdings': { type: 'expense', category: 'mca' },
  'ebf': { type: 'expense', category: 'mca' },
  'lendingpoint': { type: 'expense', category: 'mca' },
  'lending point': { type: 'expense', category: 'mca' },
  'everest business': { type: 'expense', category: 'mca' },
  'capytal': { type: 'expense', category: 'mca' },
  'credibly': { type: 'expense', category: 'mca' },
  'rapid finance': { type: 'expense', category: 'mca' },
  'rapidfinance': { type: 'expense', category: 'mca' },
  'can capital': { type: 'expense', category: 'mca' },
  'fundbox': { type: 'expense', category: 'mca' },
  'kabbage': { type: 'expense', category: 'mca' },
  'bluevine': { type: 'expense', category: 'mca' },
  'blue vine': { type: 'expense', category: 'mca' },
  'ondeck': { type: 'expense', category: 'mca' },
  'on deck': { type: 'expense', category: 'mca' },
  'fora financial': { type: 'expense', category: 'mca' },
  'pearl capital': { type: 'expense', category: 'mca' },
  'forward financing': { type: 'expense', category: 'mca' },
  'clearco': { type: 'expense', category: 'mca' },
  'capify': { type: 'expense', category: 'mca' },
  'libertas': { type: 'expense', category: 'mca' },
  'bizfi': { type: 'expense', category: 'mca' },
  'bizfund': { type: 'expense', category: 'mca' },
  'yellowstone capital': { type: 'expense', category: 'mca' },
  'national funding': { type: 'expense', category: 'mca' },
  'payability': { type: 'expense', category: 'mca' },
  'behalf': { type: 'expense', category: 'mca' },
  'fundkite': { type: 'expense', category: 'mca' },
  'kalamata': { type: 'expense', category: 'mca' },
  'cloudfund': { type: 'expense', category: 'mca' },
  'itria ventures': { type: 'expense', category: 'mca' },
  'daily debit': { type: 'expense', category: 'mca' },
  'daily payment': { type: 'expense', category: 'mca' },
  'daily ach': { type: 'expense', category: 'mca' },
  'merchant cash': { type: 'expense', category: 'mca' },
  'split funding': { type: 'expense', category: 'mca' },
  'business advance': { type: 'expense', category: 'mca' },
  'revenue based': { type: 'expense', category: 'mca' },

  // Other expense keywords
  'payroll': { type: 'expense', category: 'payroll' },
  'adp': { type: 'expense', category: 'payroll' },
  'gusto': { type: 'expense', category: 'payroll' },
  'paychex': { type: 'expense', category: 'payroll' },
  'paycor': { type: 'expense', category: 'payroll' },
  'zenefits': { type: 'expense', category: 'payroll' },
  'rippling': { type: 'expense', category: 'payroll' },
  'rent': { type: 'expense', category: 'recurring' },
  'lease': { type: 'expense', category: 'recurring' },
  'electric': { type: 'expense', category: 'recurring' },
  'utility': { type: 'expense', category: 'recurring' },
  'godaddy': { type: 'expense', category: 'recurring' },
  'youtube': { type: 'expense', category: 'recurring' },
  'hulu': { type: 'expense', category: 'recurring' },
  'apple.com': { type: 'expense', category: 'recurring' },
  'ring': { type: 'expense', category: 'recurring' },
  'uber': { type: 'expense', category: 'otherExpenses' },
  'nsf': { type: 'expense', category: 'nsf' },
  'overdraft': { type: 'expense', category: 'nsf' },
  'overdraft paid fee': { type: 'expense', category: 'nsf' },
  'insufficient': { type: 'expense', category: 'nsf' },
  'returned item': { type: 'expense', category: 'nsf' },
  'service charge': { type: 'expense', category: 'bankFees' },
  'maintenance fee': { type: 'expense', category: 'bankFees' },
  'pmt to': { type: 'expense', category: 'otherExpenses' },
  'zelle debit': { type: 'expense', category: 'otherExpenses' },
}

/**
 * Extract MCA name from DDV subcategory (e.g., "Expense - MCA - EBF" -> "EBF")
 */
function extractMCAName(subcategory: string | null | undefined): string | null {
  if (!subcategory) return null
  const match = subcategory.match(/MCA\s*-\s*([A-Za-z0-9]+)/i)
  return match ? match[1].toUpperCase() : null
}

/**
 * Classify a transaction based on its category and description
 */
function classifyTransaction(transaction: Transaction): { type: 'revenue' | 'expense', category: string, mcaName?: string } {
  const category = transaction.category?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') || ''
  const subcategory = transaction.subcategory?.toLowerCase() || ''
  const description = transaction.description.toLowerCase()

  // Extract MCA name if present in subcategory (DDV format: "Expense - MCA - EBF")
  const mcaName = extractMCAName(transaction.subcategory)

  // First try category mapping
  if (category && CATEGORY_MAPPINGS[category]) {
    return { ...CATEGORY_MAPPINGS[category], mcaName: mcaName || undefined }
  }

  // Check for MCA-related categories in DDV format
  if (subcategory.includes('mca') || category.includes('mca')) {
    if (subcategory.includes('disbursal') || category.includes('disbursal')) {
      return { type: 'revenue', category: 'mcaFunding', mcaName: mcaName || undefined }
    }
    if (subcategory.includes('repayment') || category.includes('repayment') || transaction.type === 'DEBIT') {
      return { type: 'expense', category: 'mca', mcaName: mcaName || undefined }
    }
  }

  // Check for specific DDV categories
  if (subcategory.includes('overdraft') || subcategory.includes('bank fees') || subcategory.includes('nsf')) {
    return { type: 'expense', category: 'nsf' }
  }
  if (subcategory.includes('rent')) {
    return { type: 'expense', category: 'recurring' }
  }
  if (subcategory.includes('software') || subcategory.includes('subscription')) {
    return { type: 'expense', category: 'recurring' }
  }
  if (subcategory.includes('professional') || subcategory.includes('legal')) {
    return { type: 'expense', category: 'professionalServices' }
  }
  if (subcategory.includes('utilities') || subcategory.includes('telecom')) {
    return { type: 'expense', category: 'recurring' }
  }
  if (subcategory.includes('personal')) {
    return { type: 'expense', category: 'ownerDraws' }
  }
  if (subcategory.includes('settlement')) {
    return { type: 'expense', category: 'otherExpenses' }
  }

  // Then try description keywords
  for (const [keyword, mapping] of Object.entries(DESCRIPTION_KEYWORDS)) {
    if (description.includes(keyword)) {
      return mapping
    }
  }

  // Use comprehensive INCOME_PATTERNS for credits
  if (transaction.type === 'CREDIT') {
    // Check MCA first
    for (const pattern of MCA_LENDER_PATTERNS) {
      if (pattern.test(description)) {
        return { type: 'revenue', category: 'mcaFunding' }
      }
    }
    // Check income patterns
    for (const [patternName, patterns] of Object.entries(INCOME_PATTERNS)) {
      if (patterns.some(p => p.test(description))) {
        switch (patternName) {
          case 'CARD_SALES': return { type: 'revenue', category: 'creditCardSales' }
          case 'ACH_DEPOSITS': return { type: 'revenue', category: 'achDeposits' }
          case 'WIRE_TRANSFERS': return { type: 'revenue', category: 'wireTransfers' }
          case 'CHECK_DEPOSITS': return { type: 'revenue', category: 'checkDeposits' }
          case 'CASH_DEPOSITS': return { type: 'revenue', category: 'achDeposits' }
          case 'REFUNDS': return { type: 'revenue', category: 'refundsReceived' }
          case 'LOAN_PROCEEDS': return { type: 'revenue', category: 'loanProceeds' }
          case 'P2P_INCOME': return { type: 'revenue', category: 'zelleIncome' }
          case 'INTEREST_INCOME': return { type: 'revenue', category: 'otherRevenue' }
        }
      }
    }
    return { type: 'revenue', category: 'otherRevenue' }
  }

  // Use comprehensive EXPENSE_PATTERNS for debits
  // Check MCA first
  for (const pattern of MCA_LENDER_PATTERNS) {
    if (pattern.test(description)) {
      const lenderMatch = description.match(pattern)
      const lenderName = lenderMatch ? lenderMatch[0].replace(/\s+/g, ' ').trim().toUpperCase() : undefined
      return { type: 'expense', category: 'mca', mcaName: lenderName }
    }
  }
  // Check expense patterns
  for (const [patternName, patterns] of Object.entries(EXPENSE_PATTERNS)) {
    if (patterns.some(p => p.test(description))) {
      switch (patternName) {
        case 'PAYROLL': return { type: 'expense', category: 'payroll' }
        case 'RENT': return { type: 'expense', category: 'rent' }
        case 'UTILITIES': return { type: 'expense', category: 'utilities' }
        case 'TELECOM': return { type: 'expense', category: 'recurring' }
        case 'INSURANCE': return { type: 'expense', category: 'insurance' }
        case 'BANK_FEES': return { type: 'expense', category: 'nsf' }
        case 'PROFESSIONAL_SERVICES': return { type: 'expense', category: 'professionalServices' }
        case 'COGS': return { type: 'expense', category: 'cogs' }
        case 'MARKETING': return { type: 'expense', category: 'marketing' }
        case 'SUBSCRIPTIONS': return { type: 'expense', category: 'softwareSubscriptions' }
        case 'TAXES': return { type: 'expense', category: 'taxes' }
        case 'OWNER_DRAWS': return { type: 'expense', category: 'ownerDraws' }
        case 'CREDIT_CARD_PAYMENTS': return { type: 'expense', category: 'creditCardPayments' }
        case 'P2P_PAYMENTS': return { type: 'expense', category: 'zellePayments' }
        case 'ATM_WITHDRAWALS': return { type: 'expense', category: 'atmWithdrawals' }
        case 'VEHICLE': return { type: 'expense', category: 'travelEntertainment' }
        case 'SHIPPING': return { type: 'expense', category: 'vendorPayments' }
      }
    }
  }

  return { type: 'expense', category: 'otherExpenses' }
}

/**
 * Get month key from date
 */
function getMonthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Initialize empty revenue breakdown
 */
function initRevenueBreakdown(): RevenueBreakdown {
  return {
    regularRevenue: 0,
    mcaFunding: 0,
    loanProceeds: 0,
    wireTransfers: 0,
    creditCardSales: 0,
    achDeposits: 0,
    checkDeposits: 0,
    refundsReceived: 0,
    otherRevenue: 0,
    // DDV-specific
    zelleIncome: 0,
    statePayments: 0,
    counselingRevenue: 0,
    unassignedIncome: 0,
    total: 0,
    transactionCount: 0,
  }
}

/**
 * Initialize empty expense breakdown
 */
function initExpenseBreakdown(): ExpenseBreakdown {
  return {
    recurring: 0,
    payroll: 0,
    vendorPayments: 0,
    ownerDraws: 0,
    cogs: 0,
    marketing: 0,
    professionalServices: 0,
    insurance: 0,
    taxes: 0,
    bankFees: 0,
    otherExpenses: 0,
    // DDV-specific
    settlement: 0,
    loanPayment: 0,
    softwareSubscriptions: 0,
    travelEntertainment: 0,
    utilities: 0,
    rent: 0,
    personalExpenses: 0,
    businessExpenses: 0,
    zellePayments: 0,
    creditCardPayments: 0,
    atmWithdrawals: 0,
    nsfFees: 0,
    unassignedExpenses: 0,
    expenseReversals: 0,
    total: 0,
    transactionCount: 0,
  }
}

/**
 * Calculate metrics for a single month
 */
function calculateMonthlyMetrics(transactions: Transaction[], monthKey: string): MonthlyMetrics {
  const revenue = initRevenueBreakdown()
  const expenses = initExpenseBreakdown()
  const mca: MCAMetrics = {
    fundingReceived: 0,
    paymentsTotal: 0,
    paymentCount: 0,
    dailyPaymentAvg: 0,
    uniqueMCACount: 0,
    mcaNames: [],
    mcaDetails: [],
  }

  // Track per-MCA details
  const mcaPaymentsByName = new Map<string, { payments: number, count: number, funding: number }>()
  const nsf: NSFMetrics = {
    count: 0,
    totalFees: 0,
    avgFee: 0,
    negativeBalanceDays: 0,
    lowestBalance: Infinity,
    overdraftEvents: 0,
  }
  const cashFlow: CashFlowMetrics = {
    netCashFlow: 0,
    avgDailyBalance: 0,
    minBalance: Infinity,
    maxBalance: -Infinity,
    endingBalance: 0,
    daysAnalyzed: 0,
  }

  const mcaPatterns = new Set<string>()
  const negativeDays = new Set<string>()
  const dailyBalances: number[] = []
  const seenDates = new Set<string>()

  for (const txn of transactions) {
    const classification = classifyTransaction(txn)
    const date = new Date(txn.date)
    const dateStr = date.toISOString().split('T')[0]

    // Track unique days
    if (!seenDates.has(dateStr)) {
      seenDates.add(dateStr)
      dailyBalances.push(txn.runningBalance)
    }

    // Track balance metrics
    if (txn.runningBalance < nsf.lowestBalance) nsf.lowestBalance = txn.runningBalance
    if (txn.runningBalance < cashFlow.minBalance) cashFlow.minBalance = txn.runningBalance
    if (txn.runningBalance > cashFlow.maxBalance) cashFlow.maxBalance = txn.runningBalance
    if (txn.runningBalance < 0) negativeDays.add(dateStr)

    if (txn.type === 'CREDIT') {
      // Revenue transaction
      revenue.transactionCount++
      revenue.total += txn.amount

      switch (classification.category) {
        case 'regularRevenue': revenue.regularRevenue += txn.amount; break
        case 'mcaFunding':
          revenue.mcaFunding += txn.amount
          mca.fundingReceived += txn.amount
          // Track MCA funding by name
          if (classification.mcaName) {
            const existing = mcaPaymentsByName.get(classification.mcaName) || { payments: 0, count: 0, funding: 0 }
            existing.funding += txn.amount
            mcaPaymentsByName.set(classification.mcaName, existing)
            mcaPatterns.add(classification.mcaName)
          }
          break
        case 'loanProceeds': revenue.loanProceeds += txn.amount; break
        case 'wireTransfers': revenue.wireTransfers += txn.amount; break
        case 'creditCardSales': revenue.creditCardSales += txn.amount; break
        case 'achDeposits': revenue.achDeposits += txn.amount; break
        case 'checkDeposits': revenue.checkDeposits += txn.amount; break
        case 'refundsReceived': revenue.refundsReceived += txn.amount; break
        // DDV-specific revenue categories
        case 'zelleIncome': revenue.zelleIncome += txn.amount; break
        case 'statePayments': revenue.statePayments += txn.amount; break
        case 'counselingRevenue': revenue.counselingRevenue += txn.amount; break
        case 'unassignedIncome': revenue.unassignedIncome += txn.amount; break
        default: revenue.otherRevenue += txn.amount
      }
    } else {
      // Expense transaction
      expenses.transactionCount++
      expenses.total += txn.amount

      switch (classification.category) {
        case 'mca':
          mca.paymentsTotal += txn.amount
          mca.paymentCount++
          // Use MCA name from classification (DDV format) or extract from description
          let mcaName = classification.mcaName || null
          if (!mcaName) {
            const mcaMatch = txn.description.match(/(?:mca|daily|payment)[:\s-]*([a-z0-9]+)/i)
            if (mcaMatch) mcaName = mcaMatch[1].toUpperCase()
          }
          if (mcaName) {
            mcaPatterns.add(mcaName)
            // Track per-MCA payments
            const existing = mcaPaymentsByName.get(mcaName) || { payments: 0, count: 0, funding: 0 }
            existing.payments += txn.amount
            existing.count++
            mcaPaymentsByName.set(mcaName, existing)
          }
          break
        case 'payroll': expenses.payroll += txn.amount; break
        case 'recurring': expenses.recurring += txn.amount; break
        case 'vendorPayments': expenses.vendorPayments += txn.amount; break
        case 'ownerDraws': expenses.ownerDraws += txn.amount; break
        case 'cogs': expenses.cogs += txn.amount; break
        case 'marketing': expenses.marketing += txn.amount; break
        case 'professionalServices': expenses.professionalServices += txn.amount; break
        case 'insurance': expenses.insurance += txn.amount; break
        case 'taxes': expenses.taxes += txn.amount; break
        case 'nsf':
          nsf.count++
          nsf.totalFees += txn.amount
          expenses.nsfFees += txn.amount
          break
        case 'bankFees': expenses.bankFees += txn.amount; break
        // DDV-specific expense categories
        case 'settlement': expenses.settlement += txn.amount; break
        case 'loanPayment': expenses.loanPayment += txn.amount; break
        case 'softwareSubscriptions': expenses.softwareSubscriptions += txn.amount; break
        case 'travelEntertainment': expenses.travelEntertainment += txn.amount; break
        case 'utilities': expenses.utilities += txn.amount; break
        case 'rent': expenses.rent += txn.amount; break
        case 'personalExpenses': expenses.personalExpenses += txn.amount; break
        case 'businessExpenses': expenses.businessExpenses += txn.amount; break
        case 'zellePayments': expenses.zellePayments += txn.amount; break
        case 'creditCardPayments': expenses.creditCardPayments += txn.amount; break
        case 'atmWithdrawals': expenses.atmWithdrawals += txn.amount; break
        case 'nsfFees':
          nsf.count++
          nsf.totalFees += txn.amount
          expenses.nsfFees += txn.amount
          break
        case 'unassignedExpenses': expenses.unassignedExpenses += txn.amount; break
        case 'expenseReversals': expenses.expenseReversals += txn.amount; break
        default: expenses.otherExpenses += txn.amount
      }
    }
  }

  // Finalize MCA metrics
  mca.uniqueMCACount = mcaPatterns.size
  mca.mcaNames = Array.from(mcaPatterns)
  mca.dailyPaymentAvg = mca.paymentCount > 0 ? mca.paymentsTotal / seenDates.size : 0

  // Build MCA details per merchant
  mca.mcaDetails = Array.from(mcaPaymentsByName.entries()).map(([name, data]) => ({
    name,
    paymentsTotal: data.payments,
    paymentCount: data.count,
    dailyPaymentAvg: data.count > 0 ? data.payments / seenDates.size : 0,
    fundingReceived: data.funding,
  })).sort((a, b) => b.paymentsTotal - a.paymentsTotal)

  // Finalize NSF metrics
  nsf.negativeBalanceDays = negativeDays.size
  nsf.avgFee = nsf.count > 0 ? nsf.totalFees / nsf.count : 0
  nsf.overdraftEvents = nsf.count
  if (nsf.lowestBalance === Infinity) nsf.lowestBalance = 0

  // Finalize cash flow metrics
  cashFlow.netCashFlow = revenue.total - expenses.total
  cashFlow.daysAnalyzed = seenDates.size
  cashFlow.avgDailyBalance = dailyBalances.length > 0
    ? dailyBalances.reduce((a, b) => a + b, 0) / dailyBalances.length
    : 0
  cashFlow.endingBalance = dailyBalances.length > 0 ? dailyBalances[dailyBalances.length - 1] : 0
  if (cashFlow.minBalance === Infinity) cashFlow.minBalance = 0
  if (cashFlow.maxBalance === -Infinity) cashFlow.maxBalance = 0

  return {
    month: monthKey,
    revenue,
    expenses,
    mca,
    nsf,
    cashFlow,
  }
}

/**
 * Calculate scores based on metrics
 */
/**
 * Calculate scores based on CLAUDE.md guidelines
 */
function calculateScores(metrics: Omit<AggregatedMetrics, 'scores'>): AggregatedMetrics['scores'] {
  // Revenue Score (0-100) - per CLAUDE.md
  // Base: 70 points
  let revenueScore = 70

  // Trend (+/-10): Growing = +10, Declining = -10
  if (metrics.cashFlow.trend === 'IMPROVING') revenueScore += 10
  else if (metrics.cashFlow.trend === 'DECLINING') revenueScore -= 10

  // Diversity (+/-10): Top source < 50% = +10, > 80% = -10
  const topSource = Math.max(
    metrics.revenue.regularRevenue,
    metrics.revenue.creditCardSales,
    metrics.revenue.achDeposits,
    metrics.revenue.mcaFunding
  )
  const topSourcePct = metrics.revenue.total > 0 ? topSource / metrics.revenue.total : 0
  if (topSourcePct < 0.5) revenueScore += 10
  else if (topSourcePct > 0.8) revenueScore -= 10

  // MCA Dependency (+/-5): MCA funding > 30% of revenue = -5
  const mcaFundingPct = metrics.revenue.total > 0 ? metrics.revenue.mcaFunding / metrics.revenue.total : 0
  if (mcaFundingPct > 0.3) revenueScore -= 5

  revenueScore = Math.min(100, Math.max(0, revenueScore))

  // Expense Score (0-100) - per CLAUDE.md
  // Base: 70 points
  let expenseScore = 70

  // Expense Ratio (+/-15): < 70% = +15, > 95% = -15
  const expenseRatio = metrics.totalRevenue > 0 ? metrics.totalExpenses / metrics.totalRevenue : 1
  if (expenseRatio < 0.7) expenseScore += 15
  else if (expenseRatio > 0.95) expenseScore -= 15

  // Uncategorized (+/-10): > 30% uncategorized = -10
  const uncatPct = metrics.expenses.total > 0
    ? (metrics.expenses.otherExpenses + metrics.expenses.unassignedExpenses) / metrics.expenses.total
    : 0
  if (uncatPct > 0.3) expenseScore -= 10

  // MCA Burden (+/-10): MCA > 20% of revenue = -10
  if (metrics.mca.paymentToRevenueRatio > 0.2) expenseScore -= 10

  expenseScore = Math.min(100, Math.max(0, expenseScore))

  // MCA Score (0-100) - per CLAUDE.md
  // Base: 100 points (deduct for risk)
  let mcaScore = 100

  // Active positions: 1 = -10, 2+ = -10 - (n-1)*20
  if (metrics.mca.uniqueMCACount === 1) {
    mcaScore -= 10
  } else if (metrics.mca.uniqueMCACount >= 2) {
    mcaScore -= 10 + (metrics.mca.uniqueMCACount - 1) * 20
  }

  // Stacking detected: -20 (based on stackingIndicator)
  if (metrics.mca.stackingIndicator === 'HIGH') mcaScore -= 20
  else if (metrics.mca.stackingIndicator === 'MEDIUM') mcaScore -= 10

  mcaScore = Math.min(100, Math.max(0, mcaScore))

  // NSF Score (0-100) - per CLAUDE.md
  // 0 NSFs: 100, <=1/month: 80, <=3/month: 60, <=5/month: 40, >5/month: 20
  let nsfScore: number
  const nsfPerMonth = metrics.nsf.frequency

  if (nsfPerMonth === 0) {
    nsfScore = 100
  } else if (nsfPerMonth <= 1) {
    nsfScore = 80
  } else if (nsfPerMonth <= 3) {
    nsfScore = 60
  } else if (nsfPerMonth <= 5) {
    nsfScore = 40
  } else {
    nsfScore = 20
  }

  // Trend adjustment: Improving +10, Worsening -10
  if (metrics.nsf.trend === 'IMPROVING') nsfScore += 10
  else if (metrics.nsf.trend === 'WORSENING') nsfScore -= 10

  nsfScore = Math.min(100, Math.max(0, nsfScore))

  // Cash Flow Score (0-100) - per CLAUDE.md
  // Base: 70 points
  let cashFlowScore = 70

  // Negative days (+/-20): 0 = +20, < 10% = +10, > 30% = -20
  const negDaysPct = metrics.cashFlow.daysAnalyzed > 0
    ? metrics.nsf.negativeBalanceDays / metrics.cashFlow.daysAnalyzed
    : 0
  if (metrics.nsf.negativeBalanceDays === 0) {
    cashFlowScore += 20
  } else if (negDaysPct < 0.1) {
    cashFlowScore += 10
  } else if (negDaysPct > 0.3) {
    cashFlowScore -= 20
  }

  // Lowest balance (+/-15): Always positive = +15, < -$5K = -15
  if (metrics.cashFlow.minBalance >= 0) {
    cashFlowScore += 15
  } else if (metrics.cashFlow.minBalance < -5000) {
    cashFlowScore -= 15
  }

  // Ending balance (+/-10): Above avg = +10, Negative = -10
  if (metrics.cashFlow.endingBalance > metrics.cashFlow.avgDailyBalance) {
    cashFlowScore += 10
  } else if (metrics.cashFlow.endingBalance < 0) {
    cashFlowScore -= 10
  }

  cashFlowScore = Math.min(100, Math.max(0, cashFlowScore))

  // Overall Score (weighted average per CLAUDE.md)
  // revenue: 0.25, expenses: 0.20, mca: 0.25, nsf: 0.15, cashFlow: 0.15
  const overall = Math.round(
    revenueScore * 0.25 +
    expenseScore * 0.20 +
    mcaScore * 0.25 +
    nsfScore * 0.15 +
    cashFlowScore * 0.15
  )

  return {
    revenue: Math.round(revenueScore),
    expenses: Math.round(expenseScore),
    mca: Math.round(mcaScore),
    nsf: Math.round(nsfScore),
    cashFlow: Math.round(cashFlowScore),
    overall,
  }
}

/**
 * Determine MCA stacking indicator
 */
function getStackingIndicator(uniqueMCACount: number): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' {
  if (uniqueMCACount === 0) return 'NONE'
  if (uniqueMCACount === 1) return 'LOW'
  if (uniqueMCACount <= 3) return 'MEDIUM'
  return 'HIGH'
}

/**
 * Calculate trend from monthly data
 */
function calculateTrend(values: number[]): 'IMPROVING' | 'STABLE' | 'DECLINING' {
  if (values.length < 2) return 'STABLE'

  const firstHalf = values.slice(0, Math.floor(values.length / 2))
  const secondHalf = values.slice(Math.floor(values.length / 2))

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  const change = (avgSecond - avgFirst) / (avgFirst || 1)

  if (change > 0.1) return 'IMPROVING'
  if (change < -0.1) return 'DECLINING'
  return 'STABLE'
}

/**
 * Convert trend for NSF (where declining count is actually improving)
 */
function convertTrendForNSF(trend: 'IMPROVING' | 'STABLE' | 'DECLINING'): 'IMPROVING' | 'STABLE' | 'WORSENING' {
  if (trend === 'DECLINING') return 'IMPROVING' // Declining NSF count is good
  if (trend === 'IMPROVING') return 'WORSENING' // Increasing NSF count is bad
  return 'STABLE'
}

/**
 * Main function: Calculate aggregated metrics from transactions
 */
/**
 * Deduplicate transactions by date+description+amount
 * From CLAUDE.md: "Duplicate transactions | Multiple file uploads | Dedupe by date+description+amount"
 */
function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>()
  const unique: Transaction[] = []

  for (const txn of transactions) {
    const date = new Date(txn.date)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const key = `${dateStr}|${txn.description.trim().toLowerCase()}|${txn.amount.toFixed(2)}`

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(txn)
    }
  }

  return unique
}

export function calculateAggregatedMetrics(transactions: Transaction[]): AggregatedMetrics | null {
  if (!transactions || transactions.length === 0) {
    return null
  }

  // Filter out non-transaction rows (Previous Balance, etc.)
  const filteredTxns = transactions.filter(txn => !isExcludedRow(txn.description))

  // Deduplicate transactions by date+description+amount
  const dedupedTxns = deduplicateTransactions(filteredTxns)

  // Sort transactions by date
  const sortedTxns = [...dedupedTxns].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Group transactions by month
  const monthlyGroups = new Map<string, Transaction[]>()

  for (const txn of sortedTxns) {
    const monthKey = getMonthKey(txn.date)
    if (!monthlyGroups.has(monthKey)) {
      monthlyGroups.set(monthKey, [])
    }
    monthlyGroups.get(monthKey)!.push(txn)
  }

  // Calculate metrics for each month
  const monthlyData: MonthlyMetrics[] = []
  const monthKeys = Array.from(monthlyGroups.keys()).sort()

  for (const monthKey of monthKeys) {
    const monthTxns = monthlyGroups.get(monthKey)!
    monthlyData.push(calculateMonthlyMetrics(monthTxns, monthKey))
  }

  // Aggregate all months
  const revenue = initRevenueBreakdown()
  const expenses = initExpenseBreakdown()
  const allMCANames = new Set<string>()

  let totalNSFCount = 0
  let totalNSFFees = 0
  let totalNegativeDays = 0
  let lowestBalance = Infinity
  let minBalance = Infinity
  let maxBalance = -Infinity
  let totalMCAPayments = 0
  let totalMCAPaymentCount = 0
  let totalMCAFunding = 0
  const aggregatedMCADetails = new Map<string, { payments: number, count: number, funding: number }>()
  let totalDaysAnalyzed = 0
  const monthlyNetCashFlows: number[] = []
  const monthlyNSFCounts: number[] = []

  for (const month of monthlyData) {
    // Aggregate revenue
    revenue.regularRevenue += month.revenue.regularRevenue
    revenue.mcaFunding += month.revenue.mcaFunding
    revenue.loanProceeds += month.revenue.loanProceeds
    revenue.wireTransfers += month.revenue.wireTransfers
    revenue.creditCardSales += month.revenue.creditCardSales
    revenue.achDeposits += month.revenue.achDeposits
    revenue.checkDeposits += month.revenue.checkDeposits
    revenue.refundsReceived += month.revenue.refundsReceived
    revenue.otherRevenue += month.revenue.otherRevenue
    // DDV-specific revenue
    revenue.zelleIncome += month.revenue.zelleIncome
    revenue.statePayments += month.revenue.statePayments
    revenue.counselingRevenue += month.revenue.counselingRevenue
    revenue.unassignedIncome += month.revenue.unassignedIncome
    revenue.total += month.revenue.total
    revenue.transactionCount += month.revenue.transactionCount

    // Aggregate expenses
    expenses.recurring += month.expenses.recurring
    expenses.payroll += month.expenses.payroll
    expenses.vendorPayments += month.expenses.vendorPayments
    expenses.ownerDraws += month.expenses.ownerDraws
    expenses.cogs += month.expenses.cogs
    expenses.marketing += month.expenses.marketing
    expenses.professionalServices += month.expenses.professionalServices
    expenses.insurance += month.expenses.insurance
    expenses.taxes += month.expenses.taxes
    expenses.bankFees += month.expenses.bankFees
    expenses.otherExpenses += month.expenses.otherExpenses
    // DDV-specific expenses
    expenses.settlement += month.expenses.settlement
    expenses.loanPayment += month.expenses.loanPayment
    expenses.softwareSubscriptions += month.expenses.softwareSubscriptions
    expenses.travelEntertainment += month.expenses.travelEntertainment
    expenses.utilities += month.expenses.utilities
    expenses.rent += month.expenses.rent
    expenses.personalExpenses += month.expenses.personalExpenses
    expenses.businessExpenses += month.expenses.businessExpenses
    expenses.zellePayments += month.expenses.zellePayments
    expenses.creditCardPayments += month.expenses.creditCardPayments
    expenses.atmWithdrawals += month.expenses.atmWithdrawals
    expenses.nsfFees += month.expenses.nsfFees
    expenses.unassignedExpenses += month.expenses.unassignedExpenses
    expenses.expenseReversals += month.expenses.expenseReversals
    expenses.total += month.expenses.total
    expenses.transactionCount += month.expenses.transactionCount

    // Aggregate MCA
    totalMCAPayments += month.mca.paymentsTotal
    totalMCAPaymentCount += month.mca.paymentCount
    totalMCAFunding += month.mca.fundingReceived
    month.mca.mcaNames.forEach(name => allMCANames.add(name))

    // Aggregate MCA details per merchant
    for (const detail of month.mca.mcaDetails) {
      const existing = aggregatedMCADetails.get(detail.name) || { payments: 0, count: 0, funding: 0 }
      existing.payments += detail.paymentsTotal
      existing.count += detail.paymentCount
      existing.funding += detail.fundingReceived
      aggregatedMCADetails.set(detail.name, existing)
    }

    // Aggregate NSF
    totalNSFCount += month.nsf.count
    totalNSFFees += month.nsf.totalFees
    totalNegativeDays += month.nsf.negativeBalanceDays
    if (month.nsf.lowestBalance < lowestBalance) lowestBalance = month.nsf.lowestBalance

    // Aggregate cash flow
    if (month.cashFlow.minBalance < minBalance) minBalance = month.cashFlow.minBalance
    if (month.cashFlow.maxBalance > maxBalance) maxBalance = month.cashFlow.maxBalance
    totalDaysAnalyzed += month.cashFlow.daysAnalyzed

    // Track for trends
    monthlyNetCashFlows.push(month.cashFlow.netCashFlow)
    monthlyNSFCounts.push(month.nsf.count)
  }

  const monthsAnalyzed = monthlyData.length
  const periodStart = new Date(sortedTxns[0].date)
  const periodEnd = new Date(sortedTxns[sortedTxns.length - 1].date)

  // Calculate averages
  const avgMonthlyRevenue = revenue.total / monthsAnalyzed
  const avgMonthlyExpenses = expenses.total / monthsAnalyzed
  const avgMonthlyNetCashFlow = (revenue.total - expenses.total) / monthsAnalyzed
  const avgDailyRevenue = revenue.total / totalDaysAnalyzed
  const avgDailyExpenses = expenses.total / totalDaysAnalyzed

  // Calculate MCA metrics
  const uniqueMCACount = Math.max(allMCANames.size, totalMCAPaymentCount > 0 ? 1 : 0)
  const monthlyRepayment = totalMCAPayments / monthsAnalyzed
  const paymentToRevenueRatio = revenue.total > 0 ? totalMCAPayments / revenue.total : 0

  // Build partial result for scoring
  const partialResult = {
    periodStart,
    periodEnd,
    monthsAnalyzed,
    totalDaysAnalyzed,
    totalRevenue: revenue.total,
    totalExpenses: expenses.total,
    netCashFlow: revenue.total - expenses.total,
    avgMonthlyRevenue,
    avgMonthlyExpenses,
    avgMonthlyNetCashFlow,
    avgDailyRevenue,
    avgDailyExpenses,
    revenue,
    expenses,
    mca: {
      fundingReceived: totalMCAFunding,
      paymentsTotal: totalMCAPayments,
      paymentCount: totalMCAPaymentCount,
      dailyPaymentAvg: totalMCAPayments / totalDaysAnalyzed,
      uniqueMCACount,
      mcaNames: Array.from(allMCANames),
      mcaDetails: Array.from(aggregatedMCADetails.entries()).map(([name, data]) => ({
        name,
        paymentsTotal: data.payments,
        paymentCount: data.count,
        dailyPaymentAvg: data.count > 0 ? data.payments / totalDaysAnalyzed : 0,
        fundingReceived: data.funding,
      })).sort((a, b) => b.paymentsTotal - a.paymentsTotal),
      monthlyRepayment,
      paymentToRevenueRatio,
      stackingIndicator: getStackingIndicator(uniqueMCACount),
    },
    nsf: {
      count: totalNSFCount,
      totalFees: totalNSFFees,
      avgFee: totalNSFCount > 0 ? totalNSFFees / totalNSFCount : 0,
      negativeBalanceDays: totalNegativeDays,
      lowestBalance: lowestBalance === Infinity ? 0 : lowestBalance,
      overdraftEvents: totalNSFCount,
      frequency: totalNSFCount / monthsAnalyzed,
      trend: convertTrendForNSF(calculateTrend(monthlyNSFCounts)), // Lower NSF is better
    },
    cashFlow: {
      netCashFlow: revenue.total - expenses.total,
      avgDailyBalance: sortedTxns.reduce((sum, t) => sum + t.runningBalance, 0) / sortedTxns.length,
      minBalance: minBalance === Infinity ? 0 : minBalance,
      maxBalance: maxBalance === -Infinity ? 0 : maxBalance,
      endingBalance: sortedTxns[sortedTxns.length - 1].runningBalance,
      daysAnalyzed: totalDaysAnalyzed,
      volatility: maxBalance - minBalance,
      trend: calculateTrend(monthlyNetCashFlows),
    },
    monthlyData,
  }

  // Calculate scores
  const scores = calculateScores(partialResult)

  return {
    ...partialResult,
    scores,
  }
}

/**
 * Format currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * MCA Stacking Alert interface
 */
export interface MCAStackingAlert {
  type: 'STACKING' | 'REFINANCE' | 'HIGH_FREQUENCY'
  message: string
  date: Date
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  lenders: string[]
}

/**
 * Detect MCA stacking from transaction history
 * Stacking occurs when a new MCA is taken while other MCAs are still active
 */
export function detectMCAStacking(transactions: Transaction[]): MCAStackingAlert[] {
  const alerts: MCAStackingAlert[] = []
  const activeMCAs = new Map<string, { startDate: Date; lastPayment: Date; fundingAmount: number }>()

  // Sort chronologically
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const txn of sorted) {
    const desc = txn.description.toLowerCase()
    const txnDate = new Date(txn.date)

    // Check if this is an MCA transaction using patterns
    let mcaLender: string | null = null
    for (const pattern of MCA_LENDER_PATTERNS) {
      if (pattern.test(desc)) {
        const match = desc.match(pattern)
        if (match) {
          mcaLender = match[0]
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
          break
        }
      }
    }

    if (!mcaLender) continue

    if (txn.type === 'CREDIT' && txn.amount > 5000) {
      // This is likely an MCA disbursal (funding)
      // Check if other MCAs are still active (payment within last 45 days)
      const now = txnDate.getTime()
      for (const [lender, status] of activeMCAs) {
        const daysSincePayment = (now - status.lastPayment.getTime()) / (1000 * 60 * 60 * 24)
        if (lender.toLowerCase() !== mcaLender.toLowerCase() && daysSincePayment < 45) {
          alerts.push({
            type: 'STACKING',
            message: `New MCA from ${mcaLender} while ${lender} still active`,
            date: txnDate,
            severity: 'HIGH',
            lenders: [mcaLender, lender],
          })
        }
      }
      activeMCAs.set(mcaLender, {
        startDate: txnDate,
        lastPayment: txnDate,
        fundingAmount: txn.amount,
      })
    } else if (txn.type === 'DEBIT') {
      // This is an MCA repayment
      const existing = activeMCAs.get(mcaLender)
      if (existing) {
        existing.lastPayment = txnDate
      } else {
        // Payment to MCA not seen before (might be from before statement period)
        activeMCAs.set(mcaLender, {
          startDate: txnDate,
          lastPayment: txnDate,
          fundingAmount: 0,
        })
      }
    }
  }

  // Check for high frequency MCA activity (more than 3 active MCAs)
  if (activeMCAs.size > 3) {
    const lenderNames = Array.from(activeMCAs.keys())
    alerts.push({
      type: 'HIGH_FREQUENCY',
      message: `High MCA activity detected: ${activeMCAs.size} active positions`,
      date: new Date(),
      severity: 'HIGH',
      lenders: lenderNames,
    })
  }

  return alerts
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate metrics before rendering dashboard
 * Ensures data integrity per CLAUDE.md guidelines
 */
export function validateBeforeRender(metrics: AggregatedMetrics): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Revenue categories must sum to total revenue
  const revenueSum =
    metrics.revenue.regularRevenue +
    metrics.revenue.mcaFunding +
    metrics.revenue.loanProceeds +
    metrics.revenue.wireTransfers +
    metrics.revenue.creditCardSales +
    metrics.revenue.achDeposits +
    metrics.revenue.checkDeposits +
    metrics.revenue.refundsReceived +
    metrics.revenue.zelleIncome +
    metrics.revenue.statePayments +
    metrics.revenue.counselingRevenue +
    metrics.revenue.unassignedIncome +
    metrics.revenue.otherRevenue

  if (Math.abs(revenueSum - metrics.revenue.total) > 1) {
    errors.push(
      `Revenue breakdown (${formatCurrency(revenueSum)}) doesn't sum to total (${formatCurrency(metrics.revenue.total)})`
    )
  }

  // 2. Expense categories must sum to total expenses (INCLUDING MCA)
  const expenseSum =
    metrics.expenses.recurring +
    metrics.expenses.payroll +
    metrics.expenses.vendorPayments +
    metrics.expenses.ownerDraws +
    metrics.expenses.cogs +
    metrics.expenses.marketing +
    metrics.expenses.professionalServices +
    metrics.expenses.insurance +
    metrics.expenses.taxes +
    metrics.expenses.bankFees +
    metrics.expenses.settlement +
    metrics.expenses.loanPayment +
    metrics.expenses.softwareSubscriptions +
    metrics.expenses.travelEntertainment +
    metrics.expenses.utilities +
    metrics.expenses.rent +
    metrics.expenses.personalExpenses +
    metrics.expenses.businessExpenses +
    metrics.expenses.zellePayments +
    metrics.expenses.creditCardPayments +
    metrics.expenses.atmWithdrawals +
    metrics.expenses.nsfFees +
    metrics.expenses.unassignedExpenses +
    metrics.expenses.expenseReversals +
    metrics.expenses.otherExpenses +
    metrics.mca.paymentsTotal // Include MCA payments in expense sum

  if (Math.abs(expenseSum - metrics.expenses.total) > 1) {
    warnings.push(
      `Expense breakdown (${formatCurrency(expenseSum)}) differs from total (${formatCurrency(metrics.expenses.total)})`
    )
  }

  // 3. Scores must be within bounds (0-100)
  const scores = metrics.scores
  for (const [name, score] of Object.entries(scores)) {
    if (score < 0 || score > 100) {
      errors.push(`${name} score out of bounds: ${score}`)
    }
  }

  // 4. Warn on high uncategorized expenses
  const uncatPct =
    (metrics.expenses.otherExpenses + metrics.expenses.unassignedExpenses) /
    metrics.expenses.total
  if (uncatPct > 0.25) {
    warnings.push(`${(uncatPct * 100).toFixed(0)}% of expenses are uncategorized`)
  }

  // 5. Warn on high unassigned income
  const unassignedIncomePct = metrics.revenue.unassignedIncome / metrics.revenue.total
  if (unassignedIncomePct > 0.2) {
    warnings.push(`${(unassignedIncomePct * 100).toFixed(0)}% of income is unassigned`)
  }

  // 6. Check for reasonable data ranges
  if (metrics.totalRevenue < 0) {
    errors.push('Total revenue is negative')
  }
  if (metrics.totalExpenses < 0) {
    errors.push('Total expenses is negative')
  }

  // 7. Check NSF consistency
  if (metrics.nsf.count > 0 && metrics.nsf.totalFees === 0) {
    warnings.push('NSF count > 0 but no fees recorded')
  }

  // 8. Check MCA consistency
  if (metrics.mca.paymentCount > 0 && metrics.mca.paymentsTotal === 0) {
    errors.push('MCA payment count > 0 but total payments is 0')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if a transaction description matches any MCA lender pattern
 */
export function isMCATransaction(description: string): boolean {
  const desc = description.toLowerCase()
  return MCA_LENDER_PATTERNS.some(pattern => pattern.test(desc))
}

/**
 * Extract MCA lender name from transaction description
 */
export function extractMCALenderFromDescription(description: string): string | null {
  const desc = description.toLowerCase()
  for (const pattern of MCA_LENDER_PATTERNS) {
    if (pattern.test(desc)) {
      const match = desc.match(pattern)
      if (match) {
        return match[0]
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ')
      }
    }
  }
  return null
}
