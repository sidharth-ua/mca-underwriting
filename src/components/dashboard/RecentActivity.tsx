'use client'

import Link from 'next/link'
import {
  FileText,
  Upload,
  CheckCircle,
  XCircle,
  HelpCircle,
  User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Activity {
  id: string
  action: string
  details?: string | null
  createdAt: string
  deal?: {
    id: string
    merchantName: string
  } | null
  user?: {
    name?: string | null
    email: string
  } | null
}

interface RecentActivityProps {
  activities: Activity[]
}

const actionIcons: Record<string, { icon: typeof FileText; color: string }> = {
  CREATED: { icon: FileText, color: 'text-blue-500 bg-blue-100' },
  DOCUMENT_UPLOADED: { icon: Upload, color: 'text-purple-500 bg-purple-100' },
  DOCUMENT_PROCESSED: { icon: CheckCircle, color: 'text-green-500 bg-green-100' },
  APPROVED: { icon: CheckCircle, color: 'text-green-500 bg-green-100' },
  DECLINED: { icon: XCircle, color: 'text-red-500 bg-red-100' },
  MORE_INFO: { icon: HelpCircle, color: 'text-yellow-500 bg-yellow-100' },
  UPDATED: { icon: FileText, color: 'text-gray-500 bg-gray-100' },
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => {
                const iconConfig = actionIcons[activity.action] || actionIcons.UPDATED
                const Icon = iconConfig.icon

                return (
                  <div key={activity.id} className="flex gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${iconConfig.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">
                          {activity.user?.name || activity.user?.email || 'System'}
                        </span>{' '}
                        {activity.action.toLowerCase().replace(/_/g, ' ')}
                        {activity.deal && (
                          <>
                            {' '}
                            <Link
                              href={`/deals/${activity.deal.id}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {activity.deal.merchantName}
                            </Link>
                          </>
                        )}
                      </p>
                      {activity.details && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {activity.details}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatTimeAgo(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No recent activity</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
