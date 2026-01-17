'use client'

import { cn } from '@/lib/utils'
import { DollarSign, Banknote, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface QuickStatsCardProps {
  label: string
  value: string
  icon: 'revenue' | 'mca' | 'nsf' | 'cashflow'
  trend?: 'up' | 'down' | 'neutral'
  alert?: boolean
  className?: string
}

export function QuickStatsCard({
  label,
  value,
  icon,
  trend,
  alert = false,
  className
}: QuickStatsCardProps) {
  const IconComponent = {
    revenue: DollarSign,
    mca: Banknote,
    nsf: AlertTriangle,
    cashflow: trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  }[icon]

  const iconColors = {
    revenue: 'text-blue-600 bg-blue-100',
    mca: alert ? 'text-red-600 bg-red-100' : 'text-gray-600 bg-gray-100',
    nsf: alert ? 'text-red-600 bg-red-100' : 'text-yellow-600 bg-yellow-100',
    cashflow: trend === 'up' ? 'text-green-600 bg-green-100' : trend === 'down' ? 'text-red-600 bg-red-100' : 'text-gray-600 bg-gray-100'
  }

  return (
    <div className={cn(
      'p-3 rounded-lg border bg-white',
      alert && 'border-red-200 bg-red-50/50',
      className
    )}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn(
          'w-6 h-6 rounded-md flex items-center justify-center',
          iconColors[icon]
        )}>
          <IconComponent className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className={cn(
        'text-lg font-semibold',
        alert ? 'text-red-700' : 'text-gray-900'
      )}>
        {value}
      </div>
    </div>
  )
}

interface QuickStatsGridProps {
  totalRevenue: number
  mcaDebt: number
  mcaCount: number
  nsfCount: number
  netCashFlow: number
  className?: string
}

export function QuickStatsGrid({
  totalRevenue,
  mcaDebt,
  mcaCount,
  nsfCount,
  netCashFlow,
  className
}: QuickStatsGridProps) {
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <QuickStatsCard
        label="Revenue"
        value={formatCurrency(totalRevenue)}
        icon="revenue"
      />
      <QuickStatsCard
        label="MCA Debt"
        value={formatCurrency(mcaDebt)}
        icon="mca"
        alert={mcaCount > 2}
      />
      <QuickStatsCard
        label="NSF Events"
        value={nsfCount.toString()}
        icon="nsf"
        alert={nsfCount > 5}
      />
      <QuickStatsCard
        label="Cash Flow"
        value={formatCurrency(netCashFlow)}
        icon="cashflow"
        trend={netCashFlow > 0 ? 'up' : netCashFlow < 0 ? 'down' : 'neutral'}
      />
    </div>
  )
}
