export type TransactionType = 'CREDIT' | 'DEBIT'

// Parse quality indicates confidence level of category assignment
export type ParseQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSIGNED'

// Inflow categories
export type InflowCategory =
  | 'card_processing'
  | 'ach_deposit'
  | 'wire_transfer'
  | 'cash_deposit'
  | 'check_deposit'
  | 'mca_funding'
  | 'loan_received'
  | 'tax_refund'
  | 'other_income'

// Outflow categories
export type OutflowCategory =
  | 'mca_payment'
  | 'loan_payment'
  | 'rent'
  | 'utilities'
  | 'payroll'
  | 'insurance'
  | 'inventory'
  | 'marketing'
  | 'professional_services'
  | 'owner_draw'
  | 'atm_withdrawal'
  | 'personal_transfer'
  | 'nsf_fee'
  | 'overdraft_fee'
  | 'bank_fee'
  | 'tax_payment'
  | 'other_expense'

export type TransactionCategory = InflowCategory | OutflowCategory

export interface Transaction {
  id: string
  bankAccountId: string
  date: string
  description: string
  amount: number
  type: TransactionType
  runningBalance?: number | null
  category?: TransactionCategory | null
  subcategory?: string | null
  parseQuality?: ParseQuality | null  // Confidence level of categorization
  rawCategory?: string | null         // Original tag_category from CSV (audit trail)
  rawSubcategory?: string | null      // Original tag from CSV (audit trail)
  createdAt: string
  updatedAt: string
}

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  type?: TransactionType
  category?: TransactionCategory
  minAmount?: number
  maxAmount?: number
}

export interface TransactionSummary {
  totalCredits: number
  totalDebits: number
  netAmount: number
  transactionCount: number
  averageCredit: number
  averageDebit: number
}
