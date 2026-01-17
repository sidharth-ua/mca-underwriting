/**
 * DDV API Types and Interfaces
 * Types for DDV (Document Data Validation) integration
 */

// DDV API response types
export interface DDVTransactionRow {
  posted: string
  transaction_description: string
  amount?: string
  debit?: string
  credit?: string
  balance: string
  tag: string
  tag_category: string
}

export interface DDVTaggedCSV {
  headers: string[]
  rows: DDVTransactionRow[]
  metadata: {
    bankName?: string
    accountNumber?: string
    statementPeriod?: {
      start: string
      end: string
    }
  }
}

export interface DDVDocumentStatus {
  documentId: string
  status: 'PENDING' | 'PROCESSING' | 'TAGGED' | 'READY' | 'ERROR'
  progress?: number
  error?: string
}

// Re-export types from ddvCategoryMapper for convenience
// Note: ParseQuality and DDVMappingResult are defined in ddvCategoryMapper.ts
// to avoid circular dependencies. Import them directly from there when needed.
