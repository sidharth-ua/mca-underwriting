'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CreditCard,
  Banknote,
  Calendar,
  Activity,
  BarChart2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  calculateAggregatedMetrics,
  formatCurrency,
  formatPercent,
  validateBeforeRender,
  detectMCAStacking,
  type Transaction,
  type AggregatedMetrics,
  type MCAStackingAlert,
  type ValidationResult,
} from '@/utils/calculations/metricsCalculator'

interface ScorecardProps {
  transactions?: Transaction[]
  className?: string
}

interface MetricRowProps {
  label: string
  value: string | number
  sparklineData?: number[]
  trend?: 'up' | 'down' | 'neutral'
  highlight?: 'good' | 'warning' | 'bad' | 'neutral'
}

// Sparkline component
function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null

  const chartData = data.map((value, index) => ({ value, index }))

  return (
    <div className="w-20 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Metric row component
function MetricRow({ label, value, sparklineData, trend, highlight = 'neutral' }: MetricRowProps) {
  const highlightColors = {
    good: 'text-green-600',
    warning: 'text-yellow-600',
    bad: 'text-red-600',
    neutral: 'text-gray-900',
  }

  const sparklineColors = {
    good: '#22c55e',
    warning: '#eab308',
    bad: '#ef4444',
    neutral: '#3b82f6',
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={sparklineColors[highlight]} />
        )}
        <span className={`font-medium ${highlightColors[highlight]}`}>
          {value}
          {trend === 'up' && <TrendingUp className="inline ml-1 h-3 w-3 text-green-500" />}
          {trend === 'down' && <TrendingDown className="inline ml-1 h-3 w-3 text-red-500" />}
        </span>
      </div>
    </div>
  )
}

// Score badge component
function ScoreBadge({ score, label }: { score: number; label: string }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-green-100 text-green-800 border-green-200'
    if (s >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  return (
    <div className="flex flex-col items-center p-3 rounded-lg border bg-white">
      <span className="text-xs text-gray-500 mb-1">{label}</span>
      <Badge variant="outline" className={getScoreColor(score)}>
        {score}/100
      </Badge>
    </div>
  )
}

// Monthly breakdown chart
function MonthlyBreakdownChart({ data, type }: { data: AggregatedMetrics['monthlyData']; type: 'revenue' | 'expenses' }) {
  const chartData = data.map(m => ({
    month: m.month,
    value: type === 'revenue' ? m.revenue.total : m.expenses.total,
    [type]: type === 'revenue' ? m.revenue.total : m.expenses.total,
  }))

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value) || 0), type === 'revenue' ? 'Revenue' : 'Expenses']}
          />
          <Bar
            dataKey={type}
            fill={type === 'revenue' ? '#22c55e' : '#ef4444'}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Scorecard({ transactions, className }: ScorecardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const metrics = useMemo(() => {
    if (!transactions || transactions.length === 0) return null
    return calculateAggregatedMetrics(transactions)
  }, [transactions])

  // Validate metrics before rendering
  const validation = useMemo((): ValidationResult | null => {
    if (!metrics) return null
    return validateBeforeRender(metrics)
  }, [metrics])

  // Detect MCA stacking alerts
  const stackingAlerts = useMemo((): MCAStackingAlert[] => {
    if (!transactions || transactions.length === 0) return []
    return detectMCAStacking(transactions)
  }, [transactions])

  if (!transactions || transactions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Underwriter Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No transaction data available</p>
            <p className="text-sm">Upload and process bank statements to generate scorecard</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Underwriter Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>Unable to calculate metrics from transaction data</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Prepare sparkline data from monthly metrics
  const monthlyRevenueData = metrics.monthlyData.map(m => m.revenue.total)
  const monthlyExpenseData = metrics.monthlyData.map(m => m.expenses.total)
  const monthlyMCAData = metrics.monthlyData.map(m => m.mca.paymentsTotal)
  const monthlyNSFData = metrics.monthlyData.map(m => m.nsf.count)
  const monthlyCashFlowData = metrics.monthlyData.map(m => m.cashFlow.netCashFlow)

  return (
    <div className={className}>
      {/* Header with Period Info */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Underwriter Scorecard
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(metrics.periodStart).toLocaleDateString()} - {new Date(metrics.periodEnd).toLocaleDateString()}
                </span>
              </div>
              <Badge variant="outline">
                {metrics.monthsAnalyzed} Month{metrics.monthsAnalyzed > 1 ? 's' : ''} Analyzed
              </Badge>
            </div>
          </div>
        </CardHeader>

        {/* Score Summary */}
        <CardContent>
          <div className="grid grid-cols-6 gap-3">
            <ScoreBadge score={metrics.scores.overall} label="Overall" />
            <ScoreBadge score={metrics.scores.revenue} label="Revenue" />
            <ScoreBadge score={metrics.scores.expenses} label="Expenses" />
            <ScoreBadge score={metrics.scores.mca} label="MCA" />
            <ScoreBadge score={metrics.scores.nsf} label="NSF" />
            <ScoreBadge score={metrics.scores.cashFlow} label="Cash Flow" />
          </div>

          {/* Validation Warnings */}
          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="mt-4 space-y-2">
              {validation.errors.map((error, idx) => (
                <div key={`err-${idx}`} className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
              {validation.warnings.map((warning, idx) => (
                <div key={`warn-${idx}`} className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* MCA Stacking Alerts */}
          {stackingAlerts.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide">MCA Stacking Alerts</h4>
              {stackingAlerts.map((alert, idx) => (
                <div
                  key={`stack-${idx}`}
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    alert.severity === 'HIGH'
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : alert.severity === 'MEDIUM'
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                      : 'bg-blue-50 border border-blue-200 text-blue-700'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{alert.type}:</span> {alert.message}
                    <span className="ml-2 text-xs text-gray-500">
                      ({new Date(alert.date).toLocaleDateString()})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5-Tab Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-1">
            <TrendingDown className="h-4 w-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="mca" className="flex items-center gap-1">
            <CreditCard className="h-4 w-4" />
            MCA
          </TabsTrigger>
          <TabsTrigger value="nsf" className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            NSF/OD
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-4">
            {/* Key Metrics Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Key Metrics Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow
                  label="Total Revenue"
                  value={formatCurrency(metrics.totalRevenue)}
                  sparklineData={monthlyRevenueData}
                  highlight="good"
                  trend={metrics.cashFlow.trend === 'IMPROVING' ? 'up' : metrics.cashFlow.trend === 'DECLINING' ? 'down' : undefined}
                />
                <MetricRow
                  label="Total Expenses"
                  value={formatCurrency(metrics.totalExpenses)}
                  sparklineData={monthlyExpenseData}
                  highlight={metrics.totalExpenses > metrics.totalRevenue ? 'bad' : 'neutral'}
                />
                <MetricRow
                  label="Net Cash Flow"
                  value={formatCurrency(metrics.netCashFlow)}
                  sparklineData={monthlyCashFlowData}
                  highlight={metrics.netCashFlow > 0 ? 'good' : 'bad'}
                />
                <MetricRow
                  label="Avg Monthly Revenue"
                  value={formatCurrency(metrics.avgMonthlyRevenue)}
                  highlight="good"
                />
                <MetricRow
                  label="Avg Daily Balance"
                  value={formatCurrency(metrics.cashFlow.avgDailyBalance)}
                  highlight={metrics.cashFlow.avgDailyBalance > 5000 ? 'good' : metrics.cashFlow.avgDailyBalance > 0 ? 'warning' : 'bad'}
                />
              </CardContent>
            </Card>

            {/* Risk Indicators */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Risk Indicators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow
                  label="Active MCAs"
                  value={metrics.mca.uniqueMCACount}
                  highlight={metrics.mca.uniqueMCACount === 0 ? 'good' : metrics.mca.uniqueMCACount <= 2 ? 'warning' : 'bad'}
                />
                <MetricRow
                  label="MCA Stacking"
                  value={metrics.mca.stackingIndicator}
                  highlight={metrics.mca.stackingIndicator === 'NONE' ? 'good' : metrics.mca.stackingIndicator === 'LOW' ? 'warning' : 'bad'}
                />
                <MetricRow
                  label="NSF Count"
                  value={metrics.nsf.count}
                  sparklineData={monthlyNSFData}
                  highlight={metrics.nsf.count === 0 ? 'good' : metrics.nsf.count <= 3 ? 'warning' : 'bad'}
                />
                <MetricRow
                  label="Negative Balance Days"
                  value={`${metrics.nsf.negativeBalanceDays} days`}
                  highlight={metrics.nsf.negativeBalanceDays === 0 ? 'good' : metrics.nsf.negativeBalanceDays <= 5 ? 'warning' : 'bad'}
                />
                <MetricRow
                  label="MCA Payment Ratio"
                  value={formatPercent(metrics.mca.paymentToRevenueRatio)}
                  highlight={metrics.mca.paymentToRevenueRatio < 0.15 ? 'good' : metrics.mca.paymentToRevenueRatio < 0.25 ? 'warning' : 'bad'}
                />
              </CardContent>
            </Card>

            {/* Monthly Comparison Chart */}
            <Card className="col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Monthly Revenue vs Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.monthlyData.map(m => ({
                      month: m.month,
                      Revenue: m.revenue.total,
                      Expenses: m.expenses.total,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                      <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* REVENUE Tab */}
        <TabsContent value="revenue">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Revenue Breakdown
                  </span>
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    {formatCurrency(metrics.revenue.total)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <MetricRow
                    label="Regular Revenue"
                    value={formatCurrency(metrics.revenue.regularRevenue)}
                    highlight={metrics.revenue.regularRevenue > 0 ? 'good' : 'neutral'}
                  />
                  <MetricRow
                    label="Credit Card Sales"
                    value={formatCurrency(metrics.revenue.creditCardSales)}
                    highlight={metrics.revenue.creditCardSales > 0 ? 'good' : 'neutral'}
                  />
                  <MetricRow
                    label="ACH Deposits"
                    value={formatCurrency(metrics.revenue.achDeposits)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Check Deposits"
                    value={formatCurrency(metrics.revenue.checkDeposits)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Wire Transfers"
                    value={formatCurrency(metrics.revenue.wireTransfers)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="MCA Funding Received"
                    value={formatCurrency(metrics.revenue.mcaFunding)}
                    highlight={metrics.revenue.mcaFunding > 0 ? 'warning' : 'neutral'}
                  />
                  <MetricRow
                    label="Loan Proceeds"
                    value={formatCurrency(metrics.revenue.loanProceeds)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Refunds Received"
                    value={formatCurrency(metrics.revenue.refundsReceived)}
                    highlight="neutral"
                  />
                  {/* DDV-specific revenue categories */}
                  {metrics.revenue.zelleIncome > 0 && (
                    <MetricRow
                      label="Zelle Income"
                      value={formatCurrency(metrics.revenue.zelleIncome)}
                      highlight="good"
                    />
                  )}
                  {metrics.revenue.statePayments > 0 && (
                    <MetricRow
                      label="State Payments"
                      value={formatCurrency(metrics.revenue.statePayments)}
                      highlight="good"
                    />
                  )}
                  {metrics.revenue.counselingRevenue > 0 && (
                    <MetricRow
                      label="Counseling Revenue"
                      value={formatCurrency(metrics.revenue.counselingRevenue)}
                      highlight="good"
                    />
                  )}
                  {metrics.revenue.unassignedIncome > 0 && (
                    <MetricRow
                      label="Unassigned Income"
                      value={formatCurrency(metrics.revenue.unassignedIncome)}
                      highlight="warning"
                    />
                  )}
                  <MetricRow
                    label="Other Revenue"
                    value={formatCurrency(metrics.revenue.otherRevenue)}
                    highlight="neutral"
                  />
                  <div className="pt-3 mt-3 border-t-2 border-green-200">
                    <MetricRow
                      label="Total Revenue"
                      value={formatCurrency(metrics.revenue.total)}
                      sparklineData={monthlyRevenueData}
                      highlight="good"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyBreakdownChart data={metrics.monthlyData} type="revenue" />

                {/* Monthly Details */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase">Monthly Details</h4>
                  {metrics.monthlyData.map((m) => (
                    <div key={m.month} className="flex justify-between text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-600">{m.month}</span>
                      <span className="font-medium text-green-600">{formatCurrency(m.revenue.total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* EXPENSES Tab */}
        <TabsContent value="expenses">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    Expense Breakdown
                  </span>
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    {formatCurrency(metrics.expenses.total)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <MetricRow
                    label="Recurring (Rent, Utilities)"
                    value={formatCurrency(metrics.expenses.recurring)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Payroll"
                    value={formatCurrency(metrics.expenses.payroll)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Vendor Payments"
                    value={formatCurrency(metrics.expenses.vendorPayments)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Owner Draws"
                    value={formatCurrency(metrics.expenses.ownerDraws)}
                    highlight={metrics.expenses.ownerDraws > metrics.totalRevenue * 0.25 ? 'warning' : 'neutral'}
                  />
                  <MetricRow
                    label="COGS"
                    value={formatCurrency(metrics.expenses.cogs)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Marketing"
                    value={formatCurrency(metrics.expenses.marketing)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Professional Services"
                    value={formatCurrency(metrics.expenses.professionalServices)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Insurance"
                    value={formatCurrency(metrics.expenses.insurance)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Taxes"
                    value={formatCurrency(metrics.expenses.taxes)}
                    highlight="neutral"
                  />
                  <MetricRow
                    label="Bank Fees"
                    value={formatCurrency(metrics.expenses.bankFees)}
                    highlight={metrics.expenses.bankFees > 500 ? 'warning' : 'neutral'}
                  />
                  {/* DDV-specific expense categories */}
                  {metrics.expenses.settlement > 0 && (
                    <MetricRow
                      label="Settlement"
                      value={formatCurrency(metrics.expenses.settlement)}
                      highlight="warning"
                    />
                  )}
                  {metrics.expenses.softwareSubscriptions > 0 && (
                    <MetricRow
                      label="Software & Subscriptions"
                      value={formatCurrency(metrics.expenses.softwareSubscriptions)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.travelEntertainment > 0 && (
                    <MetricRow
                      label="Travel & Entertainment"
                      value={formatCurrency(metrics.expenses.travelEntertainment)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.utilities > 0 && (
                    <MetricRow
                      label="Utilities"
                      value={formatCurrency(metrics.expenses.utilities)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.rent > 0 && (
                    <MetricRow
                      label="Rent"
                      value={formatCurrency(metrics.expenses.rent)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.personalExpenses > 0 && (
                    <MetricRow
                      label="Personal Expenses"
                      value={formatCurrency(metrics.expenses.personalExpenses)}
                      highlight={metrics.expenses.personalExpenses > metrics.totalRevenue * 0.15 ? 'warning' : 'neutral'}
                    />
                  )}
                  {metrics.expenses.businessExpenses > 0 && (
                    <MetricRow
                      label="Business Expenses"
                      value={formatCurrency(metrics.expenses.businessExpenses)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.zellePayments > 0 && (
                    <MetricRow
                      label="Zelle Payments"
                      value={formatCurrency(metrics.expenses.zellePayments)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.creditCardPayments > 0 && (
                    <MetricRow
                      label="Credit Card Payments"
                      value={formatCurrency(metrics.expenses.creditCardPayments)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.atmWithdrawals > 0 && (
                    <MetricRow
                      label="ATM Withdrawals"
                      value={formatCurrency(metrics.expenses.atmWithdrawals)}
                      highlight="neutral"
                    />
                  )}
                  {metrics.expenses.nsfFees > 0 && (
                    <MetricRow
                      label="NSF/Overdraft Fees"
                      value={formatCurrency(metrics.expenses.nsfFees)}
                      highlight="bad"
                    />
                  )}
                  {metrics.expenses.unassignedExpenses > 0 && (
                    <MetricRow
                      label="Unassigned Expenses"
                      value={formatCurrency(metrics.expenses.unassignedExpenses)}
                      highlight="warning"
                    />
                  )}
                  <MetricRow
                    label="Other Expenses"
                    value={formatCurrency(metrics.expenses.otherExpenses)}
                    highlight="neutral"
                  />
                  <div className="pt-3 mt-3 border-t-2 border-red-200">
                    <MetricRow
                      label="Total Expenses"
                      value={formatCurrency(metrics.expenses.total)}
                      sparklineData={monthlyExpenseData}
                      highlight={metrics.expenses.total > metrics.revenue.total ? 'bad' : 'neutral'}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Expense Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyBreakdownChart data={metrics.monthlyData} type="expenses" />

                {/* Monthly Details */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase">Monthly Details</h4>
                  {metrics.monthlyData.map((m) => (
                    <div key={m.month} className="flex justify-between text-sm py-1 border-b border-gray-100">
                      <span className="text-gray-600">{m.month}</span>
                      <span className="font-medium text-red-600">{formatCurrency(m.expenses.total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MCA Tab */}
        <TabsContent value="mca">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-yellow-500" />
                  MCA Position Analysis
                </span>
                <Badge
                  variant="outline"
                  className={
                    metrics.mca.uniqueMCACount === 0
                      ? 'text-green-600 border-green-200 bg-green-50'
                      : metrics.mca.uniqueMCACount <= 2
                      ? 'text-yellow-600 border-yellow-200 bg-yellow-50'
                      : 'text-red-600 border-red-200 bg-red-50'
                  }
                >
                  {metrics.mca.uniqueMCACount} Active MCA{metrics.mca.uniqueMCACount !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* Position Metrics */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">
                    Position Metrics
                  </h4>
                  <div className="space-y-1">
                    <MetricRow
                      label="Total MCA Count"
                      value={metrics.mca.uniqueMCACount}
                      highlight={metrics.mca.uniqueMCACount === 0 ? 'good' : metrics.mca.uniqueMCACount <= 2 ? 'warning' : 'bad'}
                    />
                    <MetricRow
                      label="Daily Repayment (Avg)"
                      value={formatCurrency(metrics.mca.dailyPaymentAvg)}
                      sparklineData={monthlyMCAData}
                      highlight={metrics.mca.dailyPaymentAvg === 0 ? 'good' : 'warning'}
                    />
                    <MetricRow
                      label="Monthly Repayment"
                      value={formatCurrency(metrics.mca.monthlyRepayment)}
                      highlight={metrics.mca.monthlyRepayment > metrics.avgMonthlyRevenue * 0.25 ? 'bad' : 'neutral'}
                    />
                    <MetricRow
                      label="Total Paid (Period)"
                      value={formatCurrency(metrics.mca.paymentsTotal)}
                      highlight="neutral"
                    />
                    <MetricRow
                      label="Total MCA Funding Received"
                      value={formatCurrency(metrics.mca.fundingReceived)}
                      highlight={metrics.mca.fundingReceived > 0 ? 'warning' : 'neutral'}
                    />
                  </div>
                </div>

                {/* Stacking Analysis */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">
                    Stacking Analysis
                  </h4>
                  <div className="space-y-1">
                    <MetricRow
                      label="Stacking Indicator"
                      value={metrics.mca.stackingIndicator}
                      highlight={
                        metrics.mca.stackingIndicator === 'NONE' ? 'good' :
                        metrics.mca.stackingIndicator === 'LOW' ? 'warning' : 'bad'
                      }
                    />
                    <MetricRow
                      label="Payment to Revenue Ratio"
                      value={formatPercent(metrics.mca.paymentToRevenueRatio)}
                      highlight={
                        metrics.mca.paymentToRevenueRatio < 0.15 ? 'good' :
                        metrics.mca.paymentToRevenueRatio < 0.25 ? 'warning' : 'bad'
                      }
                    />
                    <MetricRow
                      label="Payment Count (Period)"
                      value={metrics.mca.paymentCount}
                      highlight="neutral"
                    />
                    {metrics.mca.mcaDetails && metrics.mca.mcaDetails.length > 0 && (
                      <div className="pt-3 mt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">MCA Merchants Detected:</p>
                        <div className="flex flex-wrap gap-1">
                          {metrics.mca.mcaDetails.map((detail) => (
                            <Badge key={detail.name} variant="secondary" className="text-xs">
                              {detail.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MCA Merchant Details Table */}
              {metrics.mca.mcaDetails && metrics.mca.mcaDetails.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">
                    MCA Merchant Breakdown
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 font-medium text-gray-600">Merchant</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Funding Received</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Total Payments</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Payment Count</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-600">Daily Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.mca.mcaDetails.map((detail, idx) => (
                          <tr key={detail.name} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="py-2 px-2">
                              <Badge variant="outline" className="font-medium">
                                {detail.name}
                              </Badge>
                            </td>
                            <td className="text-right py-2 px-2 text-green-600">
                              {detail.fundingReceived > 0 ? formatCurrency(detail.fundingReceived) : '-'}
                            </td>
                            <td className="text-right py-2 px-2 text-yellow-600 font-medium">
                              {formatCurrency(detail.paymentsTotal)}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-600">
                              {detail.paymentCount}
                            </td>
                            <td className="text-right py-2 px-2 text-gray-600">
                              {formatCurrency(detail.dailyPaymentAvg)}
                            </td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                          <td className="py-2 px-2 text-gray-700">TOTAL</td>
                          <td className="text-right py-2 px-2 text-green-700">
                            {formatCurrency(metrics.mca.fundingReceived)}
                          </td>
                          <td className="text-right py-2 px-2 text-yellow-700">
                            {formatCurrency(metrics.mca.paymentsTotal)}
                          </td>
                          <td className="text-right py-2 px-2 text-gray-700">
                            {metrics.mca.paymentCount}
                          </td>
                          <td className="text-right py-2 px-2 text-gray-700">
                            {formatCurrency(metrics.mca.dailyPaymentAvg)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Monthly MCA Payments */}
              {metrics.mca.paymentCount > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">
                    Monthly MCA Payments
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    {metrics.monthlyData.map((m) => (
                      <div key={m.month} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700">{m.month}</p>
                        <p className="text-lg font-semibold text-yellow-600">
                          {formatCurrency(m.mca.paymentsTotal)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {m.mca.paymentCount} payments
                        </p>
                        {/* Show MCA names for this month if available */}
                        {m.mca.mcaDetails && m.mca.mcaDetails.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {m.mca.mcaDetails.map((d) => (
                              <span key={d.name} className="text-xs text-gray-400">
                                {d.name}: {formatCurrency(d.paymentsTotal)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NSF/OVERDRAFT Tab */}
        <TabsContent value="nsf">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  NSF / Overdraft Analysis
                </span>
                <Badge
                  variant="outline"
                  className={
                    metrics.nsf.count === 0
                      ? 'text-green-600 border-green-200 bg-green-50'
                      : metrics.nsf.count <= 3
                      ? 'text-yellow-600 border-yellow-200 bg-yellow-50'
                      : 'text-red-600 border-red-200 bg-red-50'
                  }
                >
                  {metrics.nsf.count} Events
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* NSF Metrics */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">
                    NSF Metrics
                  </h4>
                  <div className="space-y-1">
                    <MetricRow
                      label="Total NSF Count"
                      value={metrics.nsf.count}
                      sparklineData={monthlyNSFData}
                      highlight={metrics.nsf.count === 0 ? 'good' : metrics.nsf.count <= 3 ? 'warning' : 'bad'}
                    />
                    <MetricRow
                      label="Total NSF Fees"
                      value={formatCurrency(metrics.nsf.totalFees)}
                      highlight={metrics.nsf.totalFees === 0 ? 'good' : 'bad'}
                    />
                    <MetricRow
                      label="Avg Fee Amount"
                      value={formatCurrency(metrics.nsf.avgFee)}
                      highlight="neutral"
                    />
                    <MetricRow
                      label="NSF Frequency"
                      value={`${metrics.nsf.frequency.toFixed(1)} per month`}
                      highlight={metrics.nsf.frequency === 0 ? 'good' : metrics.nsf.frequency <= 1 ? 'warning' : 'bad'}
                    />
                    <MetricRow
                      label="NSF Trend"
                      value={metrics.nsf.trend}
                      highlight={metrics.nsf.trend === 'IMPROVING' ? 'good' : metrics.nsf.trend === 'STABLE' ? 'neutral' : 'bad'}
                    />
                  </div>
                </div>

                {/* Balance Health */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">
                    Balance Health
                  </h4>
                  <div className="space-y-1">
                    <MetricRow
                      label="Negative Balance Days"
                      value={`${metrics.nsf.negativeBalanceDays} days`}
                      highlight={metrics.nsf.negativeBalanceDays === 0 ? 'good' : metrics.nsf.negativeBalanceDays <= 5 ? 'warning' : 'bad'}
                    />
                    <MetricRow
                      label="Lowest Balance"
                      value={formatCurrency(metrics.nsf.lowestBalance)}
                      highlight={metrics.nsf.lowestBalance >= 0 ? 'good' : 'bad'}
                    />
                    <MetricRow
                      label="Min Balance (Period)"
                      value={formatCurrency(metrics.cashFlow.minBalance)}
                      highlight={metrics.cashFlow.minBalance >= 0 ? 'good' : 'bad'}
                    />
                    <MetricRow
                      label="Max Balance (Period)"
                      value={formatCurrency(metrics.cashFlow.maxBalance)}
                      highlight="neutral"
                    />
                    <MetricRow
                      label="Ending Balance"
                      value={formatCurrency(metrics.cashFlow.endingBalance)}
                      highlight={metrics.cashFlow.endingBalance > 5000 ? 'good' : metrics.cashFlow.endingBalance > 0 ? 'warning' : 'bad'}
                    />
                  </div>
                </div>
              </div>

              {/* Monthly NSF Breakdown */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">
                  Monthly NSF Breakdown
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  {metrics.monthlyData.map((m) => (
                    <div
                      key={m.month}
                      className={`p-3 rounded-lg ${
                        m.nsf.count === 0 ? 'bg-green-50' : m.nsf.count <= 2 ? 'bg-yellow-50' : 'bg-red-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-700">{m.month}</p>
                      <p className={`text-lg font-semibold ${
                        m.nsf.count === 0 ? 'text-green-600' : m.nsf.count <= 2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {m.nsf.count} NSF{m.nsf.count !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        Fees: {formatCurrency(m.nsf.totalFees)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {m.nsf.negativeBalanceDays} negative days
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
