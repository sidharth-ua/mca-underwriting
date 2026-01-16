'use client'

import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DealStats {
  total: number
  pending: number
  approved: number
  declined: number
  approvalRate: number
  avgProcessingDays: number
  monthlyChange: number
}

interface StatsCardsProps {
  stats: DealStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Deals',
      value: stats.total,
      subtitle: `${stats.monthlyChange >= 0 ? '+' : ''}${stats.monthlyChange}% from last month`,
      icon: FileText,
      iconColor: 'text-blue-500',
      trend: stats.monthlyChange >= 0 ? 'up' : 'down',
    },
    {
      title: 'Pending Review',
      value: stats.pending,
      subtitle: 'Awaiting decision',
      icon: Clock,
      iconColor: 'text-yellow-500',
    },
    {
      title: 'Approved',
      value: stats.approved,
      subtitle: `${stats.approvalRate.toFixed(1)}% approval rate`,
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    {
      title: 'Declined',
      value: stats.declined,
      subtitle: 'This month',
      icon: XCircle,
      iconColor: 'text-red-500',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <Icon className={`h-5 w-5 ${card.iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                {card.trend === 'up' && (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                )}
                {card.trend === 'down' && (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                {card.subtitle}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
