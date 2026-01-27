'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Database, Calendar, Cpu } from 'lucide-react'
import type { AuditTrail } from '@/types/agenticScorecard'

interface AuditTrailSectionProps {
  auditTrail?: AuditTrail
}

export function AuditTrailSection({ auditTrail }: AuditTrailSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!auditTrail) {
    return null
  }

  return (
    <div className="border-t mt-3 pt-3">
      <button
        className="w-full flex items-center justify-between text-sm text-gray-500 hover:text-gray-700"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          Audit Trail
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <Cpu className="h-3 w-3 text-gray-400" />
            <div>
              <p className="text-gray-500">Model</p>
              <p className="font-mono text-gray-700">{auditTrail.model}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <Clock className="h-3 w-3 text-gray-400" />
            <div>
              <p className="text-gray-500">Processing Time</p>
              <p className="font-mono text-gray-700">
                {(auditTrail.processingTimeMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <Database className="h-3 w-3 text-gray-400" />
            <div>
              <p className="text-gray-500">Transactions Analyzed</p>
              <p className="font-mono text-gray-700">{auditTrail.transactionCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <Calendar className="h-3 w-3 text-gray-400" />
            <div>
              <p className="text-gray-500">Date Range</p>
              <p className="font-mono text-gray-700">
                {auditTrail.dateRange.start} to {auditTrail.dateRange.end}
              </p>
            </div>
          </div>

          {auditTrail.promptTokens && auditTrail.completionTokens && (
            <div className="col-span-2 flex items-center gap-2 p-2 bg-gray-50 rounded">
              <div className="flex gap-4">
                <div>
                  <p className="text-gray-500">Prompt Tokens</p>
                  <p className="font-mono text-gray-700">{auditTrail.promptTokens.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Completion Tokens</p>
                  <p className="font-mono text-gray-700">{auditTrail.completionTokens.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
