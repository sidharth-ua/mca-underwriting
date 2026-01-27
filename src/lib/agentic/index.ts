/**
 * Agentic Scorecard Module
 *
 * Exports for LLM-based qualitative assessments.
 */

// Service functions
export {
  generateRevenueStabilityScore,
  generateRevenueDurabilityScore,
  generateRevenueTrendScore,
  generateRevenueConcentrationScore,
  generateRevenueSufficiencyScore,
  generateFullAgenticScorecard,
  calculateAggregatedScore,
} from './agenticScorecardService'

// Revenue Stability prompts
export {
  REVENUE_STABILITY_SYSTEM_PROMPT,
  buildRevenueStabilityUserPrompt,
} from './revenueStabilityPrompt'

// Revenue Durability prompts
export {
  REVENUE_DURABILITY_SYSTEM_PROMPT,
  buildRevenueDurabilityUserPrompt,
} from './revenueDurabilityPrompt'

// Revenue Trend prompts
export {
  REVENUE_TREND_SYSTEM_PROMPT,
  buildRevenueTrendUserPrompt,
} from './revenueTrendPrompt'

// Revenue Concentration prompts
export {
  REVENUE_CONCENTRATION_SYSTEM_PROMPT,
  buildRevenueConcentrationUserPrompt,
} from './revenueConcentrationPrompt'

// Revenue Sufficiency prompts
export {
  REVENUE_SUFFICIENCY_SYSTEM_PROMPT,
  buildRevenueSufficiencyUserPrompt,
} from './revenueSufficiencyPrompt'
