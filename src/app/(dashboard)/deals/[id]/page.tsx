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
  BarChart3,
  XCircle,
  HelpCircle,
  Brain,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileUpload } from '@/components/upload/FileUpload'
import { PDFViewer } from '@/components/pdf-viewer'
import { QuickPeek } from '@/components/flashcards'
import { Scorecard } from '@/components/scorecard'
import { TransactionList } from '@/components/common/TransactionList'
import { AgenticScorecardTab } from '@/components/scorecard/agentic'
import { useDeal, useDeleteDeal, useUpdateDeal } from '@/hooks/useDeals'
import { useQueryClient } from '@tanstack/react-query'

type Decision = 'APPROVED' | 'DECLINED' | 'MORE_INFO'

const decisionConfig = {
  APPROVED: {
    label: 'Approve',
    shortLabel: 'Approve',
    description: 'Approve this deal for funding',
    icon: CheckCircle,
    color: 'bg-green-600 hover:bg-green-700',
    textColor: 'text-green-600',
    badgeBg: 'bg-green-100 text-green-800',
  },
  DECLINED: {
    label: 'Decline',
    shortLabel: 'Decline',
    description: 'Decline this deal',
    icon: XCircle,
    color: 'bg-red-600 hover:bg-red-700',
    textColor: 'text-red-600',
    badgeBg: 'bg-red-100 text-red-800',
  },
  MORE_INFO: {
    label: 'Request Info',
    shortLabel: 'Request Info',
    description: 'Request additional information',
    icon: HelpCircle,
    color: 'bg-yellow-600 hover:bg-yellow-700',
    textColor: 'text-yellow-600',
    badgeBg: 'bg-yellow-100 text-yellow-800',
  },
}

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
  const updateDeal = useUpdateDeal()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  // Decision state
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false)

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

  const handleDecisionClick = (decision: Decision) => {
    setSelectedDecision(decision)
    setDecisionNotes('')
    setIsDecisionDialogOpen(true)
  }

  const handleConfirmDecision = async () => {
    if (!selectedDecision) return

    try {
      await updateDeal.mutateAsync({
        id,
        decision: selectedDecision,
        decisionNotes: decisionNotes,
        status: 'DECIDED',
      })
      toast.success(`Deal ${selectedDecision.toLowerCase().replace('_', ' ')}`)
      setIsDecisionDialogOpen(false)
      refetch()
    } catch (error) {
      toast.error('Failed to save decision')
    }
  }

  const handleChangeDecision = () => {
    setSelectedDecision(null)
    setDecisionNotes('')
    setIsDecisionDialogOpen(true)
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

  const DecisionIcon = selectedDecision ? decisionConfig[selectedDecision].icon : null

  return (
    <div className="space-y-6">
      {/* Header with Decision Actions */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
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
                {deal.decision && (
                  <Badge className={decisionConfig[deal.decision as Decision].badgeBg}>
                    {decisionConfig[deal.decision as Decision].label}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Created {new Date(deal.createdAt).toLocaleDateString()} • {deal.documents?.length || 0} documents
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>

        {/* Decision Buttons */}
        {hasReadyDocuments && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            {deal.decision ? (
              <>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {(() => {
                    const config = decisionConfig[deal.decision as Decision]
                    const Icon = config.icon
                    return (
                      <>
                        <Icon className={`h-4 w-4 ${config.textColor}`} />
                        <span>Decision: <strong className={config.textColor}>{config.label}</strong></span>
                      </>
                    )
                  })()}
                  {deal.decisionNotes && (
                    <span className="text-gray-400 ml-2">— {deal.decisionNotes.substring(0, 50)}{deal.decisionNotes.length > 50 ? '...' : ''}</span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleChangeDecision}>
                  Change Decision
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-500 mr-2">Make a decision:</span>
                <Button
                  size="sm"
                  className={`${decisionConfig.APPROVED.color} text-white`}
                  onClick={() => handleDecisionClick('APPROVED')}
                >
                  <CheckCircle className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  className={`${decisionConfig.DECLINED.color} text-white`}
                  onClick={() => handleDecisionClick('DECLINED')}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  className={`${decisionConfig.MORE_INFO.color} text-white`}
                  onClick={() => handleDecisionClick('MORE_INFO')}
                >
                  <HelpCircle className="mr-1 h-4 w-4" />
                  Request Info
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Content - Full Width */}
      <Tabs defaultValue={hasReadyDocuments ? 'analysis' : 'documents'}>
        <TabsList>
          <TabsTrigger value="documents">
            <FileText className="mr-1 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!hasReadyDocuments}>
            <BarChart3 className="mr-1 h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="agentic" disabled={!hasReadyDocuments}>
            <Brain className="mr-1 h-4 w-4" />
            Agentic Analysis
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Clock className="mr-1 h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
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
          </div>

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

        {/* Analysis Tab (merged Review + Scorecard) */}
        <TabsContent value="analysis" className="mt-4 space-y-6">
          {/* Quick Peek Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Summary</h3>
            <QuickPeek metrics={mockMetrics} />
          </div>

          {/* Scorecard */}
          <Scorecard transactions={sortedTransactions} dealId={id} />

          {/* Transactions */}
          <TransactionList transactions={sortedTransactions} />

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
        </TabsContent>

        {/* Agentic Analysis Tab */}
        <TabsContent value="agentic" className="mt-4">
          <AgenticScorecardTab dealId={id} transactions={sortedTransactions} />
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

      {/* Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {DecisionIcon && (
                <DecisionIcon
                  className={`h-5 w-5 ${
                    selectedDecision ? decisionConfig[selectedDecision].textColor : ''
                  }`}
                />
              )}
              {selectedDecision
                ? `Confirm ${decisionConfig[selectedDecision].label}`
                : 'Change Decision'}
            </DialogTitle>
            <DialogDescription>
              {selectedDecision
                ? decisionConfig[selectedDecision].description
                : 'Select a new decision for this deal'}
            </DialogDescription>
          </DialogHeader>

          {!selectedDecision && (
            <div className="grid gap-3 py-4">
              {(Object.keys(decisionConfig) as Decision[]).map((decision) => {
                const config = decisionConfig[decision]
                const Icon = config.icon
                return (
                  <Button
                    key={decision}
                    variant="outline"
                    className={`w-full justify-start ${
                      deal.decision === decision ? 'border-2 border-primary' : ''
                    }`}
                    onClick={() => setSelectedDecision(decision)}
                  >
                    <Icon className={`mr-2 h-4 w-4 ${config.textColor}`} />
                    {config.label}
                  </Button>
                )
              })}
            </div>
          )}

          {selectedDecision && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Decision Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about your decision..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
              Cancel
            </Button>
            {selectedDecision && (
              <Button
                className={decisionConfig[selectedDecision].color}
                onClick={handleConfirmDecision}
                disabled={updateDeal.isPending}
              >
                {updateDeal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm {decisionConfig[selectedDecision].label}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
