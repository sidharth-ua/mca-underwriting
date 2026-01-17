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
import { SubsectionGrid } from './SubsectionGrid'
import type { SectionScore } from '@/utils/calculations/scoringFramework'
import type { AggregatedMetrics } from '@/utils/calculations/metricsCalculator'
import { formatCurrency } from '@/utils/calculations/scoringFramework'

interface ExpenseSectionProps {
  section: SectionScore
  metrics: AggregatedMetrics
}

const CHART_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6']

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

export function ExpenseSection({ section, metrics }: ExpenseSectionProps) {
  // Expense ratio trend data
  const expenseRatioTrend = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      expenseRatio: m.revenue.total > 0
        ? (m.expenses.total / m.revenue.total) * 100
        : 0,
      expenses: m.expenses.total,
      revenue: m.revenue.total,
    }))
  }, [metrics])

  // Category breakdown data
  const categoryBreakdown = useMemo(() => {
    const categories = [
      { name: 'Payroll', value: metrics.expenses.payroll },
      { name: 'Recurring', value: metrics.expenses.recurring },
      { name: 'Owner Draws', value: metrics.expenses.ownerDraws },
      { name: 'Vendor', value: metrics.expenses.vendorPayments },
      { name: 'NSF Fees', value: metrics.expenses.nsfFees },
      { name: 'Other', value: metrics.expenses.otherExpenses },
    ].filter((c) => c.value > 0)

    return categories.sort((a, b) => b.value - a.value)
  }, [metrics])

  // Monthly stacked expense data
  const monthlyStackedData = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      Recurring: m.expenses.recurring,
      Payroll: m.expenses.payroll,
      'Owner Draws': m.expenses.ownerDraws,
      Vendor: m.expenses.vendorPayments,
      Other: m.expenses.otherExpenses,
    }))
  }, [metrics])

  // Fixed vs Variable expense calculation
  const fixedVsVariable = useMemo(() => {
    const fixed = metrics.expenses.recurring + metrics.expenses.payroll
    const variable = metrics.totalExpenses - fixed
    return [
      { name: 'Fixed', value: fixed },
      { name: 'Variable', value: variable },
    ].filter((item) => item.value > 0)
  }, [metrics])

  // Owner draws pattern
  const ownerDrawsData = useMemo(() => {
    return metrics.monthlyData.map((m) => ({
      month: m.month,
      draws: m.expenses.ownerDraws,
      avgDraws: metrics.expenses.ownerDraws / metrics.monthsAnalyzed,
    }))
  }, [metrics])

  // Calculate average expense ratio
  const avgExpenseRatio = useMemo(() => {
    return metrics.totalRevenue > 0
      ? (metrics.totalExpenses / metrics.totalRevenue) * 100
      : 0
  }, [metrics])

  return (
    <>
      {/* Left column - Subsections */}
      <div className="lg:col-span-5 space-y-4">
        <SubsectionGrid subsections={section.subsections} />
      </div>

      {/* Right column - Visualizations */}
      <div className="lg:col-span-7 space-y-4">
        {/* Expense Ratio Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Expense Ratio Trend</CardTitle>
              <div className={`text-sm font-medium ${
                avgExpenseRatio < 70 ? 'text-green-600' :
                avgExpenseRatio < 90 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                Avg: {avgExpenseRatio.toFixed(1)}%
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={expenseRatioTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const numValue = Number(value) || 0
                      if (name === 'expenseRatio') return `${numValue.toFixed(1)}%`
                      return formatCurrency(numValue)
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenseRatio"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#ef4444' }}
                    name="Expense Ratio"
                  />
                  {/* Reference line at 70% */}
                  <Line
                    type="monotone"
                    dataKey={() => 70}
                    stroke="#22c55e"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Target (70%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown & Fixed vs Variable */}
        <div className="grid grid-cols-2 gap-4">
          {/* Category Stacked Bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Expense Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStackedData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatYAxis} />
                    <YAxis type="category" dataKey="month" tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                    <Bar dataKey="Recurring" stackId="a" fill="#ef4444" />
                    <Bar dataKey="Payroll" stackId="a" fill="#f97316" />
                    <Bar dataKey="Owner Draws" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Vendor" stackId="a" fill="#84cc16" />
                    <Bar dataKey="Other" stackId="a" fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Fixed vs Variable Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fixed vs Variable</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fixedVsVariable}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Fixed (Predictable)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Variable</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Owner Draws Pattern */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Owner Draws Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerDrawsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  <Bar
                    dataKey="draws"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                    name="Owner Draws"
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDraws"
                    stroke="#9ca3af"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Average"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Expense Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Expenses</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(metrics.totalExpenses)}
                </p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">Avg Monthly</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(metrics.totalExpenses / metrics.monthsAnalyzed)}
                </p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-500">Owner Draws</p>
                <p className="text-lg font-bold text-purple-600">
                  {formatCurrency(metrics.expenses.ownerDraws)}
                </p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-gray-500">Expense Ratio</p>
                <p className={`text-lg font-bold ${
                  avgExpenseRatio < 70 ? 'text-green-600' :
                  avgExpenseRatio < 90 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {avgExpenseRatio.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
