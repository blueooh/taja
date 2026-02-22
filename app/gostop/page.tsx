'use client'

import { useApp } from '@/lib/app-context'
import GostopGame from '@/components/GostopGame'

export default function GostopPage() {
  const { user, onNeedAuth } = useApp()

  if (user === undefined) return null

  return <GostopGame user={user} onNeedAuth={onNeedAuth} />
}
