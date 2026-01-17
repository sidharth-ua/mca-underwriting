'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SectionScore } from '@/utils/calculations/scoringFramework'

interface SectionHeaderProps {
  section: SectionScore
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e' // green
  if (score >= 60) return '#3b82f6' // blue
  if (score >= 45) return '#eab308' // yellow
  if (score >= 30) return '#f97316' // orange
  return '#ef4444' // red
}

function getScoreTextColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 45) return 'text-yellow-600'
  if (score >= 30) return 'text-orange-600'
  return 'text-red-600'
}

function getRatingLabel(rating: number): string {
  switch (rating) {
    case 5: return 'Excellent'
    case 4: return 'Good'
    case 3: return 'Fair'
    case 2: return 'Poor'
    case 1: return 'Critical'
    default: return 'Unknown'
  }
}

function getRatingBadgeStyle(rating: number): string {
  if (rating >= 4) return 'bg-green-100 text-green-800 border-green-300'
  if (rating >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  return 'bg-red-100 text-red-800 border-red-300'
}

const sectionDescriptions: Record<string, string> = {
  'Revenue Quality': 'Analyzes income stability, growth patterns, revenue concentration, and business sustainability.',
  'Expense Quality': 'Evaluates expense management, cost control, and operational efficiency.',
  'Existing Debt Impact': 'Assesses MCA positions, stacking risk, debt burden, and repayment patterns.',
  'Cashflow & Charges': 'Reviews NSF/overdraft events, balance health, and liquidity management.',
}

export function SectionHeader({ section }: SectionHeaderProps) {
  const scoreColor = getScoreColor(section.score)
  const ratingLabel = getRatingLabel(section.rating)
  const description = sectionDescriptions[section.name] || ''
  const circumference = 2 * Math.PI * 56 // radius = 56
  const strokeDasharray = `${(section.score / 100) * circumference} ${circumference}`

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{section.name}</h2>
            <p className="text-gray-600 mt-1">{description}</p>

            {/* Score breakdown bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                <span>Section Score</span>
                <span>{section.score}/100</span>
              </div>
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${section.score}%`,
                    backgroundColor: scoreColor,
                  }}
                />
              </div>
            </div>

            {/* Subsection count */}
            <p className="text-sm text-gray-500 mt-3">
              {section.subsections.length} subsections evaluated
            </p>
          </div>

          <div className="flex items-center gap-6 ml-8">
            {/* Circular score gauge */}
            <div className="relative">
              <svg className="w-32 h-32 transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                {/* Score arc */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              {/* Score text in center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${getScoreTextColor(section.score)}`}>
                  {section.score}
                </span>
                <span className="text-xs text-gray-500">/ 100</span>
              </div>
            </div>

            {/* Rating badge */}
            <div className="text-center">
              <Badge
                variant="outline"
                className={`text-lg px-4 py-2 ${getRatingBadgeStyle(section.rating)}`}
              >
                {ratingLabel}
              </Badge>
              <p className="text-xs text-gray-500 mt-2">
                Weight: {Math.round(section.weight * 100)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
