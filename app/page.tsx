'use client'

import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-context'

const OFFLINE_GAMES = [
  { path: '/typing',   icon: '⌨️', name: '스피드 타자', desc: '빠르고 정확하게 타이핑해 점수를 올리세요' },
  { path: '/acidrain', icon: '🌧️', name: '산성비',       desc: '떨어지는 단어를 빠르게 입력하세요'       },
]

const ONLINE_GAMES = [
  { path: '/battle',  icon: '⚔️', name: '타자배틀',  desc: '실시간으로 타자 속도를 겨루세요'   },
  { path: '/gomoku',  icon: '⚫', name: '오목',       desc: '5개의 돌을 먼저 놓는 사람이 승리'  },
]

const RANDOM_GAMES = [
  { path: '/ladder', icon: '🪜', name: '사다리게임', desc: '참가자를 입력하고 사다리를 타서 결과를 확인하세요' },
]

export default function Home() {
  const router = useRouter()
  const { user } = useApp()

  const handleGameClick = (path: string, online: boolean) => {
    if (online && !user) {
      router.push('/login')
    } else {
      router.push(path)
    }
  }

  return (
    <div className="game-home">
      <section className="game-section">
        <h2 className="game-section-title">
          <span className="game-section-badge game-section-badge--offline">오프라인</span>
          혼자 즐기기
        </h2>
        <div className="game-grid">
          {OFFLINE_GAMES.map(game => (
            <button key={game.path} className="game-card-btn" onClick={() => handleGameClick(game.path, false)}>
              <span className="game-card-icon">{game.icon}</span>
              <span className="game-card-name">{game.name}</span>
              <span className="game-card-desc">{game.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="game-section">
        <h2 className="game-section-title">
          <span className="game-section-badge game-section-badge--online">온라인</span>
          대결하기
        </h2>
        <div className="game-grid">
          {ONLINE_GAMES.map(game => (
            <button key={game.path} className="game-card-btn" onClick={() => handleGameClick(game.path, true)}>
              <span className="game-card-icon">{game.icon}</span>
              <span className="game-card-name">{game.name}</span>
              <span className="game-card-desc">{game.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="game-section">
        <h2 className="game-section-title">
          <span className="game-section-badge game-section-badge--random">랜덤</span>
          같이 즐기기
        </h2>
        <div className="game-grid">
          {RANDOM_GAMES.map(game => (
            <button key={game.path} className="game-card-btn" onClick={() => handleGameClick(game.path, false)}>
              <span className="game-card-icon">{game.icon}</span>
              <span className="game-card-name">{game.name}</span>
              <span className="game-card-desc">{game.desc}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
