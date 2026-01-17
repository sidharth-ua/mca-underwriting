'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  Trash2,
  Eye,
  BarChart3,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { FileUpload } from '@/components/upload/FileUpload'
import { PDFViewer } from '@/components/pdf-viewer'
import { QuickPeek } from '@/components/flashcards'
import { Scorecard } from '@/components/scorecard'
import { DecisionPanel } from '@/components/common/DecisionPanel'
import { TransactionList } from '@/components/common/TransactionList'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { useDeal, useDeleteDeal } from '@/hooks/useDeals'
import { useQueryClient } from '@tanstack/react-query'

const statusConfig = {
  NEW: { label: 'New', variant: 'secondary' as const, icon: FileText, color: 'bg-gray-500' },
  PROCESSING: { label: 'Processing', variant: 'outline' as const, icon: Loader2, color: 'bg-blue-500' },
  READY: { label: 'Ready for Review', variant: 'default' as const, icon: CheckCircle, color: 'bg-green-500' },
  REVIEWED: { label: 'Reviewed', variant: 'default' as const, icon: CheckCircle, color: 'bg-green-500' },
  DECIDED: { label: 'Decided', variant: 'default' as const, icon: CheckCircle, color: 'bg-purple-500' },
}

const docStatusConfig = {
  UPLOADED: { label: 'Uploaded', color: 'bg-gray-400' },
  PARSING: { label: 'Parsing...', color: 'bg-blue-400' },
  PARSED: { label: 'Parsed', color: 'bg-blue-500' },
  TAGGING: { label: 'Tagging...', color: 'bg-yellow-400' },
  TAGGED: { label: 'Tagged', color: 'bg-yellow-500' },
  READY: { label: 'Ready', color: 'bg-green-500' },
  ERROR: { label: 'Error', color: 'bg-red-500' },
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: deal, isLoading, error, refetch } = useDeal(id)
  const deleteDeal = useDeleteDeal()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this deal?')) return

    try {
      await deleteDeal.mutateAsync(id)
      toast.success('Deal deleted')
      router.push('/deals')
    } catch (error) {
      toast.error('Failed to delete deal')
    }
  }

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['deal', id] })
  }

  const handleDecisionMade = () => {
    refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
          </div>
          <div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    )
  }

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

  const status = statusConfig[deal.status as keyof typeof statusConfig] || statusConfig.NEW
  const StatusIcon = status.icon
  const readyDocuments = deal.documents?.filter((d: { status: string }) => d.status === 'READY') || []
  const hasReadyDocuments = readyDocuments.length > 0

  // Extract all transactions from deal documents
  interface DealTransaction {
    id: string
    date: string
    description: string
    amount: number
    type: 'CREDIT' | 'DEBIT'
    runningBalance: number
    category?: string | null
    subcategory?: string | null
  }

  const allTransactions: DealTransaction[] = deal.documents?.flatMap((doc: {
    bankAccounts?: Array<{
      transactions?: Array<{
        id: string
        date: string
        description: string
        amount: number
        type: 'CREDIT' | 'DEBIT'
        runningBalance: number
        category?: string | null
        subcategory?: string | null
      }>
    }>
  }) =>
    doc.bankAccounts?.flatMap(ba => ba.transactions || []) || []
  ) || []

  // Sort transactions by date (newest first)
  const sortedTransactions = [...allTransactions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Quick peek metrics derived from transactions
  const totalRevenue = allTransactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = allTransactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0)

  const mockMetrics = hasReadyDocuments && allTransactions.length > 0 ? {
    totalRevenue,
    avgMonthlyRevenue: totalRevenue / 3,
    revenueGrowth: 12.5,
    depositCount: allTransactions.filter(t => t.type === 'CREDIT').length,
    totalExpenses,
    avgMonthlyExpenses: totalExpenses / 3,
    expenseRatio: totalExpenses / totalRevenue * 100,
    existingMcaCount: allTransactions.filter(t =>
      t.description.toLowerCase().includes('mca') ||
      t.category?.toLowerCase().includes('mca')
    ).length > 0 ? 1 : 0,
    existingMcaBalance: 0,
    mcaPaymentTotal: allTransactions
      .filter(t => t.description.toLowerCase().includes('mca'))
      .reduce((sum, t) => sum + t.amount, 0),
    mcaPaymentRatio: 0,
    nsfCount: allTransactions.filter(t =>
      t.description.toLowerCase().includes('nsf') ||
      t.description.toLowerCase().includes('overdraft')
    ).length,
    negativeBalanceDays: allTransactions.filter(t => t.runningBalance < 0).length,
    avgDailyBalance: allTransactions.length > 0
      ? allTransactions.reduce((sum, t) => sum + t.runningBalance, 0) / allTransactions.length
      : 0,
    minBalance: allTransactions.length > 0
      ? Math.min(...allTransactions.map(t => t.runningBalance))
      : 0,
    maxBalance: allTransactions.length > 0
      ? Math.max(...allTransactions.map(t => t.runningBalance))
      : 0,
    overallScore: 72,
    revenueScore: 20,
    cashFlowScore: 18,
    mcaScore: 16,
    riskScore: 18,
    periodStart: allTransactions.length > 0
      ? allTransactions[allTransactions.length - 1].date
      : '',
    periodEnd: allTransactions.length > 0
      ? allTransactions[0].date
      : '',
    monthsAnalyzed: 3,
  } : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/deals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{deal.merchantName}</h1>
              <Badge variant={status.variant}>
                <StatusIcon className={`mr-1 h-3 w-3 ${deal.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              Created {new Date(deal.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue={hasReadyDocuments ? 'review' : 'documents'}>
            <TabsList>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="review" disabled={!hasReadyDocuments}>
                <Eye className="mr-1 h-4 w-4" />
                Review
              </TabsTrigger>
              <TabsTrigger value="scorecard" disabled={!hasReadyDocuments}>
                <BarChart3 className="mr-1 h-4 w-4" />
                Scorecard
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Bank Statements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FileUpload dealId={id} onUploadComplete={handleUploadComplete} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  {deal.documents && deal.documents.length > 0 ? (
                    <div className="space-y-3">
                      {deal.documents.map((doc: {
                        id: string
                        originalName: string
                        status: string
                        size: number
                        createdAt: string
                        bankAccounts?: Array<{ bankName: string; _count?: { transactions: number } }>
                      }) => {
                        const docStatus = docStatusConfig[doc.status as keyof typeof docStatusConfig] || docStatusConfig.UPLOADED
                        return (
                          <div
                            key={doc.id}
                            className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                              selectedDocId === doc.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                            onClick={() => setSelectedDocId(doc.id)}
                          >
                            <FileText className="h-8 w-8 text-red-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {doc.originalName}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>{(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                                <span>•</span>
                                <span>{new Date(doc.createdAt).toLocaleString()}</span>
                              </div>
                              {doc.bankAccounts && doc.bankAccounts.length > 0 && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {doc.bankAccounts.map((ba) => ba.bankName).join(', ')} •{' '}
                                  {doc.bankAccounts.reduce((acc, ba) => acc + (ba._count?.transactions || 0), 0)} transactions
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${docStatus.color}`} />
                              <span className="text-sm text-gray-600">{docStatus.label}</span>
                              {(doc.status === 'PARSING' || doc.status === 'TAGGING') && (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No documents uploaded yet</p>
                      <p className="text-sm">Upload bank statements to begin processing</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PDF Preview */}
              {selectedDocId && (
                <Card>
                  <CardHeader>
                    <CardTitle>Document Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PDFViewer
                      url={`/api/documents/${selectedDocId}/file`}
                      className="h-[600px]"
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Review Tab */}
            <TabsContent value="review" className="mt-4 space-y-6">
              {/* Quick Peek */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Quick Peek</h3>
                <QuickPeek metrics={mockMetrics} />
              </div>

              {/* PDF Viewer */}
              {readyDocuments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Bank Statement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PDFViewer
                      url={`/api/documents/${readyDocuments[0].id}/file`}
                      filename={readyDocuments[0].originalName}
                      className="h-[500px]"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Transactions */}
              <TransactionList transactions={sortedTransactions} />
            </TabsContent>

            {/* Scorecard Tab */}
            <TabsContent value="scorecard" className="mt-4">
              <Scorecard transactions={sortedTransactions} dealId={id} />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Log</CardTitle>
                </CardHeader>
                <CardContent>
                  {deal.activities && deal.activities.length > 0 ? (
                    <div className="space-y-4">
                      {deal.activities.map((activity: {
                        id: string
                        action: string
                        details?: string | null
                        createdAt: string
                        user?: { name?: string | null; email: string } | null
                      }) => (
                        <div key={activity.id} className="flex gap-3">
                          <div className="h-2 w-2 mt-2 rounded-full bg-gray-400" />
                          <div>
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">
                                {activity.user?.name || activity.user?.email || 'System'}
                              </span>{' '}
                              {activity.action.toLowerCase().replace('_', ' ')}
                            </p>
                            {activity.details && (
                              <p className="text-sm text-gray-500">{activity.details}</p>
                            )}
                            <p className="text-xs text-gray-400">
                              {new Date(activity.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-500">No activity yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Deal Info & Decision */}
        <div className="space-y-6">
          {/* Decision Panel - Show when ready for review */}
          {hasReadyDocuments && (
            <DecisionPanel
              dealId={id}
              currentDecision={deal.decision as 'APPROVED' | 'DECLINED' | 'MORE_INFO' | null}
              currentNotes={deal.decisionNotes}
              onDecisionMade={handleDecisionMade}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Deal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`h-3 w-3 rounded-full ${status.color}`} />
                  <span className="font-medium">{status.label}</span>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-500">Documents</p>
                <p className="font-medium mt-1">{deal.documents?.length || 0} uploaded</p>
                {readyDocuments.length > 0 && (
                  <p className="text-xs text-green-600">{readyDocuments.length} ready for review</p>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <p className="font-medium mt-1">
                  {new Date(deal.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-500">Last Updated</p>
                <p className="font-medium mt-1">
                  {new Date(deal.updatedAt).toLocaleDateString()}
                </p>
              </div>
              {deal.decision && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Decision</p>
                    <Badge
                      variant={deal.decision === 'APPROVED' ? 'default' : deal.decision === 'DECLINED' ? 'destructive' : 'secondary'}
                      className="mt-1"
                    >
                      {deal.decision}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" onClick={() => refetch()}>
                <Clock className="mr-2 h-4 w-4" />
                Refresh Status
              </Button>
            </CardContent>
          </Card>

          {/* AI Chat Assistant - Show when documents are ready */}
          {hasReadyDocuments && (
            <ChatInterface
              dealId={id}
              dealName={deal.merchantName}
            />
          )}
        </div>
      </div>
    </div>
  )
}
