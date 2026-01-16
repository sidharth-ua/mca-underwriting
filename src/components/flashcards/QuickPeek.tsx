'use client'

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CreditCard,
  Building2,
  Calendar,
  Activity,
} from 'lucide-react'
import { FlashCard } from './FlashCard'

interface DealMetrics {
  // Revenue metrics
  totalRevenue?: number
  avgMonthlyRevenue?: number
  revenueGrowth?: number

  // Expense metrics
  totalExpenses?: number
  avgMonthlyExpenses?: number

  // MCA metrics
  existingMcaCount?: number
  existingMcaBalance?: number
  mcaPaymentTotal?: number

  // Risk metrics
  nsfCount?: number
  negativeBalanceDays?: number
  avgDailyBalance?: number

  // Period info
  periodStart?: string
  periodEnd?: string
  monthsAnalyzed?: number
}

interface QuickPeekProps {
  metrics?: DealMetrics | null
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '0'
  return new Intl.NumberFormat('en-US').format(value)
}

export function QuickPeek({ metrics }: QuickPeekProps) {
  // If no metrics, show placeholder
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FlashCard
          title="Total Revenue"
          value="--"
          subtitle="Awaiting analysis"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <FlashCard
          title="Total Expenses"
          value="--"
          subtitle="Awaiting analysis"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <FlashCard
          title="Existing MCAs"
          value="--"
          subtitle="Awaiting analysis"
          icon={<CreditCard className="h-4 w-4" />}
        />
        <FlashCard
          title="Risk Score"
          value="--"
          subtitle="Awaiting analysis"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
    )
  }

  // Calculate derived values
  const netIncome = (metrics.totalRevenue || 0) - (metrics.totalExpenses || 0)
  const netIncomePositive = netIncome >= 0

  // Determine risk level
  const getRiskVariant = (): 'success' | 'warning' | 'danger' => {
    const nsfCount = metrics.nsfCount || 0
    const negativeDays = metrics.negativeBalanceDays || 0

    if (nsfCount > 5 || negativeDays > 10) return 'danger'
    if (nsfCount > 2 || negativeDays > 5) return 'warning'
    return 'success'
  }

  // Determine MCA variant
  const getMcaVariant = (): 'success' | 'warning' | 'danger' => {
    const mcaCount = metrics.existingMcaCount || 0
    if (mcaCount > 3) return 'danger'
    if (mcaCount > 1) return 'warning'
    return 'success'
  }

  return (
    <div className="space-y-6">
      {/* Period info */}
      {metrics.periodStart && metrics.periodEnd && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          <span>
            Analysis Period: {new Date(metrics.periodStart).toLocaleDateString()} -{' '}
            {new Date(metrics.periodEnd).toLocaleDateString()}
            {metrics.monthsAnalyzed && ` (${metrics.monthsAnalyzed} months)`}
          </span>
        </div>
      )}

      {/* Main metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FlashCard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          subtitle={`Avg ${formatCurrency(metrics.avgMonthlyRevenue)}/mo`}
          icon={<DollarSign className="h-4 w-4" />}
          variant="success"
          trend={
            metrics.revenueGrowth !== undefined
              ? {
                  value: metrics.revenueGrowth,
                  label: 'vs prior period',
                  isPositive: metrics.revenueGrowth > 0,
                }
              : undefined
          }
        />

        <FlashCard
          title="Total Expenses"
          value={formatCurrency(metrics.totalExpenses)}
          subtitle={`Avg ${formatCurrency(metrics.avgMonthlyExpenses)}/mo`}
          icon={<TrendingDown className="h-4 w-4" />}
        />

        <FlashCard
          title="Net Income"
          value={formatCurrency(Math.abs(netIncome))}
          subtitle={netIncomePositive ? 'Positive cash flow' : 'Negative cash flow'}
          icon={netIncomePositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          variant={netIncomePositive ? 'success' : 'danger'}
        />

        <FlashCard
          title="Avg Daily Balance"
          value={formatCurrency(metrics.avgDailyBalance)}
          subtitle="Average over period"
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      {/* Risk indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <FlashCard
          title="Existing MCAs"
          value={formatNumber(metrics.existingMcaCount)}
          subtitle={
            metrics.existingMcaBalance
              ? `Balance: ${formatCurrency(metrics.existingMcaBalance)}`
              : 'No existing positions'
          }
          icon={<CreditCard className="h-4 w-4" />}
          variant={getMcaVariant()}
        />

        <FlashCard
          title="MCA Payments"
          value={formatCurrency(metrics.mcaPaymentTotal)}
          subtitle="Total MCA outflows"
          icon={<Activity className="h-4 w-4" />}
          variant={metrics.mcaPaymentTotal && metrics.mcaPaymentTotal > 0 ? 'warning' : 'success'}
        />

        <FlashCard
          title="NSF/Overdrafts"
          value={formatNumber(metrics.nsfCount)}
          subtitle="Insufficient fund events"
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={getRiskVariant()}
        />

        <FlashCard
          title="Negative Days"
          value={formatNumber(metrics.negativeBalanceDays)}
          subtitle="Days with negative balance"
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={getRiskVariant()}
        />
      </div>
    </div>
  )
}
