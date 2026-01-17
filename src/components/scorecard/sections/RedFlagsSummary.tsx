'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import type { RedFlagDetail } from '@/utils/calculations/scoringFramework'

interface RedFlagsSummaryProps {
  redFlags: RedFlagDetail[]
}

function getSeverityStyle(severity: RedFlagDetail['severity']): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-300'
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'LOW':
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

export function RedFlagsSummary({ redFlags }: RedFlagsSummaryProps) {
  if (redFlags.length === 0) return null

  // Group by severity
  const critical = redFlags.filter((f) => f.severity === 'CRITICAL')
  const high = redFlags.filter((f) => f.severity === 'HIGH')
  const medium = redFlags.filter((f) => f.severity === 'MEDIUM')
  const low = redFlags.filter((f) => f.severity === 'LOW')

  const totalDeductions = redFlags.reduce((sum, f) => sum + f.pointsDeducted, 0)

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Red Flags ({redFlags.length})
          </CardTitle>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            -{totalDeductions} points total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary by severity */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {critical.length > 0 && (
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <p className="text-xs text-gray-500">Critical</p>
              <p className="text-xl font-bold text-red-600">{critical.length}</p>
            </div>
          )}
          {high.length > 0 && (
            <div className="text-center p-2 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-500">High</p>
              <p className="text-xl font-bold text-orange-600">{high.length}</p>
            </div>
          )}
          {medium.length > 0 && (
            <div className="text-center p-2 bg-yellow-50 rounded-lg">
              <p className="text-xs text-gray-500">Medium</p>
              <p className="text-xl font-bold text-yellow-600">{medium.length}</p>
            </div>
          )}
          {low.length > 0 && (
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Low</p>
              <p className="text-xl font-bold text-gray-600">{low.length}</p>
            </div>
          )}
        </div>

        {/* Detailed list */}
        <div className="space-y-2">
          {redFlags.map((flag, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${getSeverityStyle(flag.severity)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{flag.type}</span>
                  <Badge variant="outline" className="text-xs">
                    {flag.severity}
                  </Badge>
                </div>
                <span className="text-sm font-medium">-{flag.pointsDeducted} pts</span>
              </div>
              <p className="mt-1 text-sm">{flag.description}</p>
              {flag.date && (
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(flag.date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
