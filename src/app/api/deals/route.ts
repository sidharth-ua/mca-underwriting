import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

const createDealSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required'),
})

// GET /api/deals - List all deals
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.merchantName = {
        contains: search,
        mode: 'insensitive',
      }
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        documents: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(deals)
  } catch (error) {
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}

// POST /api/deals - Create a new deal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createDealSchema.parse(body)

    const deal = await prisma.deal.create({
      data: {
        merchantName: validatedData.merchantName,
        status: 'NEW',
        assignedToId: session.user.id,
      },
    })

    // Create activity log
    await prisma.dealActivity.create({
      data: {
        dealId: deal.id,
        userId: session.user.id,
        action: 'CREATED',
        details: `Deal created for ${validatedData.merchantName}`,
      },
    })

    return NextResponse.json(deal, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Error creating deal:', error)
    return NextResponse.json(
      { error: 'Failed to create deal' },
      { status: 500 }
    )
  }
}
