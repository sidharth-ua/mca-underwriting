'use client'

import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  score: number
  rating: number
  recommendation?: string
  className?: string
}

export function ScoreGauge({ score, rating, recommendation, className }: ScoreGaugeProps) {
  // Color scale based on score
  const getScoreColor = (score: number) => {
    if (score >= 75) return { primary: '#22c55e', bg: 'bg-green-50', text: 'text-green-700', label: 'STRONG' }
    if (score >= 60) return { primary: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-700', label: 'MODERATE' }
    if (score >= 45) return { primary: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'FAIR' }
    if (score >= 30) return { primary: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', label: 'WEAK' }
    return { primary: '#ef4444', bg: 'bg-red-50', text: 'text-red-700', label: 'POOR' }
  }

  const colorConfig = getScoreColor(score)

  // SVG circle calculations
  const size = 100
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  // Star rating
  const renderStars = () => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={cn(
          'text-sm',
          i < rating ? 'text-yellow-500' : 'text-gray-300'
        )}
      >
        ★
      </span>
    ))
  }

  return (
    <div className={cn('flex flex-col items-center p-4 rounded-lg', colorConfig.bg, className)}>
      {/* Circular gauge */}
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorConfig.primary}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold', colorConfig.text)}>
            {Math.round(score)}
          </span>
        </div>
      </div>

      {/* Star rating */}
      <div className="flex items-center gap-0.5 mt-2">
        {renderStars()}
      </div>

      {/* Label */}
      <div className={cn('text-xs font-semibold mt-1', colorConfig.text)}>
        {colorConfig.label}
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="text-xs text-gray-600 mt-2 text-center">
          {recommendation}
        </div>
      )}
    </div>
  )
}
