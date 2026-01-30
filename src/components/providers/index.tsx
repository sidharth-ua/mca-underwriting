'use client'

import { QueryProvider } from './QueryProvider'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster position="top-right" />
    </QueryProvider>
  )
}
