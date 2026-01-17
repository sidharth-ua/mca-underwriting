/**
 * Chat History API Route
 * GET: Retrieve chat history for a deal
 * POST: Save new chat messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params

    // Verify deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId }
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Get chat history
    const messages = await prisma.chatMessage.findMany({
      where: { dealId },
      orderBy: { timestamp: 'asc' }
    })

    return NextResponse.json(
      messages.map(m => ({
        id: m.id,
        role: m.role.toLowerCase(),
        content: m.content,
        timestamp: m.timestamp
      }))
    )
  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params
    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array required' },
        { status: 400 }
      )
    }

    // Verify deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId }
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Save messages
    const savedMessages = await prisma.chatMessage.createMany({
      data: messages.map((m: { role: string; content: string; timestamp?: string }) => ({
        dealId,
        role: m.role.toUpperCase() as 'USER' | 'ASSISTANT',
        content: m.content,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
      }))
    })

    return NextResponse.json({ saved: savedMessages.count })
  } catch (error) {
    console.error('Error saving chat history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params

    // Delete all chat messages for this deal
    await prisma.chatMessage.deleteMany({
      where: { dealId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
