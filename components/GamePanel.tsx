'use client'

import { useState } from 'react'
import TypingGame from '@/components/TypingGame'
import AcidRain from '@/components/AcidRain'
import BattleGame from '@/components/BattleGame'
import Scoreboard from '@/components/Scoreboard'
import type { AuthUser } from '@/lib/auth'

type Tab = 'typing' | 'acidrain' | 'battle'

const TABS: { id: Tab; label: string }[] = [
  { id: 'typing', label: '스피드' },
  { id: 'acidrain', label: '산성비' },
  { id: 'battle', label: '배틀' },
]

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
  const [activeTab, setActiveTab] = useState<Tab>('typing')

  return (
    <div className="game-card">
      <div className="game-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`game-tab${activeTab === tab.id ? ' game-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="game-tab-content">
        {activeTab === 'typing' && (
          <>
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
          </>
        )}
        {activeTab === 'acidrain' && (
          <>
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
          </>
        )}
        {activeTab === 'battle' && (
          <BattleGame user={user} onNeedAuth={onNeedAuth} />
        )}
      </div>
    </div>
  )
}
