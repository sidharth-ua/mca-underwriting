/**
 * Agentic Scorecard API Route
 *
 * Generates LLM-based qualitative assessments for deal analysis.
 * Supports all 5 revenue quality agents running in parallel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateFullAgenticScorecard } from '@/lib/agentic/agenticScorecardService'
import type { AgenticScorecardResponse, AgenticSubsectionType } from '@/types/agenticScorecard'

const ALL_SECTIONS: AgenticSubsectionType[] = [
  'revenue-stability',
  'revenue-durability',
  'revenue-trend',
  'revenue-concentration',
  'revenue-sufficiency',
]

const VALID_SECTIONS = new Set(ALL_SECTIONS)

function validateSections(sections: unknown): AgenticSubsectionType[] | null {
  if (!Array.isArray(sections)) return null

  const validSections: AgenticSubsectionType[] = []
  for (const section of sections) {
    if (typeof section === 'string' && VALID_SECTIONS.has(section as AgenticSubsectionType)) {
      validSections.push(section as AgenticSubsectionType)
    }
  }

  return validSections.length > 0 ? validSections : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<AgenticScorecardResponse>> {
  try {
    const { id: dealId } = await params

    // Parse request body for optional section selection
    let sections: AgenticSubsectionType[] = ALL_SECTIONS
    let regenerate: AgenticSubsectionType | undefined

    try {
      const body = await request.json()

      // Check for specific sections to generate
      if (body.sections) {
        const validatedSections = validateSections(body.sections)
        if (validatedSections) {
          sections = validatedSections
        }
      }

      // Check for single section regeneration
      if (body.regenerate && VALID_SECTIONS.has(body.regenerate)) {
        regenerate = body.regenerate as AgenticSubsectionType
        sections = [regenerate]
      }
    } catch {
      // No body or invalid JSON, generate all sections
    }

    // Generate agentic scorecard with requested sections
    const scorecard = await generateFullAgenticScorecard(dealId, sections)

    if (scorecard.status === 'error') {
      return NextResponse.json(
        { success: false, error: scorecard.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      scorecard,
    })
  } catch (error) {
    console.error('Agentic scorecard error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<AgenticScorecardResponse>> {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: dealId } = await params

    // Check for section query param
    const url = new URL(request.url)
    const sectionParam = url.searchParams.get('section')
    const sectionsParam = url.searchParams.get('sections')

    let sections: AgenticSubsectionType[] = ALL_SECTIONS

    if (sectionParam && VALID_SECTIONS.has(sectionParam as AgenticSubsectionType)) {
      sections = [sectionParam as AgenticSubsectionType]
    } else if (sectionsParam) {
      const requestedSections = sectionsParam.split(',')
      const validatedSections = validateSections(requestedSections)
      if (validatedSections) {
        sections = validatedSections
      }
    }

    // Generate agentic scorecard
    const scorecard = await generateFullAgenticScorecard(dealId, sections)

    if (scorecard.status === 'error') {
      return NextResponse.json(
        { success: false, error: scorecard.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      scorecard,
    })
  } catch (error) {
    console.error('Agentic scorecard error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
