'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
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
  getSubsectionDetails,
  type ScorecardInput,
  type OverallSummary,
  type SubsectionDetail,
} from '@/utils/calculations/overallScorecard'
import type {
  OverallScorecard as OverallScorecardType,
  SectionScore,
  SubsectionScore,
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
// SUBSECTION DETAIL COMPONENTS
// ============================================================================

function SubsectionDetailCard({ subsection }: { subsection: SubsectionDetail }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`border rounded-lg mb-2 ${getRatingBg(subsection.rating)}`}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-gray-50/50">
            <div className="flex items-center gap-3">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-medium">{subsection.name}</span>
              <Badge variant="outline" className="text-xs">
                {subsection.weight}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {subsection.redFlags.length > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                  {subsection.redFlags.length} flag{subsection.redFlags.length !== 1 ? 's' : ''}
                </Badge>
              )}
              <span className={`font-bold ${getScoreColor(subsection.score)}`}>
                {subsection.score}
              </span>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t">
            {/* Metrics Table */}
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Metrics</h4>
              <div className="space-y-2">
                {subsection.metrics.map((metric, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{metric.name}</span>
                      <span className="text-xs text-gray-400">({metric.weight})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{metric.formattedValue}</span>
                      {metric.interpretation && (
                        <span className="text-xs text-gray-500 ml-2">({metric.interpretation})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Red Flags */}
            {subsection.redFlags.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-semibold text-red-600 uppercase mb-2">Red Flags</h4>
                <div className="space-y-2">
                  {subsection.redFlags.map((flag, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-sm ${
                        flag.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        flag.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                        flag.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">{flag.type}</span>
                          <Badge variant="outline" className="text-xs">
                            {flag.severity}
                          </Badge>
                        </div>
                        <span className="text-xs">-{flag.pointsDeducted} pts</span>
                      </div>
                      <p className="mt-1 text-xs">{flag.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ============================================================================
// SECTION TAB CONTENT
// ============================================================================

function SectionTabContent({
  scorecard,
  sectionKey,
}: {
  scorecard: OverallScorecardType
  sectionKey: 'revenueQuality' | 'expenseQuality' | 'existingDebtImpact' | 'cashflowCharges'
}) {
  const section = scorecard.sections[sectionKey]
  const subsectionDetails = getSubsectionDetails(section)

  const sectionDescriptions: Record<string, string> = {
    revenueQuality: 'Analyzes income stability, growth patterns, revenue concentration, and business sustainability.',
    expenseQuality: 'Evaluates expense management, cost control, and operational efficiency.',
    existingDebtImpact: 'Assesses MCA positions, stacking risk, debt burden, and repayment patterns.',
    cashflowCharges: 'Reviews NSF/overdraft events, balance health, and liquidity management.',
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">{section.name}</h3>
              <p className="text-sm text-gray-600">{sectionDescriptions[sectionKey]}</p>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getScoreColor(section.score)}`}>
                {section.score}
              </div>
              <Badge variant="outline" className={`${getRatingBg(section.rating)} ${getRatingColor(section.rating)}`}>
                {['', 'Critical', 'Poor', 'Fair', 'Good', 'Excellent'][section.rating]}
              </Badge>
            </div>
          </div>

          {/* Score Distribution Bar */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                section.score >= 75 ? 'bg-green-500' :
                section.score >= 60 ? 'bg-blue-500' :
                section.score >= 45 ? 'bg-yellow-500' :
                section.score >= 30 ? 'bg-orange-500' :
                'bg-red-500'
              }`}
              style={{ width: `${section.score}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Subsections */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subsection Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {subsectionDetails.map((sub, idx) => (
            <SubsectionDetailCard key={idx} subsection={sub} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
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
  const [activeSection, setActiveSection] = useState<'revenueQuality' | 'expenseQuality' | 'existingDebtImpact' | 'cashflowCharges'>('revenueQuality')

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

          {/* Critical Issues Alert */}
          {summary.criticalIssues.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                Critical Issues ({summary.criticalIssues.length})
              </h4>
              <ul className="text-sm text-red-600 space-y-1">
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

      {/* 4 Section Score Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {(Object.entries(summary.sections) as [string, typeof summary.sections[0]][]).map(([key, section]) => (
          <SectionScoreCard
            key={key}
            section={section}
            icon={sectionIcons[key as keyof typeof sectionIcons]}
            isActive={activeSection === key}
            onClick={() => setActiveSection(key as typeof activeSection)}
            href={dealId ? `/deals/${dealId}/scorecard/${SECTION_SLUGS[key]}` : undefined}
          />
        ))}
      </div>

      {/* Section Detail Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as typeof activeSection)}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="revenueQuality" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="expenseQuality" className="flex items-center gap-1">
            <Wallet className="h-4 w-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="existingDebtImpact" className="flex items-center gap-1">
            <CreditCard className="h-4 w-4" />
            Debt
          </TabsTrigger>
          <TabsTrigger value="cashflowCharges" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Cash Flow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenueQuality">
          <SectionTabContent scorecard={scorecard} sectionKey="revenueQuality" />
        </TabsContent>

        <TabsContent value="expenseQuality">
          <SectionTabContent scorecard={scorecard} sectionKey="expenseQuality" />
        </TabsContent>

        <TabsContent value="existingDebtImpact">
          <SectionTabContent scorecard={scorecard} sectionKey="existingDebtImpact" />
        </TabsContent>

        <TabsContent value="cashflowCharges">
          <SectionTabContent scorecard={scorecard} sectionKey="cashflowCharges" />
        </TabsContent>
      </Tabs>

      {/* MCA Stacking Alerts (if any) */}
      {stackingAlerts.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              MCA Stacking Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
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
          </CardContent>
        </Card>
      )}

      {/* Key Financial Summary */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(metrics.totalRevenue)}</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(metrics.totalExpenses)}</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Net Cash Flow</p>
              <p className={`text-lg font-bold ${metrics.netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.netCashFlow)}
              </p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">MCA Payments</p>
              <p className="text-lg font-bold text-yellow-600">{formatCurrency(metrics.mca.paymentsTotal)}</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">NSF Events</p>
              <p className={`text-lg font-bold ${metrics.nsf.count === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.nsf.count}
              </p>
            </div>
          </div>

          {/* Monthly Revenue vs Expenses Chart */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Monthly Revenue vs Expenses</h4>
            <div className="h-48">
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
