'use client'

import { Loader2, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ScoreGauge } from './ScoreGauge'
import { QuickStatsGrid } from './QuickStatsCard'
import { RedFlagsList } from './RedFlagsList'
import { MiniScorecard } from './MiniScorecard'
import type { DealChatContext } from '@/types/chat'

interface DealContextPanelProps {
  context: DealChatContext | null
  loading: boolean
  collapsed: boolean
  onToggle: () => void
  onAskQuestion: (question: string) => void
  className?: string
}

export function DealContextPanel({
  context,
  loading,
  collapsed,
  onToggle,
  onAskQuestion,
  className
}: DealContextPanelProps) {
  // Handle red flag click
  const handleFlagClick = (flag: { type: string; description: string }) => {
    onAskQuestion(`Tell me more about this risk: ${flag.description}`)
  }

  // Handle scorecard section click
  const handleSectionClick = (section: string) => {
    const sectionNames: Record<string, string> = {
      revenueQuality: 'revenue quality',
      expenseQuality: 'expense patterns',
      existingDebtImpact: 'debt impact',
      cashflowCharges: 'cashflow health'
    }
    onAskQuestion(`Explain the ${sectionNames[section] || section} score in detail`)
  }

  if (collapsed) {
    return (
      <div className={cn('border-l bg-gray-50 flex flex-col items-center py-4', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="mb-2"
          title="Expand panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('w-80 border-l bg-gray-50 flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <h3 className="font-semibold text-gray-900 text-sm">Deal Context</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
          title="Collapse panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <span className="text-sm">Loading deal context...</span>
          </div>
        ) : !context ? (
          <div className="text-center text-gray-500 text-sm py-8">
            Select a deal to view context
          </div>
        ) : (
          <>
            {/* Score Gauge */}
            {context.analytics.scorecard && (
              <ScoreGauge
                score={context.analytics.scorecard.overallScore}
                rating={context.analytics.scorecard.overallRating}
                recommendation={context.analytics.scorecard.recommendation}
              />
            )}

            {/* Quick Stats */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Key Metrics
              </h4>
              <QuickStatsGrid
                totalRevenue={context.analytics.totalRevenue}
                mcaDebt={context.analytics.mca.paymentsTotal}
                mcaCount={context.analytics.mca.uniqueMCACount}
                nsfCount={context.analytics.nsf.count}
                netCashFlow={context.analytics.netCashFlow}
              />
            </div>

            {/* Red Flags */}
            {context.analytics.scorecard?.redFlags && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Risk Indicators
                </h4>
                <RedFlagsList
                  flags={context.analytics.scorecard.redFlags.map(flag => ({
                    ...flag,
                    severity: flag.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
                  }))}
                  onFlagClick={handleFlagClick}
                />
              </div>
            )}

            {/* Mini Scorecard */}
            {context.analytics.scorecard?.sections && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Section Scores
                </h4>
                <div className="bg-white rounded-lg border p-3">
                  <MiniScorecard
                    sections={context.analytics.scorecard.sections}
                    onSectionClick={handleSectionClick}
                  />
                </div>
              </div>
            )}

            {/* MCA Details */}
            {context.analytics.mca.uniqueMCACount > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Active MCAs ({context.analytics.mca.uniqueMCACount})
                </h4>
                <div className="bg-white rounded-lg border p-3 space-y-1">
                  {context.analytics.mca.mcaNames.map((name, index) => (
                    <div key={index} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Period Info */}
            <div className="text-xs text-gray-500 text-center pt-2 border-t">
              Analysis period: {context.analytics.monthsAnalyzed} months
            </div>
          </>
        )}
      </div>
    </div>
  )
}
