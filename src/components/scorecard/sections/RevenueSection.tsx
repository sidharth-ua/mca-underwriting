'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { SubsectionGrid } from './SubsectionGrid'
import type { SectionScore } from '@/utils/calculations/scoringFramework'
import type { AggregatedMetrics } from '@/utils/calculations/metricsCalculator'
import { formatCurrency } from '@/utils/calculations/scoringFramework'

interface RevenueSectionProps {
  section: SectionScore
  metrics: AggregatedMetrics
}

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

function formatYAxis(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value}`
}

function getGaugeColor(value: number, thresholds: { good: number; fair: number }): string {
  if (value <= thresholds.good) return '#22c55e'
  if (value <= thresholds.fair) return '#eab308'
  return '#ef4444'
}

export function RevenueSection({ section, metrics }: RevenueSectionProps) {
  // Prepare monthly revenue trend data
  const monthlyTrendData = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      revenue: m.revenue.total,
      avgRevenue: metrics.totalRevenue / metrics.monthsAnalyzed,
    }))
  }, [metrics])

  // Prepare revenue sources data for pie chart
  const revenueSourcesData = useMemo(() => {
    const sources = [
      { name: 'Card Sales', value: metrics.revenue.creditCardSales },
      { name: 'ACH Deposits', value: metrics.revenue.achDeposits },
      { name: 'Check Deposits', value: metrics.revenue.checkDeposits },
      { name: 'Wire Transfers', value: metrics.revenue.wireTransfers },
      { name: 'Other', value: metrics.revenue.otherRevenue },
    ].filter((s) => s.value > 0)

    return sources.sort((a, b) => b.value - a.value)
  }, [metrics])

  // Month-over-month growth data
  const growthData = useMemo(() => {
    return metrics.monthlyData.map((m, idx, arr) => {
      let growth = 0
      if (idx > 0 && arr[idx - 1].revenue.total > 0) {
        growth = ((m.revenue.total - arr[idx - 1].revenue.total) / arr[idx - 1].revenue.total) * 100
      }
      return {
        month: m.month,
        growth: growth,
        revenue: m.revenue.total,
      }
    })
  }, [metrics])

  // Calculate CV for stability gauge
  const revenueCV = useMemo(() => {
    const revenues = metrics.monthlyData.map((m) => m.revenue.total)
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length
    if (mean === 0) return 0
    const variance = revenues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / revenues.length
    return (Math.sqrt(variance) / mean) * 100
  }, [metrics])

  // Determine trend icon
  const trendDirection = useMemo(() => {
    if (growthData.length < 2) return 'stable'
    const recentGrowth = growthData.slice(-3).reduce((sum, g) => sum + g.growth, 0) / 3
    if (recentGrowth > 5) return 'up'
    if (recentGrowth < -5) return 'down'
    return 'stable'
  }, [growthData])

  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus
  const trendColor = trendDirection === 'up' ? 'text-green-500' : trendDirection === 'down' ? 'text-red-500' : 'text-gray-500'

  return (
    <>
      {/* Left column - Subsections */}
      <div className="lg:col-span-5 space-y-4">
        <SubsectionGrid subsections={section.subsections} />
      </div>

      {/* Right column - Visualizations */}
      <div className="lg:col-span-7 space-y-4">
        {/* Monthly Revenue Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Monthly Revenue Trend</CardTitle>
              <div className={`flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {trendDirection === 'up' ? 'Growing' : trendDirection === 'down' ? 'Declining' : 'Stable'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#22c55e' }}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRevenue"
                    stroke="#9ca3af"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Average"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Sources & Stability */}
        <div className="grid grid-cols-2 gap-4">
          {/* Revenue Sources Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueSourcesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ percent }) =>
                        (percent || 0) > 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : ''
                      }
                      labelLine={false}
                    >
                      {revenueSourcesData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {revenueSourcesData.slice(0, 4).map((source, idx) => (
                  <div key={source.name} className="flex items-center gap-1 text-xs">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="text-gray-600">{source.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stability Gauge */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue Stability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center h-48">
                {/* Semi-circular gauge */}
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
                      stroke={getGaugeColor(revenueCV, { good: 15, fair: 30 })}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(revenueCV / 50, 1) * 220} 220`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                    <span className="text-2xl font-bold">{revenueCV.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500">CV (Volatility)</span>
                  </div>
                </div>
                <div className="mt-2 flex justify-center gap-4 text-xs">
                  <span className="text-green-600">&lt;15% Stable</span>
                  <span className="text-yellow-600">15-30% Moderate</span>
                  <span className="text-red-600">&gt;30% Volatile</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Month-over-Month Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Month-over-Month Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(value, name) => {
                      const numValue = Number(value) || 0
                      return name === 'growth' ? `${numValue.toFixed(1)}%` : formatCurrency(numValue)
                    }}
                  />
                  <Bar
                    dataKey="growth"
                    name="Growth %"
                    radius={[4, 4, 0, 0]}
                  >
                    {growthData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.growth >= 0 ? '#22c55e' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Revenue Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Revenue</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">Avg Monthly</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(metrics.totalRevenue / metrics.monthsAnalyzed)}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500">Top Source</p>
                <p className="text-lg font-bold text-purple-600">
                  {revenueSourcesData[0]?.name || 'N/A'}
                </p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-gray-500">Concentration</p>
                <p className="text-lg font-bold text-yellow-600">
                  {revenueSourcesData[0]
                    ? `${((revenueSourcesData[0].value / metrics.totalRevenue) * 100).toFixed(0)}%`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
