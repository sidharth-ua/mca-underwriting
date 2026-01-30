'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2
} from 'lucide-react'
import type { RevenueStabilityAgenticScore, DimensionAssessment, AgenticRedFlag } from '@/types/agenticScorecard'

interface AgenticScorePanelProps {
  dealId: string
  sectionType: 'revenue-stability' // Can expand for other sections
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 45) return 'text-yellow-600'
  if (score >= 30) return 'text-orange-600'
  return 'text-red-600'
}

function getScoreBgColor(score: number): string {
  if (score >= 75) return 'bg-green-100'
  if (score >= 60) return 'bg-blue-100'
  if (score >= 45) return 'bg-yellow-100'
  if (score >= 30) return 'bg-orange-100'
  return 'bg-red-100'
}

function getRiskRatingLabel(rating: number): string {
  switch (rating) {
    case 1: return 'Highly Stable'
    case 2: return 'Stable'
    case 3: return 'Moderate'
    case 4: return 'Unstable'
    case 5: return 'Highly Unstable'
    default: return 'Unknown'
  }
}

function getRiskRatingColor(rating: number): string {
  switch (rating) {
    case 1: return 'bg-green-500'
    case 2: return 'bg-green-400'
    case 3: return 'bg-yellow-500'
    case 4: return 'bg-orange-500'
    case 5: return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'High': return 'bg-red-100 text-red-800 border-red-200'
    case 'Moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Low': return 'bg-gray-100 text-gray-800 border-gray-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getConfidenceIcon(confidence: string) {
  switch (confidence) {
    case 'High': return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'Medium': return <Info className="h-4 w-4 text-yellow-500" />
    case 'Low': return <AlertTriangle className="h-4 w-4 text-red-500" />
    default: return <Info className="h-4 w-4 text-gray-500" />
  }
}

function DimensionCard({ dimension }: { dimension: DimensionAssessment }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg p-3 bg-white">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{dimension.name}</span>
            <Badge variant="outline" className="text-xs">
              {dimension.weight}% weight
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${getScoreColor(dimension.score)}`}>
            {dimension.score}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-600">Observed Patterns:</span>
            <p className="text-gray-700 mt-1">{dimension.observedPatterns}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Implications:</span>
            <p className="text-gray-700 mt-1">{dimension.implications}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Justification:</span>
            <p className="text-gray-700 mt-1">{dimension.justification}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function RedFlagCard({ flag }: { flag: AgenticRedFlag }) {
  return (
    <div className={`border rounded-lg p-3 ${getSeverityColor(flag.severity)}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{flag.description}</span>
            <Badge variant="outline" className="text-xs">
              {flag.severity}
            </Badge>
          </div>
          <p className="text-sm mt-1 opacity-90">{flag.reason}</p>
        </div>
      </div>
    </div>
  )
}

export function AgenticScorePanel({ dealId, sectionType }: AgenticScorePanelProps) {
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scorecard, setScorecard] = useState<RevenueStabilityAgenticScore | null>(null)
  const [dimensionsExpanded, setDimensionsExpanded] = useState(false)

  const fetchScorecard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/deals/${dealId}/agentic-scorecard?section=${sectionType}`)
      if (response.ok) {
        const data = await response.json()
        if (data.scorecard?.revenueStability) {
          setScorecard(data.scorecard.revenueStability)
        }
      }
    } catch (err) {
      console.error('Error fetching agentic scorecard:', err)
    } finally {
      setLoading(false)
    }
  }, [dealId, sectionType])

  const generateScorecard = async () => {
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch(`/api/deals/${dealId}/agentic-scorecard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionType })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate scorecard')
      }

      const data = await response.json()
      if (data.scorecard?.revenueStability) {
        setScorecard(data.scorecard.revenueStability)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate scorecard')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchScorecard()
  }, [fetchScorecard])

  // Loading state
  if (loading) {
    return (
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base text-purple-900">AI Assessment</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            <span className="ml-2 text-sm text-gray-600">Loading...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No scorecard yet - show generate button
  if (!scorecard) {
    return (
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base text-purple-900">AI Assessment</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Brain className="h-12 w-12 text-purple-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-4">
              Generate an AI-powered qualitative assessment of revenue stability
            </p>
            {error && (
              <p className="text-sm text-red-600 mb-4">{error}</p>
            )}
            <Button
              onClick={generateScorecard}
              disabled={generating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Generate AI Assessment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Display scorecard
  const dimensions = Object.values(scorecard.dimensions)

  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base text-purple-900">AI Assessment</CardTitle>
            <Badge variant="outline" className="text-xs bg-white">
              Revenue Stability
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generateScorecard}
            disabled={generating}
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-100"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score Display */}
        <div className="flex items-center gap-4">
          <div className={`text-center p-4 rounded-lg ${getScoreBgColor(scorecard.aggregation.finalScore)}`}>
            <div className={`text-3xl font-bold ${getScoreColor(scorecard.aggregation.finalScore)}`}>
              {scorecard.aggregation.finalScore}
            </div>
            <div className="text-xs text-gray-600">Final Score</div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Risk Rating:</span>
              <Badge className={`${getRiskRatingColor(scorecard.aggregation.riskRating)} text-white`}>
                {scorecard.aggregation.riskRating}/5 - {getRiskRatingLabel(scorecard.aggregation.riskRating)}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Confidence:</span>
              <div className="flex items-center gap-1">
                {getConfidenceIcon(scorecard.confidence)}
                <span className="text-sm">{scorecard.confidence}</span>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Pre-deduction: {scorecard.aggregation.preDeductionScore} |
              Red Flag Deduction: -{scorecard.aggregation.redFlagDeduction}
            </div>
          </div>
        </div>

        {/* Overall Justification */}
        <div className="bg-white rounded-lg p-3 border">
          <h4 className="font-medium text-sm text-gray-700 mb-1">Overall Assessment</h4>
          <p className="text-sm text-gray-600">{scorecard.overallJustification}</p>
        </div>

        {/* Red Flags */}
        {scorecard.redFlags.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Red Flags ({scorecard.redFlags.length})
            </h4>
            <div className="space-y-2">
              {scorecard.redFlags.map((flag, idx) => (
                <RedFlagCard key={idx} flag={flag} />
              ))}
            </div>
          </div>
        )}

        {/* Dimensions */}
        <div>
          <button
            className="flex items-center gap-2 font-medium text-sm text-gray-700 mb-2 hover:text-purple-600 transition-colors"
            onClick={() => setDimensionsExpanded(!dimensionsExpanded)}
          >
            {dimensionsExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Dimension Scores ({dimensions.length})
          </button>

          {dimensionsExpanded && (
            <div className="space-y-2">
              {dimensions.map((dim, idx) => (
                <DimensionCard key={idx} dimension={dim} />
              ))}
            </div>
          )}
        </div>

        {/* Confidence Justification */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          <strong>Confidence Note:</strong> {scorecard.confidenceJustification}
        </div>

        {/* Generated timestamp */}
        <div className="text-xs text-gray-400 text-right">
          Generated: {new Date(scorecard.generatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
