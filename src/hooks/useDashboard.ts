import { useQuery } from '@tanstack/react-query'

interface DealStats {
  total: number
  pending: number
  approved: number
  declined: number
  approvalRate: number
  avgProcessingDays: number
  monthlyChange: number
}

interface MonthlyData {
  month: string
  deals: number
  approved: number
  declined: number
  [key: string]: string | number
}

interface DecisionData {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface Activity {
  id: string
  action: string
  details?: string | null
  createdAt: string
  deal?: {
    id: string
    merchantName: string
  } | null
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
  createdAt: string
  _count?: {
    documents: number
  }
}

interface DashboardData {
  stats: DealStats
  monthlyData: MonthlyData[]
  decisionData: DecisionData[]
  recentActivities: Activity[]
  deals: Deal[]
}

async function fetchDashboardStats(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard/stats')
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats')
  }
  return response.json()
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
