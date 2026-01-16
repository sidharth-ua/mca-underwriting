import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current month date range
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Get total deals count
    const totalDeals = await prisma.deal.count()

    // Get pending (READY status, no decision)
    const pendingDeals = await prisma.deal.count({
      where: {
        status: 'READY',
        decision: null,
      },
    })

    // Get approved this month
    const approvedThisMonth = await prisma.deal.count({
      where: {
        decision: 'APPROVED',
        updatedAt: {
          gte: startOfMonth,
        },
      },
    })

    // Get declined this month
    const declinedThisMonth = await prisma.deal.count({
      where: {
        decision: 'DECLINED',
        updatedAt: {
          gte: startOfMonth,
        },
      },
    })

    // Get total decided
    const totalDecided = await prisma.deal.count({
      where: {
        decision: {
          not: null,
        },
      },
    })

    const totalApproved = await prisma.deal.count({
      where: { decision: 'APPROVED' },
    })

    // Calculate approval rate
    const approvalRate = totalDecided > 0 ? (totalApproved / totalDecided) * 100 : 0

    // Get deals last month for comparison
    const dealsLastMonth = await prisma.deal.count({
      where: {
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    })

    const dealsThisMonth = await prisma.deal.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    })

    // Calculate month over month change
    const monthlyChange =
      dealsLastMonth > 0
        ? ((dealsThisMonth - dealsLastMonth) / dealsLastMonth) * 100
        : dealsThisMonth > 0
        ? 100
        : 0

    // Get monthly data for charts (last 6 months)
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

      const monthDeals = await prisma.deal.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      })

      const monthApproved = await prisma.deal.count({
        where: {
          decision: 'APPROVED',
          updatedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      })

      const monthDeclined = await prisma.deal.count({
        where: {
          decision: 'DECLINED',
          updatedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      })

      monthlyData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        deals: monthDeals,
        approved: monthApproved,
        declined: monthDeclined,
      })
    }

    // Decision distribution for pie chart
    const moreInfoCount = await prisma.deal.count({
      where: { decision: 'MORE_INFO' },
    })

    const pendingCount = await prisma.deal.count({
      where: { decision: null },
    })

    const decisionData = [
      { name: 'Approved', value: totalApproved, color: '#22c55e' },
      { name: 'Declined', value: await prisma.deal.count({ where: { decision: 'DECLINED' } }), color: '#ef4444' },
      { name: 'More Info', value: moreInfoCount, color: '#eab308' },
      { name: 'Pending', value: pendingCount, color: '#6b7280' },
    ].filter((item) => item.value > 0)

    // Get recent activities
    const recentActivities = await prisma.dealActivity.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        deal: {
          select: {
            id: true,
            merchantName: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Get all deals for pipeline
    const allDeals = await prisma.deal.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    })

    return NextResponse.json({
      stats: {
        total: totalDeals,
        pending: pendingDeals,
        approved: approvedThisMonth,
        declined: declinedThisMonth,
        approvalRate,
        avgProcessingDays: 3, // Mock for now
        monthlyChange: Math.round(monthlyChange * 10) / 10,
      },
      monthlyData,
      decisionData,
      recentActivities,
      deals: allDeals,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
