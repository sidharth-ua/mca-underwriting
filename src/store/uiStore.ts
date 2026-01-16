import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  activeTab: string
  pdfViewerWidth: number
  toggleSidebar: () => void
  setActiveTab: (tab: string) => void
  setPdfViewerWidth: (width: number) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeTab: 'revenue',
      pdfViewerWidth: 400,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActiveTab: (tab: string) => set({ activeTab: tab }),
      setPdfViewerWidth: (width: number) => set({ pdfViewerWidth: width }),
    }),
    {
      name: 'ui-store',
    }
  )
)
