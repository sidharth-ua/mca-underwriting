'use client'

import { use, useMemo } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeal } from '@/hooks/useDeals'
import {
  calculateAggregatedMetrics,
  type Transaction,
} from '@/utils/calculations/metricsCalculator'
import { calculateOverallScorecard } from '@/utils/calculations/overallScorecard'
import { SectionPageLayout } from '@/components/scorecard/sections/SectionPageLayout'
import { RevenueSection } from '@/components/scorecard/sections/RevenueSection'
import { ExpenseSection } from '@/components/scorecard/sections/ExpenseSection'
import { DebtSection } from '@/components/scorecard/sections/DebtSection'
import { CashflowSection } from '@/components/scorecard/sections/CashflowSection'

// Section slug to key mapping
const SECTION_SLUGS: Record<string, 'revenueQuality' | 'expenseQuality' | 'existingDebtImpact' | 'cashflowCharges'> = {
  'revenue-quality': 'revenueQuality',
  'expense-quality': 'expenseQuality',
  'existing-debt': 'existingDebtImpact',
  'cashflow-charges': 'cashflowCharges',
}

const SECTION_NAMES: Record<string, string> = {
  'revenue-quality': 'Revenue Quality',
  'expense-quality': 'Expense Quality',
  'existing-debt': 'Existing Debt Impact',
  'cashflow-charges': 'Cashflow & Charges',
}

interface DealTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  runningBalance: number
  category?: string | null
  subcategory?: string | null
  parseQuality?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSIGNED' | null
}

export default function SectionDetailPage({
  params,
}: {
  params: Promise<{ id: string; section: string }>
}) {
  const { id, section } = use(params)

  // Validate section slug
  const sectionKey = SECTION_SLUGS[section]
  if (!sectionKey) {
    notFound()
  }

  const { data: deal, isLoading, error } = useDeal(id)

  // Extract transactions from deal documents
  const transactions = useMemo((): Transaction[] => {
    if (!deal?.documents) return []
    return deal.documents.flatMap((doc: {
      bankAccounts?: Array<{
        transactions?: DealTransaction[]
      }>
    }) =>
      doc.bankAccounts?.flatMap(ba => ba.transactions || []) || []
    )
  }, [deal])

  // Calculate metrics and scorecard
  const metrics = useMemo(() => {
    if (transactions.length === 0) return null
    return calculateAggregatedMetrics(transactions)
  }, [transactions])

  const scorecard = useMemo(() => {
    if (!metrics || !transactions.length) return null
    try {
      return calculateOverallScorecard({ transactions, metrics })
    } catch (error) {
      console.error('Error calculating scorecard:', error)
      return null
    }
  }, [transactions, metrics])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !deal) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Deal not found</h3>
        <p className="text-sm text-gray-500 mb-4">
          {error?.message || 'The deal you are looking for does not exist'}
        </p>
        <Link href="/deals">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deals
          </Button>
        </Link>
      </div>
    )
  }

  // No data state
  if (!metrics || !scorecard) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No data available</h3>
        <p className="text-sm text-gray-500 mb-4">
          Unable to calculate scorecard. Please ensure bank statements have been processed.
        </p>
        <Link href={`/deals/${id}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deal
          </Button>
        </Link>
      </div>
    )
  }

  const sectionData = scorecard.sections[sectionKey]
  const sectionName = SECTION_NAMES[section]

  // Render section-specific content
  const renderSectionContent = () => {
    switch (sectionKey) {
      case 'revenueQuality':
        return <RevenueSection section={sectionData} metrics={metrics} />
      case 'expenseQuality':
        return <ExpenseSection section={sectionData} metrics={metrics} />
      case 'existingDebtImpact':
        return <DebtSection section={sectionData} metrics={metrics} transactions={transactions} />
      case 'cashflowCharges':
        return <CashflowSection section={sectionData} metrics={metrics} />
      default:
        return null
    }
  }

  return (
    <SectionPageLayout
      dealId={id}
      merchantName={deal.merchantName}
      sectionName={sectionName}
      section={sectionData}
      periodStart={scorecard.periodStart}
      periodEnd={scorecard.periodEnd}
      monthsAnalyzed={scorecard.monthsAnalyzed}
    >
      {renderSectionContent()}
    </SectionPageLayout>
  )
}
