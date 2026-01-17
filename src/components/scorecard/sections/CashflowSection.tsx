'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Wallet, AlertCircle } from 'lucide-react'
import { SubsectionGrid } from './SubsectionGrid'
import type { SectionScore } from '@/utils/calculations/scoringFramework'
import type { AggregatedMetrics } from '@/utils/calculations/metricsCalculator'
import { formatCurrency } from '@/utils/calculations/scoringFramework'

interface CashflowSectionProps {
  section: SectionScore
  metrics: AggregatedMetrics
}

function formatYAxis(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value}`
}

function getGaugeColor(value: number, thresholds: { good: number; fair: number }, inverse: boolean = false): string {
  if (inverse) {
    if (value >= thresholds.good) return '#22c55e'
    if (value >= thresholds.fair) return '#eab308'
    return '#ef4444'
  } else {
    if (value <= thresholds.good) return '#22c55e'
    if (value <= thresholds.fair) return '#eab308'
    return '#ef4444'
  }
}

export function CashflowSection({ section, metrics }: CashflowSectionProps) {
  // Balance history data
  const balanceHistoryData = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      avgBalance: m.cashFlow.avgDailyBalance,
      minBalance: m.cashFlow.minBalance,
      endingBalance: m.cashFlow.endingBalance,
    }))
  }, [metrics])

  // NSF timeline data
  const nsfTimelineData = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      nsfCount: m.nsf?.count || 0,
      nsfFees: m.nsf?.totalFees || 0,
    }))
  }, [metrics])

  // Negative balance days data
  const negativeDaysData = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      negativeDays: m.nsf?.negativeBalanceDays || 0,
      daysInMonth: 30, // Approximate
    }))
  }, [metrics])

  // Calculate liquidity ratio (avg daily balance / avg daily expenses)
  const liquidityRatio = useMemo(() => {
    const avgDailyExpenses = metrics.totalExpenses / metrics.totalDaysAnalyzed
    if (avgDailyExpenses === 0) return 0
    return metrics.cashFlow.avgDailyBalance / avgDailyExpenses
  }, [metrics])

  // NSF trend
  const nsfTrend = useMemo(() => {
    const counts = nsfTimelineData.map((d) => d.nsfCount)
    if (counts.length < 2) return 'stable'
    const firstHalf = counts.slice(0, Math.floor(counts.length / 2))
    const secondHalf = counts.slice(Math.floor(counts.length / 2))
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    if (secondAvg < firstAvg * 0.8) return 'improving'
    if (secondAvg > firstAvg * 1.2) return 'worsening'
    return 'stable'
  }, [nsfTimelineData])

  const TrendIcon = nsfTrend === 'improving' ? TrendingDown : nsfTrend === 'worsening' ? TrendingUp : Minus
  const trendColor = nsfTrend === 'improving' ? 'text-green-500' : nsfTrend === 'worsening' ? 'text-red-500' : 'text-gray-500'
  const trendLabel = nsfTrend === 'improving' ? 'Improving' : nsfTrend === 'worsening' ? 'Worsening' : 'Stable'

  return (
    <>
      {/* Left column - Subsections */}
      <div className="lg:col-span-5 space-y-4">
        <SubsectionGrid subsections={section.subsections} />
      </div>

      {/* Right column - Visualizations */}
      <div className="lg:col-span-7 space-y-4">
        {/* Key Metrics Summary */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Wallet className="h-5 w-5 mx-auto text-blue-500 mb-2" />
              <p className="text-xs text-gray-500">Avg Daily Balance</p>
              <p className={`text-lg font-bold ${
                metrics.cashFlow.avgDailyBalance >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}>
                {formatCurrency(metrics.cashFlow.avgDailyBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className={`h-5 w-5 mx-auto mb-2 ${
                metrics.nsf.count === 0 ? 'text-green-500' : 'text-red-500'
              }`} />
              <p className="text-xs text-gray-500">NSF Events</p>
              <p className={`text-lg font-bold ${
                metrics.nsf.count === 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {metrics.nsf.count}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className={`h-5 w-5 mx-auto mb-2 ${
                metrics.nsf.negativeBalanceDays === 0 ? 'text-green-500' :
                metrics.nsf.negativeBalanceDays < 10 ? 'text-yellow-500' : 'text-red-500'
              }`} />
              <p className="text-xs text-gray-500">Negative Days</p>
              <p className={`text-lg font-bold ${
                metrics.nsf.negativeBalanceDays === 0 ? 'text-green-600' :
                metrics.nsf.negativeBalanceDays < 10 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.nsf.negativeBalanceDays}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendIcon className={`h-5 w-5 mx-auto mb-2 ${
                liquidityRatio >= 30 ? 'text-green-500' :
                liquidityRatio >= 7 ? 'text-yellow-500' : 'text-red-500'
              }`} />
              <p className="text-xs text-gray-500">Days of Runway</p>
              <p className={`text-lg font-bold ${
                liquidityRatio >= 30 ? 'text-green-600' :
                liquidityRatio >= 7 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {liquidityRatio.toFixed(0)} days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Balance History Area Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Balance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="avgBalance"
                    stroke="#3b82f6"
                    fill="#93c5fd"
                    fillOpacity={0.5}
                    name="Avg Balance"
                  />
                  <Line
                    type="monotone"
                    dataKey="minBalance"
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Min Balance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* NSF Timeline & Liquidity Gauge */}
        <div className="grid grid-cols-2 gap-4">
          {/* NSF Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">NSF/Overdraft Events</CardTitle>
                <div className={`flex items-center gap-1 ${trendColor}`}>
                  <TrendIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">{trendLabel}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nsfTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === 'nsfCount' ? `${value} events` : formatCurrency(Number(value) || 0)
                      }
                    />
                    <Bar dataKey="nsfCount" name="NSF Events" radius={[4, 4, 0, 0]}>
                      {nsfTimelineData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.nsfCount === 0 ? '#22c55e' : entry.nsfCount <= 2 ? '#f59e0b' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Liquidity Gauge */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Liquidity (Days of Runway)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center h-48">
                <div className="relative">
                  <svg width="160" height="100" viewBox="0 0 160 100">
                    {/* Background arc */}
                    <path
                      d="M 10 90 A 70 70 0 0 1 150 90"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    {/* Colored arc */}
                    <path
                      d="M 10 90 A 70 70 0 0 1 150 90"
                      fill="none"
                      stroke={getGaugeColor(liquidityRatio, { good: 30, fair: 7 }, true)}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(liquidityRatio / 60, 1) * 220} 220`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                    <span className="text-2xl font-bold">{liquidityRatio.toFixed(0)}</span>
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
                <div className="mt-2 flex justify-center gap-3 text-xs">
                  <span className="text-red-600">&lt;7 Critical</span>
                  <span className="text-yellow-600">7-30 Fair</span>
                  <span className="text-green-600">&gt;30 Good</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Negative Balance Days Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Negative Balance Days by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={negativeDaysData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 31]} />
                  <Tooltip
                    formatter={(value) => `${value} days`}
                  />
                  <Bar dataKey="negativeDays" name="Negative Days" radius={[4, 4, 0, 0]}>
                    {negativeDaysData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.negativeDays === 0 ? '#22c55e' :
                          entry.negativeDays <= 5 ? '#84cc16' :
                          entry.negativeDays <= 10 ? '#f59e0b' :
                          '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>0 days</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-lime-500" />
                <span>1-5 days</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>6-10 days</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>&gt;10 days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cash Flow Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500">Net Cash Flow</p>
                <p className={`text-lg font-bold ${
                  metrics.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(metrics.netCashFlow)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">Ending Balance</p>
                <p className={`text-lg font-bold ${
                  metrics.cashFlow.endingBalance >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {formatCurrency(metrics.cashFlow.endingBalance)}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500">Min Balance</p>
                <p className={`text-lg font-bold ${
                  metrics.cashFlow.minBalance >= 0 ? 'text-purple-600' : 'text-red-600'
                }`}>
                  {formatCurrency(metrics.cashFlow.minBalance)}
                </p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-gray-500">Total NSF Fees</p>
                <p className={`text-lg font-bold ${
                  metrics.nsf.totalFees === 0 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {formatCurrency(metrics.nsf.totalFees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
