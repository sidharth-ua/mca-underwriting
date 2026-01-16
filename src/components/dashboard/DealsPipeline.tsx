'use client'

import Link from 'next/link'
import { FileText, Loader2, CheckCircle, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Deal {
  id: string
  merchantName: string
  status: string
  decision?: string | null
  createdAt: string
  _count?: {
    documents: number
  }
}

interface DealsPipelineProps {
  deals: Deal[]
}

const columns = [
  {
    id: 'NEW',
    title: 'New',
    icon: FileText,
    color: 'bg-gray-100',
    borderColor: 'border-gray-300',
    iconColor: 'text-gray-500',
  },
  {
    id: 'PROCESSING',
    title: 'Processing',
    icon: Loader2,
    color: 'bg-blue-50',
    borderColor: 'border-blue-300',
    iconColor: 'text-blue-500',
  },
  {
    id: 'READY',
    title: 'Ready for Review',
    icon: CheckCircle,
    color: 'bg-green-50',
    borderColor: 'border-green-300',
    iconColor: 'text-green-500',
  },
  {
    id: 'DECIDED',
    title: 'Decided',
    icon: Award,
    color: 'bg-purple-50',
    borderColor: 'border-purple-300',
    iconColor: 'text-purple-500',
  },
]

function DealCard({ deal }: { deal: Deal }) {
  return (
    <Link href={`/deals/${deal.id}`}>
      <div className="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <p className="font-medium text-gray-900 truncate">{deal.merchantName}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {new Date(deal.createdAt).toLocaleDateString()}
          </span>
          {deal.decision && (
            <Badge
              variant={
                deal.decision === 'APPROVED'
                  ? 'default'
                  : deal.decision === 'DECLINED'
                  ? 'destructive'
                  : 'secondary'
              }
              className="text-xs"
            >
              {deal.decision}
            </Badge>
          )}
        </div>
        {deal._count && (
          <p className="text-xs text-gray-400 mt-1">
            {deal._count.documents} document{deal._count.documents !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Link>
  )
}

export function DealsPipeline({ deals }: DealsPipelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deal Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {columns.map((column) => {
            const Icon = column.icon
            const columnDeals = deals.filter((deal) => deal.status === column.id)

            return (
              <div
                key={column.id}
                className={`rounded-lg border-2 ${column.borderColor} ${column.color} p-3`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-4 w-4 ${column.iconColor}`} />
                  <h3 className="font-medium text-sm">{column.title}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {columnDeals.length}
                  </Badge>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-2">
                    {columnDeals.length > 0 ? (
                      columnDeals.map((deal) => (
                        <DealCard key={deal.id} deal={deal} />
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">
                        No deals
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
