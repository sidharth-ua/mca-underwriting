'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import type { SubsectionScore } from '@/utils/calculations/scoringFramework'

interface SubsectionGridProps {
  subsections: SubsectionScore[]
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 45) return 'text-yellow-600'
  if (score >= 30) return 'text-orange-600'
  return 'text-red-600'
}

function getRatingBg(rating: number): string {
  if (rating >= 4) return 'bg-green-50 border-green-200'
  if (rating >= 3) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

function SubsectionCard({ subsection }: { subsection: SubsectionScore }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`border rounded-lg mb-2 transition-all ${getRatingBg(subsection.rating)}`}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-gray-50/50 rounded-lg">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
              <span className="font-medium text-gray-900">{subsection.name}</span>
              <Badge variant="outline" className="text-xs">
                {Math.round(subsection.weight * 100)}%
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {subsection.redFlags && subsection.redFlags.length > 0 && (
                <Badge
                  variant="outline"
                  className="bg-red-100 text-red-700 border-red-300 text-xs"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {subsection.redFlags.length}
                </Badge>
              )}
              <span className={`text-2xl font-bold ${getScoreColor(subsection.score)}`}>
                {subsection.score}
              </span>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-gray-100">
            {/* Metrics Table */}
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Metrics
              </h4>
              <div className="space-y-2">
                {subsection.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{metric.name}</span>
                      <span className="text-xs text-gray-400">
                        ({Math.round(metric.weight * 100)}%)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{metric.formattedValue}</span>
                      {metric.interpretation && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({metric.interpretation})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Red Flags */}
            {subsection.redFlags && subsection.redFlags.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-red-600 uppercase mb-2">
                  Red Flags
                </h4>
                <div className="space-y-2">
                  {subsection.redFlags.map((flag, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-sm ${
                        flag.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : flag.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : flag.severity === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">{flag.type}</span>
                          <Badge variant="outline" className="text-xs">
                            {flag.severity}
                          </Badge>
                        </div>
                        <span className="text-xs">-{flag.pointsDeducted} pts</span>
                      </div>
                      <p className="mt-1 text-xs">{flag.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function SubsectionGrid({ subsections }: SubsectionGridProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Subsection Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {subsections.map((subsection, idx) => (
          <SubsectionCard key={idx} subsection={subsection} />
        ))}
      </CardContent>
    </Card>
  )
}
