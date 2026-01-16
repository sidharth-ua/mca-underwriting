'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Dynamically import PDFViewer with SSR disabled to avoid DOMMatrix error
export const PDFViewer = dynamic(
  () => import('./PDFViewerClient').then((mod) => mod.PDFViewerClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  }
)
