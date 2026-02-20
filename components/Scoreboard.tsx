'use client'

import { useEffect, useState } from 'react'
import type { ScoreEntry } from '@/app/api/scores/route'

interface Props {
  nickname: string
  scoreVersion: number
}

const Scoreboard: React.FC<Props> = ({ nickname, scoreVersion }) => {
  const [entries, setEntries] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchScores = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/scores')
      const json = await res.json()
      if (json.success) {
        setEntries(json.data)
      } else {
        setError('스코어보드를 불러오지 못했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchScores()
  }, [scoreVersion]) // scoreVersion 변경 시 (점수 제출 후) 갱신

  const getRankClass = (rank: number) => {
    if (rank === 1) return 'rank-1'
    if (rank === 2) return 'rank-2'
    if (rank === 3) return 'rank-3'
    return 'rank-other'
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="scoreboard">
      <div className="scoreboard-header">
        <h2>🏆 스코어보드</h2>
        <button className="refresh-btn" onClick={fetchScores} disabled={loading}>
          {loading ? '로딩...' : '새로고침'}
        </button>
      </div>

      {loading && (
        <div className="skeleton-table">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-cell skeleton-rank" />
              <div className="skeleton-cell skeleton-nick" />
              <div className="skeleton-cell skeleton-wpm" />
              <div className="skeleton-cell skeleton-acc" />
              <div className="skeleton-cell skeleton-date" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && <div className="no-scores">{error}</div>}

      {!loading && !error && entries.length === 0 && (
        <div className="no-scores">아직 등록된 점수가 없습니다. 첫 번째 주인공이 되세요!</div>
      )}

      {!loading && !error && entries.length > 0 && (
        <table className="score-table">
          <thead>
            <tr>
              <th>순위</th>
              <th>닉네임</th>
              <th>WPM</th>
              <th>정확도</th>
              <th>날짜</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const rank = index + 1
              const isCurrentPlayer = entry.nickname === nickname
              return (
                <tr
                  key={entry.id}
                  className={`score-row${isCurrentPlayer ? ' current-player' : ''}`}
                >
                  <td>
                    <span className={`rank-badge ${getRankClass(rank)}`}>
                      {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                    </span>
                  </td>
                  <td>{entry.nickname}{isCurrentPlayer && ' ★'}</td>
                  <td><span className="wpm-value">{entry.wpm}</span></td>
                  <td>{entry.accuracy}%</td>
                  <td>{formatDate(entry.date)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Scoreboard
