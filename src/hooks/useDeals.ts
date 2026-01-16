import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  runningBalance: number
  category?: string | null
  subcategory?: string | null
}

interface BankAccount {
  id: string
  bankName: string
  accountNumber?: string
  accountType?: string
  transactions?: Transaction[]
  _count?: {
    transactions: number
  }
}

interface Document {
  id: string
  originalName: string
  status: string
  size: number
  createdAt: string
  bankAccounts?: BankAccount[]
}

interface DealActivity {
  id: string
  action: string
  details?: string | null
  createdAt: string
  user?: {
    name?: string | null
    email: string
  } | null
}

interface Deal {
  id: string
  merchantName: string
  status: string
  decision?: string | null
  decisionNotes?: string | null
  createdAt: string
  updatedAt: string
  documents?: Document[]
  activities?: DealActivity[]
  _count?: {
    documents: number
  }
}

interface CreateDealInput {
  merchantName: string
}

interface UpdateDealInput {
  merchantName?: string
  status?: string
  decision?: string
  decisionNotes?: string
}

// Fetch all deals
async function fetchDeals(status?: string, search?: string): Promise<Deal[]> {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (search) params.append('search', search)

  const response = await fetch(`/api/deals?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch deals')
  }
  return response.json()
}

// Fetch single deal
async function fetchDeal(id: string): Promise<Deal> {
  const response = await fetch(`/api/deals/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch deal')
  }
  return response.json()
}

// Create deal
async function createDeal(data: CreateDealInput): Promise<Deal> {
  const response = await fetch('/api/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create deal')
  }
  return response.json()
}

// Update deal
async function updateDeal({ id, ...data }: UpdateDealInput & { id: string }): Promise<Deal> {
  const response = await fetch(`/api/deals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update deal')
  }
  return response.json()
}

// Delete deal
async function deleteDeal(id: string): Promise<void> {
  const response = await fetch(`/api/deals/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete deal')
  }
}

// Hook to fetch all deals
export function useDeals(status?: string, search?: string) {
  return useQuery({
    queryKey: ['deals', { status, search }],
    queryFn: () => fetchDeals(status, search),
  })
}

// Hook to fetch single deal
export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => fetchDeal(id),
    enabled: !!id,
  })
}

// Hook to create deal
export function useCreateDeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

// Hook to update deal
export function useUpdateDeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateDeal,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['deal', data.id] })
    },
  })
}

// Hook to delete deal
export function useDeleteDeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}
