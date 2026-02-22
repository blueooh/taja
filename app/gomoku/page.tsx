'use client'

import { useApp } from '@/lib/app-context'
import GomokuGame from '@/components/GomokuGame'

export default function GomokuPage() {
  const { user, onNeedAuth } = useApp()

  if (user === undefined) return null

  return <GomokuGame user={user} onNeedAuth={onNeedAuth} />
}
