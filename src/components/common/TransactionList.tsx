'use client'

import { useState } from 'react'
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  runningBalance?: number
  category?: string | null
  subcategory?: string | null
}

interface TransactionListProps {
  transactions?: Transaction[]
  className?: string
}

const categoryColors: Record<string, string> = {
  REVENUE: 'bg-green-100 text-green-800',
  DEPOSIT: 'bg-green-100 text-green-800',
  EXPENSE: 'bg-red-100 text-red-800',
  WITHDRAWAL: 'bg-red-100 text-red-800',
  MCA_PAYMENT: 'bg-yellow-100 text-yellow-800',
  LOAN_PAYMENT: 'bg-yellow-100 text-yellow-800',
  TRANSFER: 'bg-blue-100 text-blue-800',
  FEE: 'bg-gray-100 text-gray-800',
  NSF: 'bg-red-100 text-red-800',
  OTHER: 'bg-gray-100 text-gray-800',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function TransactionList({ transactions = [], className }: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'CREDIT' | 'DEBIT'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Get unique categories
  const categories = Array.from(
    new Set(transactions.map((t) => t.category).filter(Boolean))
  ) as string[]

  // Filter transactions
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      searchQuery === '' ||
      transaction.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType = typeFilter === 'all' || transaction.type === typeFilter

    const matchesCategory =
      categoryFilter === 'all' || transaction.category === categoryFilter

    return matchesSearch && matchesType && matchesCategory
  })

  // Calculate totals
  const totals = filteredTransactions.reduce(
    (acc, t) => {
      if (t.type === 'CREDIT') {
        acc.credits += t.amount
      } else {
        acc.debits += t.amount
      }
      return acc
    },
    { credits: 0, debits: 0 }
  )

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Transactions</span>
          <Badge variant="secondary">{filteredTransactions.length} items</Badge>
        </CardTitle>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {typeFilter === 'all' ? 'All Types' : typeFilter}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                All Types
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('CREDIT')}>
                Credits Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('DEBIT')}>
                Debits Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setCategoryFilter('all')}>
                  All Categories
                </DropdownMenuItem>
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                  >
                    {category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Totals */}
        <div className="flex gap-4 mt-4 text-sm">
          <div className="flex items-center gap-1">
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
            <span className="text-gray-600">Credits:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(totals.credits)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
            <span className="text-gray-600">Debits:</span>
            <span className="font-medium text-red-600">
              {formatCurrency(totals.debits)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No transactions found</p>
            {searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {transaction.type === 'CREDIT' ? (
                  <ArrowUpCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <ArrowDownCircle className="h-5 w-5 text-red-500 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {transaction.description}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{formatDate(transaction.date)}</span>
                    {transaction.category && (
                      <>
                        <span>•</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            categoryColors[transaction.category] || categoryColors.OTHER
                          )}
                        >
                          {transaction.category}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'font-medium',
                      transaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {transaction.type === 'CREDIT' ? '+' : '-'}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </p>
                  {transaction.runningBalance !== undefined && (
                    <p className="text-xs text-gray-500">
                      Balance: {formatCurrency(transaction.runningBalance)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
