'use client'

import { useState } from 'react'
import { Loader2, ChevronDown, ChevronRight, BarChart2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  StatsCards,
  DashboardCharts,
  DealsPipeline,
} from '@/components/dashboard'
import { useDashboard } from '@/hooks/useDashboard'

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard()
  const [chartsExpanded, setChartsExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[350px] lg:col-span-2" />
          <Skeleton className="h-[350px]" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-500">Failed to load dashboard</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Overview of your MCA underwriting pipeline
        </p>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={data.stats} />

      {/* Pipeline - Full Width */}
      <DealsPipeline deals={data.deals} />

      {/* Analytics - Collapsible */}
      <Card>
        <Collapsible open={chartsExpanded} onOpenChange={setChartsExpanded}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded">
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5" />
                  Analytics
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{chartsExpanded ? 'Hide Charts' : 'Show Charts'}</span>
                  {chartsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <DashboardCharts
                monthlyData={data.monthlyData}
                decisionData={data.decisionData}
              />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
