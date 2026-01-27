'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { DimensionAssessment } from '@/types/agenticScorecard'

interface DimensionAssessmentCardProps {
  dimension: DimensionAssessment
  index: number
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-600'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50'
  if (score >= 60) return 'bg-yellow-50'
  if (score >= 40) return 'bg-orange-50'
  return 'bg-red-50'
}

export function DimensionAssessmentCard({ dimension, index }: DimensionAssessmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={`border rounded-lg ${getScoreBg(dimension.score)}`}>
      <button
        className="w-full p-3 flex items-center justify-between text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-mono">{index + 1}.</span>
          <span className="font-medium text-gray-900">{dimension.name}</span>
          <Badge variant="outline" className="text-xs">
            {dimension.weight}%
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${getScoreColor(dimension.score)}`}>
            {dimension.score}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t bg-white/50">
          <div className="pt-3">
            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-1">
              Observed Patterns
            </h5>
            <p className="text-sm text-gray-700">{dimension.observedPatterns}</p>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-1">
              Implications
            </h5>
            <p className="text-sm text-gray-700">{dimension.implications}</p>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-1">
              Justification
            </h5>
            <p className="text-sm text-gray-700">{dimension.justification}</p>
          </div>
        </div>
      )}
    </div>
  )
}
