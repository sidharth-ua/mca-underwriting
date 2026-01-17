/**
 * DDV Category Mapper
 * Maps DDV tagged CSV categories to normalized internal categories
 */

export type ParseQuality = 'high' | 'medium' | 'low' | 'unassigned'

export interface DDVMappingResult {
  normalizedCategory: string
  mcaMerchantName: string | null
  parseQuality: ParseQuality
  isExpenseReversal: boolean
}

/**
 * Complete mapping of DDV Tag_Category values to normalized categories
 */
const DDV_TAG_CATEGORY_MAP: Record<string, string> = {
  // Income categories
  'Income - State of NE': 'state_payment',
  'Income - Zelle Receival': 'zelle_income',
  'Income - LFG Counselling': 'counseling_revenue',
  'Income - MCA Disbursal': 'mca_funding',
  'Income - Wired Inflow': 'wire_transfer',
  'Income - Card Settlement': 'card_processing',
  'Income - ACH Deposit': 'ach_deposit',
  'Income - ACH Credit': 'ach_deposit',
  'Income - Check Deposit': 'check_deposit',
  'Income - Cash Deposit': 'cash_deposit',
  'Income - Refund': 'refund',

  // Expense categories
  'Expense - MCA Repayment': 'mca_payment',
  'Expense - Software and Subscriptions': 'software_subscriptions',
  'Expense - Utilities': 'utilities',
  'Expense - Travel and Entertainment': 'travel_entertainment',
  'Expense - Rent': 'rent',
  'Expense - Personal - Debit Purchases': 'personal_expense',
  'Expense - Business - Debit Purchases': 'business_expense',
  'Expense - Bank Fees': 'bank_fee',
  'Expense - Zelle Pmt': 'zelle_payment',
  'Expense - DDV Settlement': 'settlement',
  'Expense - Professional Fees': 'professional_services',
  'Expense - Insurance': 'insurance',
  'Expense - Misc': 'other_expense',
  'Expense - Electronic Withdrawal': 'electronic_withdrawal',
  'Expense - ATM Withdrawal': 'atm_withdrawal',
  'Expense - ATM Fees': 'bank_fee',
  'Expense - Pmts to Credit Card': 'credit_card_payment',
  'Expense - analysis service charge': 'bank_fee',
  'Expense - Overdraft Fees': 'nsf_fee',
  'Expense - Processing Fees': 'bank_fee',
  'Expense - Legal (Attorney)': 'professional_services',
  'Expense - Restaurants': 'other_expense',
  'Expense Reversal - Debit Purchases': 'expense_reversal',
  'Expense - Payroll': 'payroll',
  'Expense - Salary': 'payroll',
  'Expense - Owner Draw': 'owner_draw',
  'Expense - Owner Distribution': 'owner_draw',
  'Expense - Marketing': 'marketing',
  'Expense - Advertising': 'marketing',
  'Expense - Taxes': 'taxes',
  'Expense - Tax Payment': 'taxes',
  'Expense - Vendor Payment': 'vendor_payment',
  'Expense - Inventory': 'inventory',
  'Expense - Shipping': 'shipping',
  'Expense - Loan Payment': 'loan_payment',

  // Special cases
  '99.UNASSIGNED': 'unassigned',
}

/**
 * Known MCA company names for fuzzy matching
 */
const KNOWN_MCA_COMPANIES = [
  'EBF',
  'LENDINGPOINT',
  'EVEREST',
  'CAPYTAL',
  'CREDIBLY',
  'RAPID FINANCE',
  'CAN CAPITAL',
  'FUNDBOX',
  'KABBAGE',
  'BLUEVINE',
  'ONDECK',
  'PAYABILITY',
  'BEHALF',
  'CLEARCO',
  'SQUARE CAPITAL',
  'PAYPAL WORKING',
  'FORA FINANCIAL',
  'YELLOWSTONE CAPITAL',
  'NATIONAL FUNDING',
  'PIPE',
  'FORWARD FINANCING',
  'PEARL CAPITAL',
  'LIBERTAS',
  'BIZFI',
  'FUNDKITE',
  'KALAMATA',
  'CLOUDFUND',
  'ITRIA VENTURES',
]

/**
 * Extract MCA merchant name from DDV Tag column
 * Handles formats like:
 * - "Expense - MCA - EBF"
 * - "Expense - MCA - LendingPoint"
 * - "Income - MCA Disbursal - EBF"
 * - "Income - MCA Disbursal - LendingPoint"
 */
export function extractMCAMerchantName(tag: string | null | undefined): string | null {
  if (!tag) return null

  // Pattern 1: "Expense - MCA - [NAME]" or "Income - MCA Disbursal - [NAME]"
  const mcaPattern = /(?:MCA|MCA Disbursal)\s*-\s*([A-Za-z0-9\s]+)$/i
  const match = tag.match(mcaPattern)
  if (match) {
    return match[1].trim().toUpperCase()
  }

  // Pattern 2: Look for known MCA company names in the tag
  const tagUpper = tag.toUpperCase()
  for (const company of KNOWN_MCA_COMPANIES) {
    if (tagUpper.includes(company)) {
      return company
    }
  }

  return null
}

/**
 * Fuzzy match category for unknown DDV tags
 */
function fuzzyMatchCategory(
  type: string,
  category: string,
  transactionType: 'CREDIT' | 'DEBIT'
): string {
  const cat = category.toLowerCase()

  if (type === 'income' || transactionType === 'CREDIT') {
    if (cat.includes('mca') || cat.includes('disbursal')) {
      return 'mca_funding'
    }
    if (cat.includes('zelle')) {
      return 'zelle_income'
    }
    if (cat.includes('wire')) {
      return 'wire_transfer'
    }
    if (cat.includes('state')) {
      return 'state_payment'
    }
    if (cat.includes('counsell') || cat.includes('lfg')) {
      return 'counseling_revenue'
    }
    if (cat.includes('card') && (cat.includes('settlement') || cat.includes('processing'))) {
      return 'card_processing'
    }
    if (cat.includes('ach') && (cat.includes('deposit') || cat.includes('credit'))) {
      return 'ach_deposit'
    }
    if (cat.includes('check') && cat.includes('deposit')) {
      return 'check_deposit'
    }
    if (cat.includes('cash') && cat.includes('deposit')) {
      return 'cash_deposit'
    }
    if (cat.includes('refund')) {
      return 'refund'
    }
    if (cat.includes('deposit')) {
      return 'ach_deposit'
    }
    return 'other_income'
  }

  // Expense fuzzy matching
  if (cat.includes('mca') || cat.includes('repayment')) {
    return 'mca_payment'
  }
  if (cat.includes('settlement')) {
    return 'settlement'
  }
  if (cat.includes('rent') || cat.includes('lease')) {
    return 'rent'
  }
  if (cat.includes('software') || cat.includes('subscription')) {
    return 'software_subscriptions'
  }
  if (cat.includes('travel') || cat.includes('entertainment')) {
    return 'travel_entertainment'
  }
  if (cat.includes('utilit') || cat.includes('telecom') || cat.includes('electric') || cat.includes('gas') || cat.includes('water')) {
    return 'utilities'
  }
  if (cat.includes('insurance')) {
    return 'insurance'
  }
  if (cat.includes('professional') || cat.includes('legal') || cat.includes('attorney') || cat.includes('accounting')) {
    return 'professional_services'
  }
  if (cat.includes('personal') || cat.includes('debit purchase')) {
    return 'personal_expense'
  }
  if (cat.includes('business')) {
    return 'business_expense'
  }
  if (cat.includes('zelle')) {
    return 'zelle_payment'
  }
  if (cat.includes('bank fee') || cat.includes('overdraft') || cat.includes('nsf') || cat.includes('insufficient')) {
    return 'nsf_fee'
  }
  if (cat.includes('credit card') || cat.includes('pmts to')) {
    return 'credit_card_payment'
  }
  if (cat.includes('atm')) {
    return 'atm_withdrawal'
  }
  if (cat.includes('payroll') || cat.includes('salary') || cat.includes('wages')) {
    return 'payroll'
  }
  if (cat.includes('owner') || cat.includes('draw')) {
    return 'owner_draw'
  }
  if (cat.includes('marketing') || cat.includes('advertising')) {
    return 'marketing'
  }
  if (cat.includes('tax')) {
    return 'taxes'
  }
  if (cat.includes('vendor') && cat.includes('payment')) {
    return 'vendor_payment'
  }
  if (cat.includes('inventory') || cat.includes('cogs') || cat.includes('supplies')) {
    return 'inventory'
  }
  if (cat.includes('shipping') || cat.includes('freight') || cat.includes('postage')) {
    return 'shipping'
  }
  if (cat.includes('loan') && cat.includes('payment')) {
    return 'loan_payment'
  }

  return 'other_expense'
}

/**
 * Map DDV tag and tag_category to normalized internal category
 * Uses case-insensitive matching for robustness
 */
export function mapDDVCategory(
  tagCategory: string | null | undefined,
  tag: string | null | undefined,
  transactionType: 'CREDIT' | 'DEBIT'
): DDVMappingResult {
  const trimmedTagCategory = tagCategory?.trim() || ''
  const trimmedTag = tag?.trim() || ''

  // Handle 99.UNASSIGNED explicitly (case-insensitive)
  if (trimmedTagCategory.toLowerCase() === '99.unassigned' || trimmedTag.toLowerCase() === '99.unassigned') {
    return {
      normalizedCategory: transactionType === 'CREDIT' ? 'unassigned_income' : 'unassigned_expense',
      mcaMerchantName: null,
      parseQuality: 'unassigned',
      isExpenseReversal: false,
    }
  }

  // Check for expense reversal (case-insensitive)
  const isExpenseReversal = trimmedTagCategory.toLowerCase().includes('reversal') || trimmedTag.toLowerCase().includes('reversal')

  // Extract MCA merchant name from the detailed Tag field
  const mcaMerchantName = extractMCAMerchantName(trimmedTag)

  // Direct lookup in mapping table (try exact match first)
  if (DDV_TAG_CATEGORY_MAP[trimmedTagCategory]) {
    return {
      normalizedCategory: DDV_TAG_CATEGORY_MAP[trimmedTagCategory],
      mcaMerchantName,
      parseQuality: 'high',
      isExpenseReversal,
    }
  }

  // Try case-insensitive lookup in mapping table
  const tagCategoryLower = trimmedTagCategory.toLowerCase()
  for (const [key, value] of Object.entries(DDV_TAG_CATEGORY_MAP)) {
    if (key.toLowerCase() === tagCategoryLower) {
      return {
        normalizedCategory: value,
        mcaMerchantName,
        parseQuality: 'high',
        isExpenseReversal,
      }
    }
  }

  // Fallback: Parse the tag_category pattern "Income - X" or "Expense - X"
  // Also handle variations like "Income-X" without spaces
  const ddvPattern = /^(Income|Expense)\s*-\s*(.+)$/i
  const match = trimmedTagCategory.match(ddvPattern)

  if (match) {
    const type = match[1].toLowerCase()
    const category = match[2].trim()

    // Use fuzzy matching for common patterns
    const normalizedCategory = fuzzyMatchCategory(type, category, transactionType)

    return {
      normalizedCategory,
      mcaMerchantName,
      parseQuality: 'medium',
      isExpenseReversal,
    }
  }

  // Final fallback based on transaction type
  return {
    normalizedCategory: transactionType === 'CREDIT' ? 'other_income' : 'other_expense',
    mcaMerchantName,
    parseQuality: 'low',
    isExpenseReversal,
  }
}

/**
 * Check if a category is DDV format
 * Case-insensitive and handles variations like "Income-", "income - ", etc.
 */
export function isDDVFormat(tagCategory: string | null | undefined): boolean {
  if (!tagCategory) return false
  const trimmed = tagCategory.trim().toLowerCase()
  return (
    trimmed.startsWith('income -') ||
    trimmed.startsWith('income-') ||
    trimmed.startsWith('expense -') ||
    trimmed.startsWith('expense-') ||
    trimmed.startsWith('expense reversal -') ||
    trimmed.startsWith('expense reversal-') ||
    trimmed === '99.unassigned'
  )
}

/**
 * Check if a normalized category is valid (exists in CATEGORY_MAPPINGS)
 * This helps validate that our mapping produced a known category
 */
export function isValidNormalizedCategory(category: string | null | undefined): boolean {
  if (!category) return false
  // Check against known categories from the DDV_TAG_CATEGORY_MAP values
  const validCategories = new Set([
    // Income categories
    'state_payment', 'zelle_income', 'counseling_revenue', 'mca_funding', 'wire_transfer',
    'card_processing', 'ach_deposit', 'check_deposit', 'cash_deposit', 'refund',
    // Expense categories
    'mca_payment', 'software_subscriptions', 'utilities', 'travel_entertainment', 'rent',
    'personal_expense', 'business_expense', 'bank_fee', 'zelle_payment', 'settlement',
    'professional_services', 'insurance', 'other_expense', 'electronic_withdrawal',
    'atm_withdrawal', 'nsf_fee', 'credit_card_payment', 'expense_reversal',
    'payroll', 'owner_draw', 'marketing', 'taxes', 'vendor_payment', 'inventory',
    'shipping', 'loan_payment',
    // Unassigned
    'unassigned', 'unassigned_income', 'unassigned_expense',
    // Fallback categories
    'other_income', 'other_expense',
  ])
  return validCategories.has(category)
}

/**
 * Get the transaction type from DDV category (if determinable)
 */
export function getTransactionTypeFromDDV(tagCategory: string | null | undefined): 'CREDIT' | 'DEBIT' | null {
  if (!tagCategory) return null
  const trimmed = tagCategory.trim()

  if (trimmed.startsWith('Income - ')) return 'CREDIT'
  if (trimmed.startsWith('Expense - ') || trimmed.startsWith('Expense Reversal - ')) return 'DEBIT'

  return null
}
