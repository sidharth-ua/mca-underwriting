export type DealStatus = 'NEW' | 'PROCESSING' | 'READY' | 'REVIEWED' | 'DECIDED'

export type Decision = 'APPROVED' | 'DECLINED' | 'MORE_INFO'

export interface Deal {
  id: string
  merchantName: string
  status: DealStatus
  decision?: Decision | null
  decisionNotes?: string | null
  assignedToId?: string | null
  createdAt: string
  updatedAt: string
}

export interface DealWithRelations extends Deal {
  documents?: Document[]
  metrics?: DealMetrics | null
  notes?: DealNote[]
  activities?: DealActivity[]
}

export interface DealNote {
  id: string
  dealId: string
  userId: string
  content: string
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    name: string | null
    email: string
  }
}

export interface DealActivity {
  id: string
  dealId: string
  userId?: string | null
  action: string
  details?: string | null
  createdAt: string
  user?: {
    id: string
    name: string | null
    email: string
  } | null
}

export interface CreateDealInput {
  merchantName: string
}

export interface UpdateDealInput {
  merchantName?: string
  status?: DealStatus
  decision?: Decision
  decisionNotes?: string
  assignedToId?: string | null
}

export interface DealDecisionInput {
  decision: Decision
  notes: string
}

import type { Document } from './document'
import type { DealMetrics } from './metrics'
