import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

const updateDealSchema = z.object({
  merchantName: z.string().min(1).optional(),
  status: z.enum(['NEW', 'PROCESSING', 'READY', 'REVIEWED', 'DECIDED']).optional(),
  decision: z.enum(['APPROVED', 'DECLINED', 'MORE_INFO']).optional(),
  decisionNotes: z.string().optional(),
})

// GET /api/deals/[id] - Get a single deal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        documents: {
          include: {
            bankAccounts: {
              include: {
                transactions: {
                  orderBy: { date: 'asc' },
                  // No limit - get all transactions for accurate analysis
                },
              },
            },
          },
        },
        metrics: true,
        notes: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json(deal)
  } catch (error) {
    console.error('Error fetching deal:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deal' },
      { status: 500 }
    )
  }
}

// PATCH /api/deals/[id] - Update a deal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateDealSchema.parse(body)

    const existingDeal = await prisma.deal.findUnique({ where: { id } })
    if (!existingDeal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(deal)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Error updating deal:', error)
    return NextResponse.json(
      { error: 'Failed to update deal' },
      { status: 500 }
    )
  }
}

// DELETE /api/deals/[id] - Delete a deal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existingDeal = await prisma.deal.findUnique({ where: { id } })
    if (!existingDeal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    await prisma.deal.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting deal:', error)
    return NextResponse.json(
      { error: 'Failed to delete deal' },
      { status: 500 }
    )
  }
}
