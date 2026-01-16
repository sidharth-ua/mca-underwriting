'use client'

import { SessionProvider } from './SessionProvider'
import { QueryProvider } from './QueryProvider'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        {children}
        <Toaster position="top-right" />
      </QueryProvider>
    </SessionProvider>
  )
}
