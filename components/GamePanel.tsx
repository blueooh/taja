'use client'

import TypingGame from '@/components/TypingGame'
import AcidRain from '@/components/AcidRain'
import BattleGame from '@/components/BattleGame'
import Scoreboard from '@/components/Scoreboard'
import type { AuthUser } from '@/lib/auth'

interface Props {
  user: AuthUser | null
  onTypingScoreSubmitted: () => void
  onAcidRainScoreSubmitted: () => void
  onLogout: () => void
  onNeedAuth: () => void
  typingScoreVersion: number
  acidRainScoreVersion: number
}

export default function GamePanel({
  user,
  onTypingScoreSubmitted,
  onAcidRainScoreSubmitted,
  onLogout,
  onNeedAuth,
  typingScoreVersion,
  acidRainScoreVersion,
}: Props) {
  return (
    <div className="games-column">
      <div className="game-panel">
        <TypingGame
          user={user}
          onScoreSubmitted={onTypingScoreSubmitted}
          onLogout={onLogout}
          onNeedAuth={onNeedAuth}
        />
        <Scoreboard
          nickname={user?.nickname ?? ''}
          scoreVersion={typingScoreVersion}
          gameType="typing"
        />
      </div>
      <div className="game-panel">
        <AcidRain
          user={user}
          onScoreSubmitted={onAcidRainScoreSubmitted}
          onLogout={onLogout}
          onNeedAuth={onNeedAuth}
        />
        <Scoreboard
          nickname={user?.nickname ?? ''}
          scoreVersion={acidRainScoreVersion}
          gameType="acidrain"
        />
      </div>

      <div className="game-panel">
        <BattleGame user={user} onNeedAuth={onNeedAuth} />
      </div>
    </div>
  )
}
