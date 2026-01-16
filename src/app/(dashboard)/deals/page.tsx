'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FileText, Clock, CheckCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateDealDialog } from '@/components/common/CreateDealDialog'
import { DealsFilter } from '@/components/deals/DealsFilter'
import { useDeals } from '@/hooks/useDeals'

const statusConfig = {
  NEW: { label: 'New', variant: 'secondary' as const, icon: FileText, color: 'text-gray-500' },
  PROCESSING: { label: 'Processing', variant: 'outline' as const, icon: Loader2, color: 'text-blue-500' },
  READY: { label: 'Ready', variant: 'default' as const, icon: CheckCircle, color: 'text-green-500' },
  REVIEWED: { label: 'Reviewed', variant: 'default' as const, icon: CheckCircle, color: 'text-green-500' },
  DECIDED: { label: 'Decided', variant: 'default' as const, icon: CheckCircle, color: 'text-purple-500' },
}

const decisionConfig = {
  APPROVED: { label: 'Approved', variant: 'default' as const, className: 'bg-green-500' },
  DECLINED: { label: 'Declined', variant: 'destructive' as const, className: '' },
  MORE_INFO: { label: 'More Info', variant: 'secondary' as const, className: '' },
}

const ITEMS_PER_PAGE = 9

export default function DealsPage() {
  const { data: deals, isLoading, error } = useDeals()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [decisionFilter, setDecisionFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Filter deals
  const filteredDeals = useMemo(() => {
    if (!deals) return []

    return deals.filter((deal) => {
      // Search filter
      if (search && !deal.merchantName.toLowerCase().includes(search.toLowerCase())) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all' && deal.status !== statusFilter) {
        return false
      }

      // Decision filter
      if (decisionFilter !== 'all') {
        if (decisionFilter === 'pending' && deal.decision !== null) {
          return false
        } else if (decisionFilter !== 'pending' && deal.decision !== decisionFilter) {
          return false
        }
      }

      return true
    })
  }, [deals, search, statusFilter, decisionFilter])

  // Pagination
  const totalPages = Math.ceil(filteredDeals.length / ITEMS_PER_PAGE)
  const paginatedDeals = filteredDeals.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setDecisionFilter('all')
    setCurrentPage(1)
  }

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const handleDecisionChange = (value: string) => {
    setDecisionFilter(value)
    setCurrentPage(1)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Error loading deals</h3>
        <p className="text-sm text-gray-500">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500">
            Manage and review merchant cash advance applications
          </p>
        </div>
        <CreateDealDialog />
      </div>

      {/* Filters */}
      <DealsFilter
        search={search}
        onSearchChange={handleSearchChange}
        status={statusFilter}
        onStatusChange={handleStatusChange}
        decision={decisionFilter}
        onDecisionChange={handleDecisionChange}
        onClearFilters={handleClearFilters}
      />

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        Showing {paginatedDeals.length} of {filteredDeals.length} deals
        {filteredDeals.length !== deals?.length && (
          <span> (filtered from {deals?.length} total)</span>
        )}
      </div>

      {/* Deals Grid */}
      {!deals || deals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 p-3 mb-4">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No deals yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Get started by creating a new deal
            </p>
            <CreateDealDialog
              trigger={
                <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Create your first deal
                </button>
              }
            />
          </CardContent>
        </Card>
      ) : filteredDeals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 p-3 mb-4">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No matching deals</h3>
            <p className="text-sm text-gray-500 mb-4">
              Try adjusting your filters
            </p>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedDeals.map((deal) => {
              const status = statusConfig[deal.status as keyof typeof statusConfig] || statusConfig.NEW
              const StatusIcon = status.icon
              const decision = deal.decision
                ? decisionConfig[deal.decision as keyof typeof decisionConfig]
                : null

              return (
                <Link key={deal.id} href={`/deals/${deal.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-1">
                          {deal.merchantName}
                        </CardTitle>
                        <Badge variant={status.variant} className="shrink-0">
                          <StatusIcon className={`mr-1 h-3 w-3 ${status.color} ${deal.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                          {status.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>
                          {new Date(deal.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          {deal._count && (
                            <span className="text-xs">
                              {deal._count.documents} doc{deal._count.documents !== 1 ? 's' : ''}
                            </span>
                          )}
                          {decision && (
                            <Badge variant={decision.variant} className={decision.className}>
                              {decision.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? 'default' : 'outline'}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
