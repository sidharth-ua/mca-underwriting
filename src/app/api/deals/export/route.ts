import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const status = searchParams.get('status')
    const decision = searchParams.get('decision')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }
    if (decision && decision !== 'all') {
      if (decision === 'pending') {
        where.decision = null
      } else {
        where.decision = decision
      }
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        documents: true,
        metrics: true,
        assignedTo: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (format === 'json') {
      return NextResponse.json(deals)
    }

    // Generate CSV
    const headers = [
      'ID',
      'Merchant Name',
      'Status',
      'Decision',
      'Decision Notes',
      'Created Date',
      'Updated Date',
      'Documents Count',
      'Assigned To',
      'Total Revenue',
      'Avg Monthly Revenue',
      'Total Expenses',
      'Daily MCA Obligation',
      'Overall Score'
    ]

    const rows = deals.map(deal => [
      deal.id,
      `"${deal.merchantName.replace(/"/g, '""')}"`,
      deal.status,
      deal.decision || 'Pending',
      deal.decisionNotes ? `"${deal.decisionNotes.replace(/"/g, '""')}"` : '',
      new Date(deal.createdAt).toISOString().split('T')[0],
      new Date(deal.updatedAt).toISOString().split('T')[0],
      deal.documents.length,
      deal.assignedTo?.name || deal.assignedTo?.email || 'Unassigned',
      deal.metrics?.totalRevenue?.toFixed(2) || '',
      deal.metrics?.averageMonthlyRevenue?.toFixed(2) || '',
      deal.metrics?.totalExpenses?.toFixed(2) || '',
      deal.metrics?.dailyMcaObligation?.toFixed(2) || '',
      deal.metrics?.overallScore?.toFixed(0) || ''
    ])

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="deals-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export deals' },
      { status: 500 }
    )
  }
}
