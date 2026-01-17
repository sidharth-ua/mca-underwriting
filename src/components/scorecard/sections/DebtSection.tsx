'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
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
} from 'recharts'
import { AlertTriangle, CreditCard, Calendar } from 'lucide-react'
import { SubsectionGrid } from './SubsectionGrid'
import type { SectionScore } from '@/utils/calculations/scoringFramework'
import type { AggregatedMetrics, Transaction } from '@/utils/calculations/metricsCalculator'
import { formatCurrency } from '@/utils/calculations/scoringFramework'

interface DebtSectionProps {
  section: SectionScore
  metrics: AggregatedMetrics
  transactions: Transaction[]
}

function getGaugeColor(value: number, thresholds: { good: number; fair: number }): string {
  if (value <= thresholds.good) return '#22c55e'
  if (value <= thresholds.fair) return '#eab308'
  return '#ef4444'
}

export function DebtSection({ section, metrics, transactions }: DebtSectionProps) {
  // MCA payment timeline data
  const mcaPaymentData = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      mcaPayments: m.mca?.paymentsTotal || 0,
      revenue: m.revenue.total,
      burdenRatio: m.revenue.total > 0
        ? ((m.mca?.paymentsTotal || 0) / m.revenue.total) * 100
        : 0,
    }))
  }, [metrics])

  // Payment calendar heatmap data (last 90 days)
  const paymentCalendarData = useMemo(() => {
    // Get MCA payment transactions
    const mcaTransactions = transactions.filter((t) =>
      t.category === 'mca_payment' ||
      t.description?.toLowerCase().includes('mca')
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Group by week
    const weeks: Array<{ week: string; count: number; total: number }> = []
    const weekMap = new Map<string, { count: number; total: number }>()

    mcaTransactions.forEach((t) => {
      const date = new Date(t.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      const existing = weekMap.get(weekKey) || { count: 0, total: 0 }
      existing.count++
      existing.total += Math.abs(t.amount)
      weekMap.set(weekKey, existing)
    })

    weekMap.forEach((value, key) => {
      weeks.push({ week: key, ...value })
    })

    return weeks.sort((a, b) => a.week.localeCompare(b.week)).slice(-12)
  }, [transactions])

  // MCA burden ratio calculation
  const mcaBurdenRatio = useMemo(() => {
    return metrics.totalRevenue > 0
      ? (metrics.mca.paymentsTotal / metrics.totalRevenue) * 100
      : 0
  }, [metrics])

  // Active MCA count and details
  const activeMCACount = metrics.mca.uniqueMCACount || 0
  const hasStacking = metrics.mca.stackingIndicator || false

  // MCA by lender breakdown
  const mcaByLender = useMemo(() => {
    if (!metrics.mca.mcaDetails) return []
    return Object.entries(metrics.mca.mcaDetails)
      .map(([lender, data]) => ({
        lender,
        payments: (data as { payments?: number }).payments || 0,
      }))
      .filter((item) => item.payments > 0)
      .sort((a, b) => b.payments - a.payments)
  }, [metrics])

  return (
    <>
      {/* Left column - Subsections */}
      <div className="lg:col-span-5 space-y-4">
        <SubsectionGrid subsections={section.subsections} />

        {/* Stacking Alert */}
        {hasStacking && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-800">MCA Stacking Detected</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Multiple MCA positions identified, which significantly increases repayment risk
                    and may indicate financial stress.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right column - Visualizations */}
      <div className="lg:col-span-7 space-y-4">
        {/* MCA Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <CreditCard className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-xs text-gray-500">Active MCAs</p>
              <p className={`text-2xl font-bold ${
                activeMCACount === 0 ? 'text-green-600' :
                activeMCACount === 1 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {activeMCACount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-xs text-gray-500">Total MCA Payments</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(metrics.mca.paymentsTotal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className={`h-6 w-6 mx-auto mb-2 ${
                mcaBurdenRatio < 10 ? 'text-green-500' :
                mcaBurdenRatio < 20 ? 'text-yellow-500' : 'text-red-500'
              }`} />
              <p className="text-xs text-gray-500">MCA Burden Ratio</p>
              <p className={`text-2xl font-bold ${
                mcaBurdenRatio < 10 ? 'text-green-600' :
                mcaBurdenRatio < 20 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {mcaBurdenRatio.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* MCA Payment Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">MCA Payment Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mcaPaymentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const numValue = Number(value) || 0
                      if (name === 'burdenRatio') return `${numValue.toFixed(1)}%`
                      return formatCurrency(numValue)
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="mcaPayments"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    name="MCA Payments"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="burdenRatio"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Burden Ratio %"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* MCA Burden Gauge & Payment Calendar */}
        <div className="grid grid-cols-2 gap-4">
          {/* Burden Gauge */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">MCA Burden Gauge</CardTitle>
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
                      stroke={getGaugeColor(mcaBurdenRatio, { good: 10, fair: 20 })}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(mcaBurdenRatio / 30, 1) * 220} 220`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                    <span className="text-2xl font-bold">{mcaBurdenRatio.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500">of Revenue</span>
                  </div>
                </div>
                <div className="mt-2 flex justify-center gap-3 text-xs">
                  <span className="text-green-600">&lt;10% Low</span>
                  <span className="text-yellow-600">10-20% Moderate</span>
                  <span className="text-red-600">&gt;20% High</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Regularity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Payment Regularity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                {paymentCalendarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentCalendarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 9 }}
                        tickFormatter={(v) => {
                          const date = new Date(v)
                          return `${date.getMonth() + 1}/${date.getDate()}`
                        }}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value, name) =>
                          name === 'count' ? `${value} payments` : formatCurrency(Number(value) || 0)
                        }
                        labelFormatter={(label) => `Week of ${new Date(String(label)).toLocaleDateString()}`}
                      />
                      <Bar
                        dataKey="count"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        name="Payments"
                      >
                        {paymentCalendarData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.count > 5 ? '#ef4444' : entry.count > 3 ? '#f59e0b' : '#3b82f6'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No MCA payment data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MCA by Lender */}
        {mcaByLender.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">MCA Payments by Lender</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mcaByLender.map((lender, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{lender.lender}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">
                        {formatCurrency(lender.payments)}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({((lender.payments / metrics.mca.paymentsTotal) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
