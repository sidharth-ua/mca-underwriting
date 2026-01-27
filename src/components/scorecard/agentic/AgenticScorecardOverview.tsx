'use client'

import { AlertCircle, CheckCircle, TrendingUp, Target, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { FullAgenticScorecard, AgenticSubsectionType } from '@/types/agenticScorecard'

interface AgenticScorecardOverviewProps {
  scorecard: FullAgenticScorecard
}

const AGENT_ICONS: Record<AgenticSubsectionType, typeof TrendingUp> = {
  'revenue-stability': Target,
  'revenue-durability': Shield,
  'revenue-trend': TrendingUp,
  'revenue-concentration': Target,
  'revenue-sufficiency': CheckCircle,
}

const AGENT_LABELS: Record<AgenticSubsectionType, string> = {
  'revenue-stability': 'Stability',
  'revenue-durability': 'Durability',
  'revenue-trend': 'Trend',
  'revenue-concentration': 'Concentration',
  'revenue-sufficiency': 'Sufficiency',
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-600'
}

function getProgressColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

export function AgenticScorecardOverview({ scorecard }: AgenticScorecardOverviewProps) {
  const aggregatedScore = scorecard.aggregatedScore

  if (!aggregatedScore) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Agent Score Cards */}
      <div className="grid grid-cols-5 gap-3">
        {aggregatedScore.agentScores.map((agentScore) => {
          const Icon = AGENT_ICONS[agentScore.section]
          return (
            <Card key={agentScore.section} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">
                    {AGENT_LABELS[agentScore.section]}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${getScoreColor(agentScore.score)}`}>
                    {agentScore.score}
                  </span>
                  <span className="text-xs text-gray-400">/ 100</span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Weight: {agentScore.weight}%</span>
                    <span>+{agentScore.weightedContribution.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor(agentScore.score)} transition-all`}
                      style={{ width: `${agentScore.score}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Key Findings & Critical Concerns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Key Findings */}
        {aggregatedScore.keyFindings.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Key Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {aggregatedScore.keyFindings.map((finding, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-green-500 mt-1">+</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Critical Concerns */}
        {aggregatedScore.criticalConcerns.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Critical Concerns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {aggregatedScore.criticalConcerns.map((concern, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-red-500 mt-1">!</span>
                    <span>{concern}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Processing Errors (if any) */}
      {scorecard.processingDetails?.errors && scorecard.processingDetails.errors.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Processing Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {scorecard.processingDetails.errors.map((error, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <Badge variant="outline" className="text-xs text-orange-600">
                    {error.section}
                  </Badge>
                  <span>{error.error}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
