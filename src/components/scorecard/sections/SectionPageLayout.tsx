'use client'

import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { SectionScore } from '@/utils/calculations/scoringFramework'
import { SectionHeader } from './SectionHeader'
import { RedFlagsSummary } from './RedFlagsSummary'

interface SectionPageLayoutProps {
  dealId: string
  merchantName: string
  sectionName: string
  section: SectionScore
  periodStart: Date
  periodEnd: Date
  monthsAnalyzed: number
  children: React.ReactNode
}

export function SectionPageLayout({
  dealId,
  merchantName,
  sectionName,
  section,
  periodStart,
  periodEnd,
  monthsAnalyzed,
  children,
}: SectionPageLayoutProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }

  // Collect all red flags from subsections
  const allRedFlags = section.subsections.flatMap((sub) => sub.redFlags || [])

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/deals/${dealId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <p className="text-sm text-gray-500">
              <Link href={`/deals/${dealId}`} className="hover:underline">
                {merchantName}
              </Link>
              {' / '}
              <span className="text-gray-700">Scorecard</span>
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{sectionName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>
              {formatDate(periodStart)} - {formatDate(periodEnd)}
            </span>
          </div>
          <Badge variant="outline">
            {monthsAnalyzed} Month{monthsAnalyzed !== 1 ? 's' : ''} Analyzed
          </Badge>
        </div>
      </div>

      {/* Section header with score gauge */}
      <SectionHeader section={section} />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {children}
      </div>

      {/* Red flags summary */}
      {allRedFlags.length > 0 && (
        <RedFlagsSummary redFlags={allRedFlags} />
      )}
    </div>
  )
}
