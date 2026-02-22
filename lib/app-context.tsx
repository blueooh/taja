'use client'

import { createContext, useContext } from 'react'
import type { AuthUser } from '@/lib/auth'

interface AppContextValue {
  user: AuthUser | null | undefined
  onNeedAuth: () => void
  onLogout: () => void
}

export const AppContext = createContext<AppContextValue>({
  user: undefined,
  onNeedAuth: () => {},
  onLogout: () => {},
})

export function useApp() {
  return useContext(AppContext)
}
