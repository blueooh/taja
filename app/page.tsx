'use client'

import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-context'

const GAMES = [
  { path: '/typing',   icon: '⌨️', name: '스피드 타자', desc: '빠르고 정확하게 타이핑해 점수를 올리세요' },
  { path: '/acidrain', icon: '🌧️', name: '산성비',       desc: '떨어지는 단어를 빠르게 입력하세요'       },
  { path: '/battle',   icon: '⚔️', name: '1:1 배틀',    desc: '실시간으로 타자 속도를 겨루세요'          },
  { path: '/gomoku',   icon: '⚫', name: '오목',         desc: '5개의 돌을 먼저 놓는 사람이 승리'        },
  { path: '/gostop',   icon: '🎴', name: '고스톱',       desc: '화투로 즐기는 전통 고스톱 대결'          },
]

export default function Home() {
  const router = useRouter()
  const { user } = useApp()

  const handleGameClick = (path: string) => {
    if (!user) {
      router.push('/login')
    } else {
      router.push(path)
    }
  }

  return (
    <div className="game-home">
      <div className="game-grid">
        {GAMES.map(game => (
          <button key={game.path} className="game-card-btn" onClick={() => handleGameClick(game.path)}>
            <span className="game-card-icon">{game.icon}</span>
            <span className="game-card-name">{game.name}</span>
            <span className="game-card-desc">{game.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
