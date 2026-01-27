'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DimensionAssessmentCard } from './DimensionAssessmentCard'
import { AuditTrailSection } from './AuditTrailSection'
import type {
  BaseAgenticScore,
  DimensionAssessment,
  AgenticRedFlag,
  AgenticSubsectionType,
  AGENT_LABELS,
} from '@/types/agenticScorecard'

interface AgenticAgentPanelProps {
  section: AgenticSubsectionType
  label: string
  weight: number
  score?: BaseAgenticScore & { dimensions: Record<string, DimensionAssessment> }
  isLoading?: boolean
  onRegenerate?: () => void
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-600'
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100'
  if (score >= 60) return 'bg-yellow-100'
  if (score >= 40) return 'bg-orange-100'
  return 'bg-red-100'
}

function getRiskLabel(rating: 1 | 2 | 3 | 4 | 5): string {
  const labels = {
    1: 'Very Low Risk',
    2: 'Low Risk',
    3: 'Moderate Risk',
    4: 'High Risk',
    5: 'Very High Risk',
  }
  return labels[rating]
}

function getRiskColor(rating: 1 | 2 | 3 | 4 | 5): string {
  const colors = {
    1: 'bg-green-100 text-green-800',
    2: 'bg-green-50 text-green-700',
    3: 'bg-yellow-100 text-yellow-800',
    4: 'bg-orange-100 text-orange-800',
    5: 'bg-red-100 text-red-800',
  }
  return colors[rating]
}

function getSeverityIcon(severity: 'Low' | 'Moderate' | 'High') {
  switch (severity) {
    case 'High':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'Moderate':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'Low':
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

function getSeverityBadgeColor(severity: 'Low' | 'Moderate' | 'High'): string {
  switch (severity) {
    case 'High':
      return 'bg-red-100 text-red-800'
    case 'Moderate':
      return 'bg-yellow-100 text-yellow-800'
    case 'Low':
      return 'bg-blue-100 text-blue-800'
  }
}

export function AgenticAgentPanel({
  section,
  label,
  weight,
  score,
  isLoading,
  onRegenerate,
}: AgenticAgentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDimensions, setShowDimensions] = useState(false)

  const dimensions = score?.dimensions ? Object.values(score.dimensions) : []
  const redFlags = score?.redFlags || []
  const highSeverityFlags = redFlags.filter(rf => rf.severity === 'High')

  return (
    <Card className={`${score ? '' : 'opacity-60'}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
                <div>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <p className="text-xs text-gray-500">Weight: {weight}%</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {score && (
                  <>
                    {highSeverityFlags.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {highSeverityFlags.length} Critical
                      </Badge>
                    )}
                    <Badge className={getRiskColor(score.aggregation.riskRating)}>
                      {getRiskLabel(score.aggregation.riskRating)}
                    </Badge>
                    <Badge className={getConfidenceBadgeColor(score.confidence)}>
                      {score.confidence} Confidence
                    </Badge>
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-full ${getScoreBgColor(score.aggregation.finalScore)}`}
                    >
                      <span className={`text-xl font-bold ${getScoreColor(score.aggregation.finalScore)}`}>
                        {score.aggregation.finalScore}
                      </span>
                    </div>
                  </>
                )}
                {!score && !isLoading && (
                  <Badge variant="outline">Not Generated</Badge>
                )}
                {isLoading && (
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {score ? (
              <div className="space-y-4">
                {/* Overall Justification */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Overall Assessment</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {score.overallJustification}
                  </p>
                </div>

                {/* Score Breakdown */}
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Pre-deduction:</span>{' '}
                    <span className="font-medium">{score.aggregation.preDeductionScore}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Red Flag Deduction:</span>{' '}
                    <span className="font-medium text-red-600">
                      -{score.aggregation.redFlagDeduction}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Final Score:</span>{' '}
                    <span className={`font-bold ${getScoreColor(score.aggregation.finalScore)}`}>
                      {score.aggregation.finalScore}
                    </span>
                  </div>
                </div>

                {/* Red Flags */}
                {redFlags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Red Flags ({redFlags.length})
                    </h4>
                    <div className="space-y-2">
                      {redFlags.map((flag, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded border ${
                            flag.severity === 'High'
                              ? 'bg-red-50 border-red-200'
                              : flag.severity === 'Moderate'
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {getSeverityIcon(flag.severity)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{flag.description}</span>
                                <Badge className={`text-xs ${getSeverityBadgeColor(flag.severity)}`}>
                                  {flag.severity}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600">{flag.reason}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dimensions (Collapsible) */}
                <Collapsible open={showDimensions} onOpenChange={setShowDimensions}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      {showDimensions ? (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Hide Dimensions ({dimensions.length})
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-4 w-4 mr-2" />
                          Show Dimensions ({dimensions.length})
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-3">
                      {dimensions.map((dimension, index) => (
                        <DimensionAssessmentCard
                          key={dimension.name}
                          dimension={dimension}
                          index={index}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Audit Trail */}
                <AuditTrailSection auditTrail={score.auditTrail} />

                {/* Regenerate Button */}
                {onRegenerate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRegenerate()
                    }}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>No data available for this agent.</p>
                {onRegenerate && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={onRegenerate}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Generate
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function getConfidenceBadgeColor(confidence: 'High' | 'Medium' | 'Low'): string {
  switch (confidence) {
    case 'High':
      return 'bg-green-50 text-green-700'
    case 'Medium':
      return 'bg-yellow-50 text-yellow-700'
    case 'Low':
      return 'bg-red-50 text-red-700'
  }
}
