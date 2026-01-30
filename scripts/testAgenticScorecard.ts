/**
 * Test Script for Agentic Scorecard
 *
 * Run with: npx tsx scripts/testAgenticScorecard.ts <dealId>
 *
 * Prerequisites:
 * 1. Docker must be running (docker-compose up -d)
 * 2. Database must be seeded with deal data
 */

import 'dotenv/config'
import { generateAgenticScorecard } from '../src/lib/agentic/agenticScorecardService'

async function main() {
  const dealId = process.argv[2]

  if (!dealId) {
    console.error('Usage: npx tsx scripts/testAgenticScorecard.ts <dealId>')
    console.error('')
    console.error('To find deal IDs, check the database:')
    console.error('  npx prisma studio')
    process.exit(1)
  }

  console.log(`Generating agentic scorecard for deal: ${dealId}`)
  console.log('This may take 30-60 seconds as it calls Claude...')
  console.log('')

  try {
    const scorecard = await generateAgenticScorecard(dealId, ['revenue-stability'])

    if (scorecard.status === 'error') {
      console.error('Error:', scorecard.error)
      process.exit(1)
    }

    console.log('=== AGENTIC SCORECARD RESULT ===')
    console.log(JSON.stringify(scorecard, null, 2))

    if (scorecard.revenueStability) {
      const rs = scorecard.revenueStability
      console.log('')
      console.log('=== REVENUE STABILITY SUMMARY ===')
      console.log(`Final Score: ${rs.aggregation.finalScore}/100`)
      console.log(`Risk Rating: ${rs.aggregation.riskRating}/5`)
      console.log(`Confidence: ${rs.confidence}`)
      console.log('')
      console.log('Dimension Scores:')
      Object.entries(rs.dimensions).forEach(([key, dim]) => {
        console.log(`  ${dim.name}: ${dim.score}/100 (weight: ${dim.weight}%)`)
      })
      console.log('')
      console.log(`Red Flags (${rs.redFlags.length}):`)
      rs.redFlags.forEach((rf, i) => {
        console.log(`  ${i + 1}. [${rf.severity}] ${rf.description}`)
      })
      console.log('')
      console.log('Overall Justification:')
      console.log(`  ${rs.overallJustification}`)
    }
  } catch (error) {
    console.error('Failed to generate scorecard:', error)
    process.exit(1)
  }
}

main()
