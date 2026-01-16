'use client'

import { useState } from 'react'
import { Search, Filter, X, Download, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface DealsFilterProps {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  decision: string
  onDecisionChange: (value: string) => void
  onClearFilters: () => void
}

export function DealsFilter({
  search,
  onSearchChange,
  status,
  onStatusChange,
  decision,
  onDecisionChange,
  onClearFilters,
}: DealsFilterProps) {
  const [exporting, setExporting] = useState(false)
  const hasFilters = search || status !== 'all' || decision !== 'all'

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (status !== 'all') params.set('status', status)
      if (decision !== 'all') params.set('decision', decision)

      const response = await fetch(`/api/deals/export?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      if (format === 'json') {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `deals-export-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }

      toast.success(`Deals exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Failed to export deals')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[250px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by merchant name..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filter */}
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[160px]">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="NEW">New</SelectItem>
          <SelectItem value="PROCESSING">Processing</SelectItem>
          <SelectItem value="READY">Ready for Review</SelectItem>
          <SelectItem value="DECIDED">Decided</SelectItem>
        </SelectContent>
      </Select>

      {/* Decision Filter */}
      <Select value={decision} onValueChange={onDecisionChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Decision" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Decisions</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="DECLINED">Declined</SelectItem>
          <SelectItem value="MORE_INFO">More Info</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleExport('csv')}>
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('json')}>
            Export as JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active Filters Display */}
      {hasFilters && (
        <div className="flex gap-2">
          {search && (
            <Badge variant="secondary" className="text-xs">
              Search: {search}
            </Badge>
          )}
          {status !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Status: {status}
            </Badge>
          )}
          {decision !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Decision: {decision}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
