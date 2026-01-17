'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CreditCard,
  Banknote,
  Calendar,
  Activity,
  BarChart2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Info,
  AlertCircle,
  DollarSign,
  Wallet,
  Shield,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
  ReferenceLine,
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
  type DataQuality,
} from '@/utils/calculations/metricsCalculator'
import {
  calculateOverallScorecard,
  getOverallSummary,
  type ScorecardInput,
  type OverallSummary,
} from '@/utils/calculations/overallScorecard'
import type {
  OverallScorecard as OverallScorecardType,
} from '@/utils/calculations/scoringFramework'

interface ScorecardProps {
  transactions?: Transaction[]
  className?: string
  dealId?: string
}

// Section key to URL slug mapping
const SECTION_SLUGS: Record<string, string> = {
  revenueQuality: 'revenue-quality',
  expenseQuality: 'expense-quality',
  existingDebtImpact: 'existing-debt',
  cashflowCharges: 'cashflow-charges',
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

function getRatingColor(rating: number): string {
  if (rating >= 4) return 'text-green-600'
  if (rating >= 3) return 'text-yellow-600'
  return 'text-red-600'
}

function getRatingBg(rating: number): string {
  if (rating >= 4) return 'bg-green-50 border-green-200'
  if (rating >= 3) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 45) return 'text-yellow-600'
  if (score >= 30) return 'text-orange-600'
  return 'text-red-600'
}

function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-green-100 border-green-300'
  if (score >= 60) return 'bg-blue-100 border-blue-300'
  if (score >= 45) return 'bg-yellow-100 border-yellow-300'
  if (score >= 30) return 'bg-orange-100 border-orange-300'
  return 'bg-red-100 border-red-300'
}

function getRecommendationStyle(recommendation: string): { bg: string; text: string; border: string } {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    'APPROVE': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    'APPROVE WITH CONDITIONS': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'MANUAL REVIEW': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    'DECLINE SOFT': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    'DECLINE': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  }
  return styles[recommendation] || styles['MANUAL REVIEW']
}

// ============================================================================
// SCORE DISPLAY COMPONENTS
// ============================================================================

function OverallScoreDisplay({ summary }: { summary: OverallSummary }) {
  const style = getRecommendationStyle(summary.recommendation)

  return (
    <div className="flex items-center gap-6">
      {/* Score Circle */}
      <div className="relative">
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke={summary.score >= 75 ? '#22c55e' : summary.score >= 60 ? '#3b82f6' : summary.score >= 45 ? '#eab308' : summary.score >= 30 ? '#f97316' : '#ef4444'}
            strokeWidth="8"
            strokeDasharray={`${(summary.score / 100) * 352} 352`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(summary.score)}`}>
            {summary.score}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>

      {/* Recommendation & Rating */}
      <div className="flex-1">
        <div className={`inline-block px-4 py-2 rounded-lg border ${style.bg} ${style.text} ${style.border} mb-2`}>
          <span className="font-semibold text-lg">{summary.recommendation}</span>
        </div>
        <p className="text-sm text-gray-600">{summary.recommendationDescription}</p>
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <span>Rating: <strong className={getRatingColor(summary.rating)}>{summary.ratingLabel}</strong></span>
          <span>Period: {summary.periodRange}</span>
          <span>{summary.monthsAnalyzed} month{summary.monthsAnalyzed !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

function SectionScoreCard({
  section,
  icon,
  isActive,
  onClick,
  href,
}: {
  section: { name: string; score: number; rating: number; ratingLabel: string; weight: string; redFlagsCount: number }
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
  href?: string
}) {
  const cardContent = (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-blue-500' : ''}`}
      onClick={href ? undefined : onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-sm">{section.name}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {section.weight}
          </Badge>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <span className={`text-3xl font-bold ${getScoreColor(section.score)}`}>
              {section.score}
            </span>
            <span className="text-gray-400 text-lg">/100</span>
          </div>
          <div className="text-right">
            <Badge variant="outline" className={`${getRatingBg(section.rating)} ${getRatingColor(section.rating)}`}>
              {section.ratingLabel}
            </Badge>
            {section.redFlagsCount > 0 && (
              <div className="flex items-center justify-end gap-1 mt-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {section.redFlagsCount} flag{section.redFlagsCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Wrap in Link if href is provided
  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}


// ============================================================================
// DATA QUALITY INDICATOR
// ============================================================================

function DataQualityIndicator({ dataQuality }: { dataQuality: DataQuality }) {
  const getAccuracyColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAccuracyBg = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200'
    if (score >= 70) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getAccuracyIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (score >= 70) return <Info className="h-4 w-4 text-yellow-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  if (dataQuality.noQuality === dataQuality.totalTransactions) {
    return null
  }

  return (
    <div className={`p-3 rounded-lg border ${getAccuracyBg(dataQuality.accuracyScore)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
          {getAccuracyIcon(dataQuality.accuracyScore)}
          Data Quality
        </span>
        <span className={`text-lg font-bold ${getAccuracyColor(dataQuality.accuracyScore)}`}>
          {dataQuality.accuracyScore.toFixed(1)}%
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <p className="text-gray-500">High</p>
          <p className="font-semibold text-green-600">{dataQuality.highConfidence}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">Medium</p>
          <p className="font-semibold text-blue-600">{dataQuality.mediumConfidence}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">Low</p>
          <p className="font-semibold text-yellow-600">{dataQuality.lowConfidence}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">Unassigned</p>
          <p className="font-semibold text-red-600">{dataQuality.unassigned}</p>
        </div>
      </div>
      {dataQuality.hasAccuracyWarning && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
          <p className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            Accuracy concerns: review unassigned or low-confidence transactions
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN SCORECARD COMPONENT
// ============================================================================

export function Scorecard({ transactions, className, dealId }: ScorecardProps) {
  const [chartsExpanded, setChartsExpanded] = useState(false)

  // Calculate base metrics
  const metrics = useMemo(() => {
    if (!transactions || transactions.length === 0) return null
    return calculateAggregatedMetrics(transactions)
  }, [transactions])

  // Calculate the new 4-section scorecard
  const scorecard = useMemo((): OverallScorecardType | null => {
    if (!metrics || !transactions) return null
    try {
      return calculateOverallScorecard({ transactions, metrics })
    } catch (error) {
      console.error('Error calculating scorecard:', error)
      return null
    }
  }, [transactions, metrics])

  // Get summary for display
  const summary = useMemo((): OverallSummary | null => {
    if (!scorecard) return null
    return getOverallSummary(scorecard)
  }, [scorecard])

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

  // Empty state
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

  if (!metrics || !scorecard || !summary) {
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

  const sectionIcons = {
    revenueQuality: <TrendingUp className="h-5 w-5 text-green-500" />,
    expenseQuality: <Wallet className="h-5 w-5 text-red-500" />,
    existingDebtImpact: <CreditCard className="h-5 w-5 text-yellow-500" />,
    cashflowCharges: <Activity className="h-5 w-5 text-blue-500" />,
  }

  return (
    <div className={className}>
      {/* Header Card with Overall Score */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              MCA Underwriting Scorecard
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>{summary.periodRange}</span>
              </div>
              <Badge variant="outline">
                {summary.monthsAnalyzed} Month{summary.monthsAnalyzed > 1 ? 's' : ''} Analyzed
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Overall Score Display */}
          <OverallScoreDisplay summary={summary} />

          {/* Critical Issues Alert (includes MCA stacking alerts) */}
          {(summary.criticalIssues.length > 0 || stackingAlerts.length > 0) && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                Critical Issues ({summary.criticalIssues.length + stackingAlerts.length})
              </h4>
              <ul className="text-sm text-red-600 space-y-1">
                {/* MCA Stacking Alerts */}
                {stackingAlerts.map((alert, idx) => (
                  <li key={`stack-${idx}`} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
                    <span>
                      <strong>MCA Stacking:</strong> {alert.message}
                      <span className="text-red-400 text-xs ml-1">
                        ({new Date(alert.date).toLocaleDateString()})
                      </span>
                    </span>
                  </li>
                ))}
                {/* Other Critical Issues */}
                {summary.criticalIssues.slice(0, 5).map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-red-400">-</span>
                    {issue}
                  </li>
                ))}
                {summary.criticalIssues.length > 5 && (
                  <li className="text-red-400 text-xs">
                    + {summary.criticalIssues.length - 5} more issues
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Data Quality Indicator */}
          {metrics.dataQuality && (
            <div className="mt-4">
              <DataQualityIndicator dataQuality={metrics.dataQuality} />
            </div>
          )}

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
        </CardContent>
      </Card>

      {/* 4 Section Score Cards - Click to view details */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {Object.entries(scorecard.sections).map(([key, sectionData]) => {
          const sectionSummary = summary.sections.find(s => s.name === sectionData.name)
          if (!sectionSummary) return null
          return (
            <SectionScoreCard
              key={key}
              section={sectionSummary}
              icon={sectionIcons[key as keyof typeof sectionIcons]}
              isActive={false}
              onClick={() => {}}
              href={dealId ? `/deals/${dealId}/scorecard/${SECTION_SLUGS[key]}` : undefined}
            />
          )
        })}
      </div>

      {/* Key Financial Metrics */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            Key Financial Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3">
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(metrics.totalRevenue)}</p>
              <p className="text-xs text-gray-400">{formatCurrency(metrics.avgMonthlyRevenue)}/mo</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(metrics.totalExpenses)}</p>
              <p className="text-xs text-gray-400">{formatCurrency(metrics.avgMonthlyExpenses)}/mo</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-gray-500 mb-1">Net Cash Flow</p>
              <p className={`text-lg font-bold ${metrics.netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.netCashFlow)}
              </p>
              <p className="text-xs text-gray-400">{((metrics.netCashFlow / metrics.totalRevenue) * 100).toFixed(1)}% margin</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <p className="text-xs text-gray-500 mb-1">MCA Payments</p>
              <p className="text-lg font-bold text-yellow-600">{formatCurrency(metrics.mca.paymentsTotal)}</p>
              <p className="text-xs text-gray-400">{((metrics.mca.paymentsTotal / metrics.totalRevenue) * 100).toFixed(1)}% of revenue</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-gray-500 mb-1">Avg Daily Balance</p>
              <p className={`text-lg font-bold ${metrics.cashFlow.avgDailyBalance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.cashFlow.avgDailyBalance)}
              </p>
              <p className="text-xs text-gray-400">Min: {formatCurrency(metrics.cashFlow.minBalance)}</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-xs text-gray-500 mb-1">NSF/Overdrafts</p>
              <p className={`text-lg font-bold ${metrics.nsf.count === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.nsf.count} events
              </p>
              <p className="text-xs text-gray-400">{metrics.nsf.negativeBalanceDays} negative days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Underwriter Visualization Dashboard - Collapsible */}
      <Card className="mt-4">
        <Collapsible open={chartsExpanded} onOpenChange={setChartsExpanded}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Trend Analysis Dashboard
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{chartsExpanded ? 'Hide Charts' : 'Show Charts'}</span>
                  {chartsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
          {/* Row 1: Monthly Ending Balance & Cash Flow Trend */}
          <div className="grid grid-cols-2 gap-4">
            {/* Monthly Ending Balance Trend */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-500" />
                Monthly Ending Balance Trend
              </h4>
              <div className="h-56 bg-gray-50 rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.monthlyData.map(m => ({
                    month: m.month,
                    endingBalance: m.cashFlow.endingBalance,
                    avgBalance: m.cashFlow.avgDailyBalance,
                    minBalance: m.cashFlow.minBalance,
                  }))}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={2} />
                    <Area
                      type="monotone"
                      dataKey="endingBalance"
                      stroke="#3b82f6"
                      fill="url(#balanceGradient)"
                      strokeWidth={2}
                      name="Ending Balance"
                    />
                    <Line
                      type="monotone"
                      dataKey="minBalance"
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      strokeWidth={1}
                      dot={false}
                      name="Min Balance"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Net Cash Flow */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Monthly Net Cash Flow
              </h4>
              <div className="h-56 bg-gray-50 rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={metrics.monthlyData.map(m => ({
                    month: m.month,
                    netCashFlow: m.revenue.total - m.expenses.total,
                    revenue: m.revenue.total,
                    expenses: m.expenses.total,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                    <Bar dataKey="netCashFlow" name="Net Cash Flow" radius={[4, 4, 0, 0]}>
                      {metrics.monthlyData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={(entry.revenue.total - entry.expenses.total) >= 0 ? '#22c55e' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Expenses"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Revenue Trend & MCA Burden Analysis */}
          <div className="grid grid-cols-2 gap-4">
            {/* Revenue Stability Trend */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Revenue Trend & Moving Average
              </h4>
              <div className="h-56 bg-gray-50 rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={metrics.monthlyData.map((m, idx, arr) => {
                    // Calculate 3-month moving average
                    const start = Math.max(0, idx - 2)
                    const slice = arr.slice(start, idx + 1)
                    const movingAvg = slice.reduce((sum, item) => sum + item.revenue.total, 0) / slice.length
                    return {
                      month: m.month,
                      revenue: m.revenue.total,
                      movingAvg: movingAvg,
                      avgLine: metrics.avgMonthlyRevenue,
                    }
                  })}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#22c55e"
                      fill="url(#revenueGradient)"
                      strokeWidth={2}
                      name="Monthly Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="movingAvg"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="3-Month Avg"
                    />
                    <ReferenceLine
                      y={metrics.avgMonthlyRevenue}
                      stroke="#9ca3af"
                      strokeDasharray="5 5"
                      label={{ value: 'Avg', position: 'right', fontSize: 10 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* MCA Burden Analysis */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-yellow-500" />
                MCA Payment Burden (% of Revenue)
              </h4>
              <div className="h-56 bg-gray-50 rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={metrics.monthlyData.map(m => ({
                    month: m.month,
                    mcaPayments: m.mca?.paymentsTotal || 0,
                    burdenRatio: m.revenue.total > 0 ? ((m.mca?.paymentsTotal || 0) / m.revenue.total) * 100 : 0,
                    revenue: m.revenue.total,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'burdenRatio') return `${Number(value).toFixed(1)}%`
                        return formatCurrency(Number(value) || 0)
                      }}
                      contentStyle={{ fontSize: 12 }}
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
                      dot={{ r: 4, fill: '#ef4444' }}
                      name="Burden %"
                    />
                    <ReferenceLine
                      yAxisId="right"
                      y={15}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{ value: '15% threshold', position: 'right', fontSize: 9 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Expense Analysis & NSF/Balance Health */}
          <div className="grid grid-cols-2 gap-4">
            {/* Expense Ratio Trend */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-red-500" />
                Expense Ratio Trend (Expenses / Revenue)
              </h4>
              <div className="h-56 bg-gray-50 rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={metrics.monthlyData.map(m => ({
                    month: m.month,
                    expenseRatio: m.revenue.total > 0 ? (m.expenses.total / m.revenue.total) * 100 : 0,
                    expenses: m.expenses.total,
                    revenue: m.revenue.total,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 120]}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'expenseRatio') return `${Number(value).toFixed(1)}%`
                        return formatCurrency(Number(value) || 0)
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Good (<70%)', position: 'right', fontSize: 9 }} />
                    <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warning (90%)', position: 'right', fontSize: 9 }} />
                    <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="expenseRatio"
                      stroke="#ef4444"
                      fill="#fecaca"
                      fillOpacity={0.5}
                      strokeWidth={2}
                      name="Expense Ratio %"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* NSF & Balance Health */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                NSF Events & Negative Balance Days
              </h4>
              <div className="h-56 bg-gray-50 rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={metrics.monthlyData.map(m => ({
                    month: m.month,
                    nsfCount: m.nsf?.count || 0,
                    negativeDays: m.nsf?.negativeBalanceDays || 0,
                    nsfFees: m.nsf?.totalFees || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'nsfFees') return formatCurrency(Number(value) || 0)
                        return `${value}`
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="nsfCount"
                      name="NSF Events"
                      radius={[4, 4, 0, 0]}
                    >
                      {metrics.monthlyData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={(entry.nsf?.count || 0) === 0 ? '#22c55e' : (entry.nsf?.count || 0) <= 2 ? '#f59e0b' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="negativeDays"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#8b5cf6' }}
                      name="Negative Days"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 4: Revenue vs Expenses Comparison */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              Monthly Revenue vs Expenses Comparison
            </h4>
            <div className="h-64 bg-gray-50 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.monthlyData.map(m => ({
                  month: m.month,
                  Revenue: m.revenue.total,
                  Expenses: m.expenses.total,
                  'Net Margin': m.revenue.total - m.expenses.total,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
