'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import AcidRain from '@/components/AcidRain'
import Scoreboard from '@/components/Scoreboard'

export default function AcidRainPage() {
  const { user, onNeedAuth, onLogout } = useApp()
  const [scoreVersion, setScoreVersion] = useState(0)

  if (user === undefined) return null

  return (
    <div className="game-with-scoreboard">
      <AcidRain
        user={user}
        onScoreSubmitted={() => setScoreVersion(v => v + 1)}
        onLogout={onLogout}
        onNeedAuth={onNeedAuth}
      />
      <Scoreboard
        nickname={user?.nickname ?? ''}
        scoreVersion={scoreVersion}
        gameType="acidrain"
      />
    </div>
  )
}
