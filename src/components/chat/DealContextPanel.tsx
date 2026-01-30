'use client'

import {
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Building2,
  Calendar,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  User
} from 'lucide-react'
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

            {/* Bank Accounts */}
            {context.analytics.bankAccounts && context.analytics.bankAccounts.count > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Bank Statements ({context.analytics.bankAccounts.count})
                </h4>
                <div className="bg-white rounded-lg border divide-y">
                  {context.analytics.bankAccounts.accounts.map((account, index) => (
                    <div key={index} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {account.bankName}
                        </span>
                        {account.accountNumberMasked && (
                          <span className="text-xs text-gray-400">
                            {account.accountNumberMasked}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 ml-6">
                        {account.accountType && (
                          <span>{account.accountType}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {account.statementPeriod.start && account.statementPeriod.end
                            ? `${new Date(account.statementPeriod.start).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} - ${new Date(account.statementPeriod.end).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`
                            : 'Period unknown'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 ml-6 mt-1">
                        {account.transactionCount} transactions
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Quality */}
            {context.analytics.dataQuality && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Data Quality
                </h4>
                <div className={cn(
                  'bg-white rounded-lg border p-3',
                  context.analytics.dataQuality.hasWarning && 'border-yellow-300 bg-yellow-50/50'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {context.analytics.dataQuality.hasWarning ? (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {context.analytics.dataQuality.categorizedPercentage}% Categorized
                      </span>
                    </div>
                    <FileCheck className="h-4 w-4 text-gray-400" />
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full flex">
                      <div
                        className="bg-green-500"
                        style={{
                          width: `${(context.analytics.dataQuality.highConfidence / context.analytics.dataQuality.totalTransactions) * 100}%`
                        }}
                      />
                      <div
                        className="bg-blue-400"
                        style={{
                          width: `${(context.analytics.dataQuality.mediumConfidence / context.analytics.dataQuality.totalTransactions) * 100}%`
                        }}
                      />
                      <div
                        className="bg-yellow-400"
                        style={{
                          width: `${(context.analytics.dataQuality.lowConfidence / context.analytics.dataQuality.totalTransactions) * 100}%`
                        }}
                      />
                      <div
                        className="bg-gray-300"
                        style={{
                          width: `${(context.analytics.dataQuality.unassigned / context.analytics.dataQuality.totalTransactions) * 100}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      High: {context.analytics.dataQuality.highConfidence}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      Medium: {context.analytics.dataQuality.mediumConfidence}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      Low: {context.analytics.dataQuality.lowConfidence}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      Uncat: {context.analytics.dataQuality.unassigned}
                    </div>
                  </div>

                  {context.analytics.dataQuality.hasWarning && context.analytics.dataQuality.warningMessage && (
                    <div className="mt-2 text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-1">
                      {context.analytics.dataQuality.warningMessage}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Underwriter Notes */}
            {context.analytics.workflow && context.analytics.workflow.notes.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Underwriter Notes ({context.analytics.workflow.notesCount})
                </h4>
                <div className="bg-white rounded-lg border divide-y max-h-48 overflow-y-auto">
                  {context.analytics.workflow.notes.slice(0, 5).map((note, index) => (
                    <div key={index} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs font-medium text-gray-700">{note.author}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 ml-5 line-clamp-2">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
                {context.analytics.workflow.notesCount > 5 && (
                  <button
                    className="w-full text-xs text-blue-600 hover:text-blue-700 mt-2 flex items-center justify-center gap-1"
                    onClick={() => onAskQuestion('What are all the underwriter notes for this deal?')}
                  >
                    <MessageSquare className="h-3 w-3" />
                    View all {context.analytics.workflow.notesCount} notes
                  </button>
                )}
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
