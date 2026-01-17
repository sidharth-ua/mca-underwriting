'use client'

import { cn } from '@/lib/utils'

interface SectionScore {
  score: number
  rating: number
}

interface MiniScorecardProps {
  sections: {
    revenueQuality: SectionScore
    expenseQuality: SectionScore
    existingDebtImpact: SectionScore
    cashflowCharges: SectionScore
  }
  onSectionClick?: (section: string) => void
  className?: string
}

export function MiniScorecard({ sections, onSectionClick, className }: MiniScorecardProps) {
  const sectionConfig = [
    { key: 'revenueQuality', label: 'Revenue', data: sections.revenueQuality },
    { key: 'expenseQuality', label: 'Expense', data: sections.expenseQuality },
    { key: 'existingDebtImpact', label: 'Debt', data: sections.existingDebtImpact },
    { key: 'cashflowCharges', label: 'Cashflow', data: sections.cashflowCharges },
  ]

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'bg-green-500'
    if (score >= 60) return 'bg-blue-500'
    if (score >= 45) return 'bg-yellow-500'
    if (score >= 30) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getScoreTextColor = (score: number) => {
    if (score >= 75) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 45) return 'text-yellow-600'
    if (score >= 30) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className={cn('space-y-2', className)}>
      {sectionConfig.map(({ key, label, data }) => (
        <button
          key={key}
          onClick={() => onSectionClick?.(key)}
          className="w-full group"
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 group-hover:text-gray-900 transition-colors">
              {label}
            </span>
            <span className={cn('font-medium', getScoreTextColor(data.score))}>
              {Math.round(data.score)}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all group-hover:opacity-80',
                getScoreColor(data.score)
              )}
              style={{ width: `${data.score}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  )
}
