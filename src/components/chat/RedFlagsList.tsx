'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface RedFlag {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string
  description: string
}

interface RedFlagsListProps {
  flags: RedFlag[]
  onFlagClick?: (flag: RedFlag) => void
  className?: string
}

export function RedFlagsList({ flags, onFlagClick, className }: RedFlagsListProps) {
  const [isOpen, setIsOpen] = useState(true)

  const getSeverityConfig = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return { color: 'bg-red-600 text-white', icon: 'text-red-600' }
      case 'HIGH':
        return { color: 'bg-red-500 text-white', icon: 'text-red-500' }
      case 'MEDIUM':
        return { color: 'bg-yellow-500 text-white', icon: 'text-yellow-500' }
      case 'LOW':
        return { color: 'bg-gray-400 text-white', icon: 'text-gray-400' }
      default:
        return { color: 'bg-gray-400 text-white', icon: 'text-gray-400' }
    }
  }

  if (flags.length === 0) {
    return (
      <div className={cn('p-3 rounded-lg border bg-green-50 border-green-200', className)}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-sm">✓</span>
          </div>
          <span className="text-sm text-green-700 font-medium">No red flags detected</span>
        </div>
      </div>
    )
  }

  const criticalCount = flags.filter(f => f.severity.toUpperCase() === 'CRITICAL' || f.severity.toUpperCase() === 'HIGH').length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-red-50 border-red-200 hover:bg-red-100 transition-colors">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-700">
            Red Flags ({flags.length})
          </span>
          {criticalCount > 0 && (
            <Badge className="bg-red-600 text-white text-xs px-1.5 py-0">
              {criticalCount} critical
            </Badge>
          )}
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-red-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-red-500" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {flags.map((flag, index) => {
          const severityConfig = getSeverityConfig(flag.severity)
          return (
            <button
              key={`${flag.type}-${index}`}
              onClick={() => onFlagClick?.(flag)}
              className="w-full flex items-start gap-2 p-2 rounded-md border bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <Badge className={cn('text-xs px-1.5 py-0 shrink-0 mt-0.5', severityConfig.color)}>
                {flag.severity}
              </Badge>
              <span className="text-sm text-gray-700 flex-1">{flag.description}</span>
            </button>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
