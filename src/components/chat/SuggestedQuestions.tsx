'use client'

import { cn } from '@/lib/utils'
import type { DealChatContext } from '@/types/chat'

interface SuggestedQuestionsProps {
  context: DealChatContext | null
  onQuestionClick: (question: string) => void
  className?: string
}

export function SuggestedQuestions({ context, onQuestionClick, className }: SuggestedQuestionsProps) {
  const suggestions = generateSuggestions(context)

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onQuestionClick(suggestion)}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors whitespace-nowrap"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}

function generateSuggestions(context: DealChatContext | null): string[] {
  const suggestions: string[] = []

  // Always include basics
  suggestions.push('Give me a quick summary')

  if (!context) {
    suggestions.push('What are the main risk factors?')
    suggestions.push('Revenue trends?')
    suggestions.push('Should I approve this?')
    return suggestions
  }

  const { analytics } = context

  // MCA-specific if MCA detected
  if (analytics.mca.uniqueMCACount > 0) {
    suggestions.push('Analyze MCA stacking risk')
    if (analytics.mca.uniqueMCACount > 1) {
      suggestions.push('Total MCA payment burden?')
    }
  }

  // NSF-specific if NSF events
  if (analytics.nsf.count > 0) {
    suggestions.push('Explain NSF pattern')
  }

  // Red flag specific
  if (analytics.scorecard?.redFlags && analytics.scorecard.redFlags.length > 0) {
    suggestions.push('Main risk factors?')
  }

  // Revenue analysis
  if (analytics.totalRevenue > 0) {
    // Check for revenue decline (compare first and last month if available)
    const monthlyData = analytics.monthlyData
    if (monthlyData && monthlyData.length >= 2) {
      const firstMonth = monthlyData[0]
      const lastMonth = monthlyData[monthlyData.length - 1]
      if (lastMonth.revenue < firstMonth.revenue * 0.9) {
        suggestions.push('Why is revenue declining?')
      }
    }
  }

  // Expense concerns
  if (analytics.totalExpenses > analytics.totalRevenue * 0.9) {
    suggestions.push('Expense breakdown?')
  }

  // Cash flow concerns
  if (analytics.netCashFlow < 0) {
    suggestions.push('Cash flow concerns?')
  }

  // Negative balance days
  if (analytics.nsf.negativeBalanceDays > 5) {
    suggestions.push('Negative balance analysis?')
  }

  // Always include approval question
  suggestions.push('Should I approve this?')

  // Return unique suggestions, max 6
  return [...new Set(suggestions)].slice(0, 6)
}

export { generateSuggestions }
