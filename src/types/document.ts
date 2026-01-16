export type DocumentStatus =
  | 'UPLOADED'
  | 'PARSING'
  | 'PARSED'
  | 'TAGGING'
  | 'TAGGED'
  | 'READY'
  | 'ERROR'

export interface Document {
  id: string
  dealId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  status: DocumentStatus
  filePath?: string | null
  createdAt: string
  updatedAt: string
}

export interface DocumentWithRelations extends Document {
  bankAccounts?: BankAccount[]
}

export interface BankAccount {
  id: string
  documentId: string
  bankName: string
  accountNumber?: string | null
  accountType?: string | null
  startDate?: string | null
  endDate?: string | null
  createdAt: string
  updatedAt: string
  transactions?: Transaction[]
}

import type { Transaction } from './transaction'
