import { describe, it, expect } from 'vitest'
import {
  mapDDVCategory,
  extractMCAMerchantName,
  isDDVFormat,
  isValidNormalizedCategory,
  getTransactionTypeFromDDV,
} from './ddvCategoryMapper'

describe('ddvCategoryMapper', () => {
  describe('mapDDVCategory', () => {
    describe('direct mapping - income categories', () => {
      it('should map Income - Card Settlement to card_processing', () => {
        const result = mapDDVCategory('Income - Card Settlement', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('card_processing')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Income - ACH Deposit to ach_deposit', () => {
        const result = mapDDVCategory('Income - ACH Deposit', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('ach_deposit')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Income - ACH Credit to ach_deposit', () => {
        const result = mapDDVCategory('Income - ACH Credit', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('ach_deposit')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Income - Check Deposit to check_deposit', () => {
        const result = mapDDVCategory('Income - Check Deposit', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('check_deposit')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Income - Cash Deposit to cash_deposit', () => {
        const result = mapDDVCategory('Income - Cash Deposit', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('cash_deposit')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Income - Refund to refund', () => {
        const result = mapDDVCategory('Income - Refund', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('refund')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Income - MCA Disbursal to mca_funding', () => {
        const result = mapDDVCategory('Income - MCA Disbursal', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('mca_funding')
        expect(result.parseQuality).toBe('high')
      })
    })

    describe('direct mapping - expense categories', () => {
      it('should map Expense - Payroll to payroll', () => {
        const result = mapDDVCategory('Expense - Payroll', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('payroll')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Salary to payroll', () => {
        const result = mapDDVCategory('Expense - Salary', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('payroll')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Owner Draw to owner_draw', () => {
        const result = mapDDVCategory('Expense - Owner Draw', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('owner_draw')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Owner Distribution to owner_draw', () => {
        const result = mapDDVCategory('Expense - Owner Distribution', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('owner_draw')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Marketing to marketing', () => {
        const result = mapDDVCategory('Expense - Marketing', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('marketing')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Advertising to marketing', () => {
        const result = mapDDVCategory('Expense - Advertising', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('marketing')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Taxes to taxes', () => {
        const result = mapDDVCategory('Expense - Taxes', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('taxes')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Tax Payment to taxes', () => {
        const result = mapDDVCategory('Expense - Tax Payment', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('taxes')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Vendor Payment to vendor_payment', () => {
        const result = mapDDVCategory('Expense - Vendor Payment', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('vendor_payment')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Inventory to inventory', () => {
        const result = mapDDVCategory('Expense - Inventory', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('inventory')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Shipping to shipping', () => {
        const result = mapDDVCategory('Expense - Shipping', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('shipping')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - Loan Payment to loan_payment', () => {
        const result = mapDDVCategory('Expense - Loan Payment', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('loan_payment')
        expect(result.parseQuality).toBe('high')
      })

      it('should map Expense - MCA Repayment to mca_payment', () => {
        const result = mapDDVCategory('Expense - MCA Repayment', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('mca_payment')
        expect(result.parseQuality).toBe('high')
      })
    })

    describe('fuzzy matching - income', () => {
      it('should fuzzy match card settlement', () => {
        const result = mapDDVCategory('Income - Card Processing Revenue', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('card_processing')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match ach deposit', () => {
        const result = mapDDVCategory('Income - ACH Incoming Credit', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('ach_deposit')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match check deposit', () => {
        const result = mapDDVCategory('Income - Mobile Check Deposit', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('check_deposit')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match cash deposit', () => {
        const result = mapDDVCategory('Income - Branch Cash Deposit', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('cash_deposit')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match refund', () => {
        const result = mapDDVCategory('Income - Purchase Refund', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('refund')
        expect(result.parseQuality).toBe('medium')
      })
    })

    describe('fuzzy matching - expense', () => {
      it('should fuzzy match payroll', () => {
        const result = mapDDVCategory('Expense - Weekly Payroll Run', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('payroll')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match salary', () => {
        const result = mapDDVCategory('Expense - Employee Salary', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('payroll')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match inventory/supplies', () => {
        const result = mapDDVCategory('Expense - Office Supplies', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('inventory')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match shipping/freight', () => {
        const result = mapDDVCategory('Expense - Freight Charges', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('shipping')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match loan payment', () => {
        const result = mapDDVCategory('Expense - SBA Loan Payment', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('loan_payment')
        expect(result.parseQuality).toBe('medium')
      })

      it('should fuzzy match vendor payment', () => {
        const result = mapDDVCategory('Expense - Vendor Payment ABC Corp', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('vendor_payment')
        expect(result.parseQuality).toBe('medium')
      })
    })

    describe('unassigned handling', () => {
      it('should handle 99.UNASSIGNED for credits', () => {
        const result = mapDDVCategory('99.UNASSIGNED', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('unassigned_income')
        expect(result.parseQuality).toBe('unassigned')
      })

      it('should handle 99.UNASSIGNED for debits', () => {
        const result = mapDDVCategory('99.UNASSIGNED', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('unassigned_expense')
        expect(result.parseQuality).toBe('unassigned')
      })

      it('should handle case-insensitive 99.unassigned', () => {
        const result = mapDDVCategory('99.unassigned', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('unassigned_income')
      })
    })

    describe('expense reversal detection', () => {
      it('should detect expense reversal from tag_category', () => {
        const result = mapDDVCategory('Expense Reversal - Debit Purchases', null, 'DEBIT')
        expect(result.isExpenseReversal).toBe(true)
      })

      it('should detect expense reversal from tag', () => {
        const result = mapDDVCategory('Expense - Misc', 'Reversal - Returned Item', 'DEBIT')
        expect(result.isExpenseReversal).toBe(true)
      })
    })

    describe('fallback behavior', () => {
      it('should fallback to other_income for unmatched credits', () => {
        const result = mapDDVCategory('Unknown Category Format', null, 'CREDIT')
        expect(result.normalizedCategory).toBe('other_income')
        expect(result.parseQuality).toBe('low')
      })

      it('should fallback to other_expense for unmatched debits', () => {
        const result = mapDDVCategory('Unknown Category Format', null, 'DEBIT')
        expect(result.normalizedCategory).toBe('other_expense')
        expect(result.parseQuality).toBe('low')
      })
    })
  })

  describe('extractMCAMerchantName', () => {
    describe('pattern matching', () => {
      it('should extract lender name from "Expense - MCA - [NAME]" format', () => {
        const result = extractMCAMerchantName('Expense - MCA - EBF')
        expect(result).toBe('EBF')
      })

      it('should extract lender name from "Income - MCA Disbursal - [NAME]" format', () => {
        const result = extractMCAMerchantName('Income - MCA Disbursal - LendingPoint')
        expect(result).toBe('LENDINGPOINT')
      })

      it('should handle multi-word lender names', () => {
        const result = extractMCAMerchantName('Expense - MCA - Rapid Finance')
        expect(result).toBe('RAPID FINANCE')
      })
    })

    describe('known MCA company matching', () => {
      it('should detect FORA FINANCIAL', () => {
        const result = extractMCAMerchantName('ACH Debit FORA FINANCIAL')
        expect(result).toBe('FORA FINANCIAL')
      })

      it('should detect YELLOWSTONE CAPITAL', () => {
        const result = extractMCAMerchantName('ACH Debit YELLOWSTONE CAPITAL')
        expect(result).toBe('YELLOWSTONE CAPITAL')
      })

      it('should detect NATIONAL FUNDING', () => {
        const result = extractMCAMerchantName('NATIONAL FUNDING WITHDRAWAL')
        expect(result).toBe('NATIONAL FUNDING')
      })

      it('should detect PIPE', () => {
        const result = extractMCAMerchantName('ACH PIPE PAYMENT')
        expect(result).toBe('PIPE')
      })

      it('should detect FORWARD FINANCING', () => {
        const result = extractMCAMerchantName('FORWARD FINANCING ACH DEBIT')
        expect(result).toBe('FORWARD FINANCING')
      })

      it('should detect PEARL CAPITAL', () => {
        const result = extractMCAMerchantName('PEARL CAPITAL LLC')
        expect(result).toBe('PEARL CAPITAL')
      })

      it('should detect LIBERTAS', () => {
        const result = extractMCAMerchantName('LIBERTAS FUNDING')
        expect(result).toBe('LIBERTAS')
      })

      it('should detect BIZFI', () => {
        const result = extractMCAMerchantName('BIZFI PAYMENT')
        expect(result).toBe('BIZFI')
      })

      it('should detect FUNDKITE', () => {
        const result = extractMCAMerchantName('FUNDKITE ACH')
        expect(result).toBe('FUNDKITE')
      })

      it('should detect KALAMATA', () => {
        const result = extractMCAMerchantName('KALAMATA CAPITAL')
        expect(result).toBe('KALAMATA')
      })

      it('should detect CLOUDFUND', () => {
        const result = extractMCAMerchantName('CLOUDFUND WITHDRAWAL')
        expect(result).toBe('CLOUDFUND')
      })

      it('should detect ITRIA VENTURES', () => {
        const result = extractMCAMerchantName('ITRIA VENTURES PAYMENT')
        expect(result).toBe('ITRIA VENTURES')
      })

      it('should detect existing lenders like EBF', () => {
        const result = extractMCAMerchantName('ACH Debit EBF Holdings')
        expect(result).toBe('EBF')
      })

      it('should detect CREDIBLY', () => {
        const result = extractMCAMerchantName('CREDIBLY ACH DEBIT')
        expect(result).toBe('CREDIBLY')
      })
    })

    describe('edge cases', () => {
      it('should return null for null input', () => {
        const result = extractMCAMerchantName(null)
        expect(result).toBeNull()
      })

      it('should return null for undefined input', () => {
        const result = extractMCAMerchantName(undefined)
        expect(result).toBeNull()
      })

      it('should return null for non-MCA transactions', () => {
        const result = extractMCAMerchantName('ACH Debit UTILITY COMPANY')
        expect(result).toBeNull()
      })
    })
  })

  describe('isDDVFormat', () => {
    it('should return true for "Income - " prefix', () => {
      expect(isDDVFormat('Income - Card Settlement')).toBe(true)
    })

    it('should return true for "Expense - " prefix', () => {
      expect(isDDVFormat('Expense - Payroll')).toBe(true)
    })

    it('should return true for "Expense Reversal - " prefix', () => {
      expect(isDDVFormat('Expense Reversal - Debit Purchases')).toBe(true)
    })

    it('should return true for 99.UNASSIGNED', () => {
      expect(isDDVFormat('99.UNASSIGNED')).toBe(true)
    })

    it('should handle case insensitivity', () => {
      expect(isDDVFormat('INCOME - Test')).toBe(true)
      expect(isDDVFormat('expense - test')).toBe(true)
    })

    it('should handle variations without spaces', () => {
      expect(isDDVFormat('Income-Test')).toBe(true)
      expect(isDDVFormat('Expense-Test')).toBe(true)
    })

    it('should return false for non-DDV formats', () => {
      expect(isDDVFormat('Payroll')).toBe(false)
      expect(isDDVFormat('Other Category')).toBe(false)
      expect(isDDVFormat('')).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(isDDVFormat(null)).toBe(false)
      expect(isDDVFormat(undefined)).toBe(false)
    })
  })

  describe('isValidNormalizedCategory', () => {
    describe('new income categories', () => {
      it('should validate card_processing', () => {
        expect(isValidNormalizedCategory('card_processing')).toBe(true)
      })

      it('should validate ach_deposit', () => {
        expect(isValidNormalizedCategory('ach_deposit')).toBe(true)
      })

      it('should validate check_deposit', () => {
        expect(isValidNormalizedCategory('check_deposit')).toBe(true)
      })

      it('should validate cash_deposit', () => {
        expect(isValidNormalizedCategory('cash_deposit')).toBe(true)
      })

      it('should validate refund', () => {
        expect(isValidNormalizedCategory('refund')).toBe(true)
      })
    })

    describe('new expense categories', () => {
      it('should validate payroll', () => {
        expect(isValidNormalizedCategory('payroll')).toBe(true)
      })

      it('should validate owner_draw', () => {
        expect(isValidNormalizedCategory('owner_draw')).toBe(true)
      })

      it('should validate marketing', () => {
        expect(isValidNormalizedCategory('marketing')).toBe(true)
      })

      it('should validate taxes', () => {
        expect(isValidNormalizedCategory('taxes')).toBe(true)
      })

      it('should validate vendor_payment', () => {
        expect(isValidNormalizedCategory('vendor_payment')).toBe(true)
      })

      it('should validate inventory', () => {
        expect(isValidNormalizedCategory('inventory')).toBe(true)
      })

      it('should validate shipping', () => {
        expect(isValidNormalizedCategory('shipping')).toBe(true)
      })

      it('should validate loan_payment', () => {
        expect(isValidNormalizedCategory('loan_payment')).toBe(true)
      })
    })

    describe('existing categories', () => {
      it('should validate mca_funding', () => {
        expect(isValidNormalizedCategory('mca_funding')).toBe(true)
      })

      it('should validate mca_payment', () => {
        expect(isValidNormalizedCategory('mca_payment')).toBe(true)
      })

      it('should validate other_income', () => {
        expect(isValidNormalizedCategory('other_income')).toBe(true)
      })

      it('should validate other_expense', () => {
        expect(isValidNormalizedCategory('other_expense')).toBe(true)
      })
    })

    describe('invalid categories', () => {
      it('should return false for unknown categories', () => {
        expect(isValidNormalizedCategory('unknown_category')).toBe(false)
      })

      it('should return false for null', () => {
        expect(isValidNormalizedCategory(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isValidNormalizedCategory(undefined)).toBe(false)
      })

      it('should return false for empty string', () => {
        expect(isValidNormalizedCategory('')).toBe(false)
      })
    })
  })

  describe('getTransactionTypeFromDDV', () => {
    it('should return CREDIT for Income categories', () => {
      expect(getTransactionTypeFromDDV('Income - Card Settlement')).toBe('CREDIT')
    })

    it('should return DEBIT for Expense categories', () => {
      expect(getTransactionTypeFromDDV('Expense - Payroll')).toBe('DEBIT')
    })

    it('should return DEBIT for Expense Reversal categories', () => {
      expect(getTransactionTypeFromDDV('Expense Reversal - Debit Purchases')).toBe('DEBIT')
    })

    it('should return null for unknown formats', () => {
      expect(getTransactionTypeFromDDV('Unknown')).toBeNull()
    })

    it('should return null for null input', () => {
      expect(getTransactionTypeFromDDV(null)).toBeNull()
    })
  })
})
