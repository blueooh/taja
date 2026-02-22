'use client'

import { useApp } from '@/lib/app-context'
import BattleGame from '@/components/BattleGame'

export default function BattlePage() {
  const { user, onNeedAuth } = useApp()

  if (user === undefined) return null

  return <BattleGame user={user} onNeedAuth={onNeedAuth} />
}
