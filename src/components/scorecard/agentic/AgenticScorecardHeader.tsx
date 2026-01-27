'use client'

import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { FullAgenticScorecard } from '@/types/agenticScorecard'

interface AgenticScorecardHeaderProps {
  scorecard?: FullAgenticScorecard
  isLoading: boolean
  onGenerate: () => void
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-600'
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100 border-green-300'
  if (score >= 60) return 'bg-yellow-100 border-yellow-300'
  if (score >= 40) return 'bg-orange-100 border-orange-300'
  return 'bg-red-100 border-red-300'
}

function getRecommendationConfig(recommendation: 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW') {
  switch (recommendation) {
    case 'APPROVE':
      return {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-300',
        label: 'Approve',
      }
    case 'DECLINE':
      return {
        icon: XCircle,
        color: 'bg-red-100 text-red-800 border-red-300',
        label: 'Decline',
      }
    case 'MANUAL_REVIEW':
      return {
        icon: AlertTriangle,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        label: 'Manual Review',
      }
  }
}

export function AgenticScorecardHeader({
  scorecard,
  isLoading,
  onGenerate,
}: AgenticScorecardHeaderProps) {
  const aggregatedScore = scorecard?.aggregatedScore
  const processingDetails = scorecard?.processingDetails

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Score Circle */}
          {aggregatedScore ? (
            <div
              className={`flex items-center justify-center w-24 h-24 rounded-full border-4 ${getScoreBgColor(aggregatedScore.weightedScore)}`}
            >
              <div className="text-center">
                <span className={`text-3xl font-bold ${getScoreColor(aggregatedScore.weightedScore)}`}>
                  {aggregatedScore.weightedScore}
                </span>
                <p className="text-xs text-gray-500">/ 100</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-24 h-24 rounded-full border-4 border-gray-200 bg-gray-50">
              <span className="text-gray-400 text-sm text-center">Not<br/>Generated</span>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-gray-900">Revenue Quality Assessment</h2>
            <p className="text-sm text-gray-500 mt-1">
              AI-powered analysis across 5 dimensions
            </p>

            {/* Recommendation Badge */}
            {aggregatedScore && (
              <div className="mt-3 flex items-center gap-2">
                {(() => {
                  const config = getRecommendationConfig(aggregatedScore.recommendation)
                  const Icon = config.icon
                  return (
                    <Badge className={`${config.color} border text-sm px-3 py-1`}>
                      <Icon className="h-4 w-4 mr-1" />
                      {config.label}
                    </Badge>
                  )
                })()}
                <span className="text-sm text-gray-600 max-w-md">
                  {aggregatedScore.recommendationReason}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={onGenerate}
            disabled={isLoading}
            className={aggregatedScore ? 'bg-gray-600 hover:bg-gray-700' : ''}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : aggregatedScore ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate All
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Analysis
              </>
            )}
          </Button>

          {/* Processing Status */}
          {processingDetails && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>
                {(processingDetails.totalProcessingTimeMs / 1000).toFixed(1)}s total
              </span>
              {processingDetails.agentsFailed.length > 0 && (
                <Badge variant="outline" className="text-xs text-orange-600">
                  {processingDetails.agentsFailed.length} failed
                </Badge>
              )}
            </div>
          )}

          {/* Status */}
          {scorecard && (
            <Badge
              variant="outline"
              className={
                scorecard.status === 'completed'
                  ? 'text-green-600'
                  : scorecard.status === 'partial'
                  ? 'text-yellow-600'
                  : scorecard.status === 'error'
                  ? 'text-red-600'
                  : 'text-blue-600'
              }
            >
              {scorecard.status === 'completed'
                ? 'All agents completed'
                : scorecard.status === 'partial'
                ? 'Partially completed'
                : scorecard.status === 'error'
                ? 'Error occurred'
                : 'Processing'}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
