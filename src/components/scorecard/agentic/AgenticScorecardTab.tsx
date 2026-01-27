'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AgenticScorecardHeader } from './AgenticScorecardHeader'
import { AgenticScorecardOverview } from './AgenticScorecardOverview'
import { AgenticAgentPanel } from './AgenticAgentPanel'
import type {
  FullAgenticScorecard,
  AgenticSubsectionType,
  DimensionAssessment,
  BaseAgenticScore,
} from '@/types/agenticScorecard'

interface AgenticScorecardTabProps {
  dealId: string
  transactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: 'CREDIT' | 'DEBIT'
    runningBalance: number
    category?: string | null
    subcategory?: string | null
  }>
}

const AGENT_CONFIG: Array<{
  section: AgenticSubsectionType
  label: string
  weight: number
}> = [
  { section: 'revenue-stability', label: 'Revenue Stability', weight: 20 },
  { section: 'revenue-durability', label: 'Revenue Durability', weight: 15 },
  { section: 'revenue-trend', label: 'Revenue Trend & Momentum', weight: 15 },
  { section: 'revenue-concentration', label: 'Revenue Concentration', weight: 15 },
  { section: 'revenue-sufficiency', label: 'Revenue Sufficiency', weight: 35 },
]

export function AgenticScorecardTab({ dealId, transactions }: AgenticScorecardTabProps) {
  const [scorecard, setScorecard] = useState<FullAgenticScorecard | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingSection, setLoadingSection] = useState<AgenticSubsectionType | null>(null)

  const generateScorecard = useCallback(async (sections?: AgenticSubsectionType[]) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/deals/${dealId}/agentic-scorecard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sections ? { sections } : {}),
      })

      if (!response.ok) {
        throw new Error('Failed to generate scorecard')
      }

      const data = await response.json()

      if (data.success && data.scorecard) {
        setScorecard(data.scorecard)
        toast.success('Agentic scorecard generated successfully')
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error generating scorecard:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate scorecard')
    } finally {
      setIsLoading(false)
    }
  }, [dealId])

  const regenerateSection = useCallback(async (section: AgenticSubsectionType) => {
    setLoadingSection(section)
    try {
      const response = await fetch(`/api/deals/${dealId}/agentic-scorecard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: section }),
      })

      if (!response.ok) {
        throw new Error('Failed to regenerate section')
      }

      const data = await response.json()

      if (data.success && data.scorecard) {
        // Merge the regenerated section with existing scorecard
        setScorecard((prev) => {
          if (!prev) return data.scorecard
          return {
            ...prev,
            ...data.scorecard,
            // Preserve other sections
            revenueStability: section === 'revenue-stability' ? data.scorecard.revenueStability : prev.revenueStability,
            revenueDurability: section === 'revenue-durability' ? data.scorecard.revenueDurability : prev.revenueDurability,
            revenueTrend: section === 'revenue-trend' ? data.scorecard.revenueTrend : prev.revenueTrend,
            revenueConcentration: section === 'revenue-concentration' ? data.scorecard.revenueConcentration : prev.revenueConcentration,
            revenueSufficiency: section === 'revenue-sufficiency' ? data.scorecard.revenueSufficiency : prev.revenueSufficiency,
            aggregatedScore: data.scorecard.aggregatedScore,
          }
        })
        toast.success(`${section} regenerated successfully`)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error regenerating section:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate section')
    } finally {
      setLoadingSection(null)
    }
  }, [dealId])

  const getAgentScore = (section: AgenticSubsectionType): (BaseAgenticScore & { dimensions: Record<string, DimensionAssessment> }) | undefined => {
    if (!scorecard) return undefined

    switch (section) {
      case 'revenue-stability':
        return scorecard.revenueStability as (BaseAgenticScore & { dimensions: Record<string, DimensionAssessment> }) | undefined
      case 'revenue-durability':
        return scorecard.revenueDurability as (BaseAgenticScore & { dimensions: Record<string, DimensionAssessment> }) | undefined
      case 'revenue-trend':
        return scorecard.revenueTrend as (BaseAgenticScore & { dimensions: Record<string, DimensionAssessment> }) | undefined
      case 'revenue-concentration':
        return scorecard.revenueConcentration as (BaseAgenticScore & { dimensions: Record<string, DimensionAssessment> }) | undefined
      case 'revenue-sufficiency':
        return scorecard.revenueSufficiency as (BaseAgenticScore & { dimensions: Record<string, DimensionAssessment> }) | undefined
      default:
        return undefined
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No transactions available for analysis.</p>
        <p className="text-sm">Upload bank statements to generate agentic scorecard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AgenticScorecardHeader
        scorecard={scorecard}
        isLoading={isLoading}
        onGenerate={() => generateScorecard()}
      />

      {/* Initial Loading State */}
      {isLoading && !scorecard && (
        <div className="flex items-center justify-center py-12 bg-white border rounded-lg">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Generating Agentic Scorecard...</p>
            <p className="text-sm text-gray-500 mt-1">
              Running 5 AI agents in parallel. This may take 30-60 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Overview */}
      {scorecard?.aggregatedScore && (
        <AgenticScorecardOverview scorecard={scorecard} />
      )}

      {/* Agent Panels */}
      {(scorecard || !isLoading) && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Agent Details</h3>
          {AGENT_CONFIG.map((agent) => (
            <AgenticAgentPanel
              key={agent.section}
              section={agent.section}
              label={agent.label}
              weight={agent.weight}
              score={getAgentScore(agent.section)}
              isLoading={isLoading || loadingSection === agent.section}
              onRegenerate={() => regenerateSection(agent.section)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
