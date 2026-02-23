'use client'

import { useState, useMemo, useCallback } from 'react'

const NUM_ROWS = 12
const COL_WIDTH = 80
const ROW_HEIGHT = 38
const PADDING_X = 44
const LABEL_HEIGHT = 36

const COLORS = [
  '#1a73e8', '#ea4335', '#1e8e3e', '#f9ab00',
  '#9334e6', '#e8430a', '#0097a7', '#c62828',
]

function generateRungs(numCols: number, numRows: number): boolean[][] {
  return Array.from({ length: numRows }, () => {
    const row = new Array(numCols - 1).fill(false)
    for (let col = 0; col < numCols - 1; col++) {
      if (col === 0 || !row[col - 1]) {
        row[col] = Math.random() < 0.38
      }
    }
    return row
  })
}

// 결과 유일성 보장: 모든 참가자가 서로 다른 결과에 매핑될 때까지 재생성
function generateValidRungs(numCols: number, numRows: number): boolean[][] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rungs = generateRungs(numCols, numRows)
    const results = new Set(
      Array.from({ length: numCols }, (_, i) => getResultCol(i, numCols, rungs))
    )
    if (results.size === numCols) return rungs
  }
  return Array.from({ length: numRows }, () => new Array(numCols - 1).fill(false))
}

function tracePathPoints(startCol: number, numCols: number, rungs: boolean[][]): [number, number][] {
  const points: [number, number][] = []
  let col = startCol
  const x = () => PADDING_X + col * COL_WIDTH

  points.push([x(), LABEL_HEIGHT])

  for (let row = 0; row < rungs.length; row++) {
    const yRung = LABEL_HEIGHT + (row + 0.5) * ROW_HEIGHT
    points.push([x(), yRung])
    if (col < numCols - 1 && rungs[row][col]) {
      col++
      points.push([x(), yRung])
    } else if (col > 0 && rungs[row][col - 1]) {
      col--
      points.push([x(), yRung])
    }
  }

  points.push([x(), LABEL_HEIGHT + rungs.length * ROW_HEIGHT])
  return points
}

function getResultCol(startCol: number, numCols: number, rungs: boolean[][]): number {
  const pts = tracePathPoints(startCol, numCols, rungs)
  return Math.round((pts[pts.length - 1][0] - PADDING_X) / COL_WIDTH)
}

function calcPathLength(pts: [number, number][]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0]
    const dy = pts[i][1] - pts[i - 1][1]
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return Math.ceil(len) + 5
}

export default function LadderGame() {
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup')
  const [players, setPlayers] = useState(['홍길동', '김철수', '이영희'])
  const [prizes, setPrizes] = useState(['1등 🥇', '2등 🥈', '꼴찌 😅'])
  const [rungs, setRungs] = useState<boolean[][]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null)
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set())
  const [playerAnimKeys, setPlayerAnimKeys] = useState<Record<number, number>>({})

  const numCols = players.length

  const results = useMemo(() => {
    if (rungs.length === 0) return Array.from({ length: numCols }, (_, i) => i)
    return Array.from({ length: numCols }, (_, i) => getResultCol(i, numCols, rungs))
  }, [rungs, numCols])

  const updatePlayer = (i: number, val: string) =>
    setPlayers(prev => prev.map((p, j) => j === i ? val : p))

  const updatePrize = (i: number, val: string) =>
    setPrizes(prev => prev.map((p, j) => j === i ? val : p))

  const addPlayer = () => {
    if (players.length >= 8) return
    const n = players.length + 1
    setPlayers(prev => [...prev, `플레이어${n}`])
    setPrizes(prev => [...prev, `${n}등`])
  }

  const removePlayer = () => {
    if (players.length <= 2) return
    setPlayers(prev => prev.slice(0, -1))
    setPrizes(prev => prev.slice(0, -1))
  }

  const startGame = useCallback(() => {
    setRungs(generateValidRungs(numCols, NUM_ROWS))
    setPhase('playing')
    setSelectedPlayer(null)
    setRevealedPlayers(new Set())
    setPlayerAnimKeys({})
  }, [numCols])

  const handlePlayerClick = (i: number) => {
    setSelectedPlayer(i)
    setRevealedPlayers(prev => new Set([...prev, i]))
    setPlayerAnimKeys(prev => ({ ...prev, [i]: (prev[i] ?? 0) + 1 }))
  }

  const revealAll = () => {
    const allIdxs = players.map((_, i) => i)
    setRevealedPlayers(new Set(allIdxs))
    setSelectedPlayer(null)
    setPlayerAnimKeys(prev => {
      const next = { ...prev }
      allIdxs.forEach(i => { next[i] = (prev[i] ?? 0) + 1 })
      return next
    })
  }

  const reset = () => {
    setPhase('setup')
    setSelectedPlayer(null)
    setRevealedPlayers(new Set())
    setPlayerAnimKeys({})
  }

  const svgWidth = 2 * PADDING_X + (numCols - 1) * COL_WIDTH
  const svgHeight = LABEL_HEIGHT + NUM_ROWS * ROW_HEIGHT + LABEL_HEIGHT + 8

  if (phase === 'setup') {
    return (
      <div className="ladder-setup">
        <h2 className="ladder-title">🪜 사다리게임</h2>
        <p className="ladder-desc">참가자와 결과를 입력하고 사다리를 타세요!</p>

        <div className="ladder-count-row">
          <span className="ladder-count-label">참가자 수</span>
          <div className="ladder-count-ctrl">
            <button className="ladder-count-btn" onClick={removePlayer} disabled={players.length <= 2}>−</button>
            <span className="ladder-count-num">{players.length}</span>
            <button className="ladder-count-btn" onClick={addPlayer} disabled={players.length >= 8}>+</button>
          </div>
        </div>

        <div className="ladder-inputs">
          <div className="ladder-inputs-header">
            <span>참가자</span>
            <span />
            <span>결과</span>
          </div>
          {players.map((name, i) => (
            <div key={i} className="ladder-input-row">
              <input
                className="ladder-input"
                placeholder={`참가자 ${i + 1}`}
                value={name}
                onChange={e => updatePlayer(i, e.target.value)}
                maxLength={8}
              />
              <span className="ladder-input-arrow">→</span>
              <input
                className="ladder-input ladder-input--prize"
                placeholder={`결과 ${i + 1}`}
                value={prizes[i]}
                onChange={e => updatePrize(i, e.target.value)}
                maxLength={8}
              />
            </div>
          ))}
        </div>

        <button className="ladder-start-btn" onClick={startGame}>
          사다리 시작!
        </button>
      </div>
    )
  }

  return (
    <div className="ladder-playing">
      <h2 className="ladder-title">🪜 사다리게임</h2>

      <div className="ladder-svg-container">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="ladder-svg"
        >
          {/* 세로선 */}
          {players.map((_, i) => {
            const x = PADDING_X + i * COL_WIDTH
            return (
              <line
                key={i}
                x1={x} y1={LABEL_HEIGHT}
                x2={x} y2={LABEL_HEIGHT + NUM_ROWS * ROW_HEIGHT}
                stroke="#ccc" strokeWidth={2.5} strokeLinecap="round"
              />
            )
          })}

          {/* 가로 사다리 */}
          {rungs.map((rowRungs, row) =>
            rowRungs.map((hasRung, col) => {
              if (!hasRung) return null
              const x1 = PADDING_X + col * COL_WIDTH
              const x2 = PADDING_X + (col + 1) * COL_WIDTH
              const y = LABEL_HEIGHT + (row + 0.5) * ROW_HEIGHT
              return (
                <line
                  key={`${row}-${col}`}
                  x1={x1} y1={y} x2={x2} y2={y}
                  stroke="#ccc" strokeWidth={2.5} strokeLinecap="round"
                />
              )
            })
          )}

          {/* 경로 표시 */}
          {[...revealedPlayers].map(playerIdx => {
            const pts = tracePathPoints(playerIdx, numCols, rungs)
            const pointsStr = pts.map(([x, y]) => `${x},${y}`).join(' ')
            const pathLen = calcPathLength(pts)
            const color = COLORS[playerIdx % COLORS.length]
            const isActive = selectedPlayer === null || selectedPlayer === playerIdx
            return (
              <polyline
                key={`path-${playerIdx}-${playerAnimKeys[playerIdx] ?? 0}`}
                points={pointsStr}
                fill="none"
                stroke={color}
                strokeWidth={3.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={isActive ? 1 : 0.3}
                className="ladder-path"
                style={{ strokeDasharray: pathLen, strokeDashoffset: pathLen } as React.CSSProperties}
              />
            )
          })}

          {/* 참가자 이름 (위) */}
          {players.map((name, i) => {
            const x = PADDING_X + i * COL_WIDTH
            const isRevealed = revealedPlayers.has(i)
            const color = isRevealed ? COLORS[i % COLORS.length] : '#3c4043'
            return (
              <text
                key={i}
                x={x} y={LABEL_HEIGHT - 10}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={color}
                fontFamily="inherit"
              >
                {name || `P${i + 1}`}
              </text>
            )
          })}

          {/* 결과 라벨 (아래) */}
          {prizes.map((prize, prizeCol) => {
            const x = PADDING_X + prizeCol * COL_WIDTH
            const playerIdx = results.findIndex(r => r === prizeCol)
            const isRevealed = playerIdx !== -1 && revealedPlayers.has(playerIdx)
            const color = isRevealed ? COLORS[playerIdx % COLORS.length] : '#5f6368'
            return (
              <text
                key={prizeCol}
                x={x}
                y={LABEL_HEIGHT + NUM_ROWS * ROW_HEIGHT + 24}
                textAnchor="middle"
                fontSize={12}
                fontWeight={isRevealed ? 700 : 500}
                fill={color}
                fontFamily="inherit"
              >
                {prize || `${prizeCol + 1}등`}
              </text>
            )
          })}
        </svg>
      </div>

      {/* 참가자 버튼 */}
      <div className="ladder-player-btns">
        {players.map((name, i) => {
          const isRevealed = revealedPlayers.has(i)
          const color = COLORS[i % COLORS.length]
          const isSelected = selectedPlayer === i
          return (
            <button
              key={i}
              className={`ladder-player-btn${isRevealed ? ' ladder-player-btn--revealed' : ''}${isSelected ? ' ladder-player-btn--selected' : ''}`}
              style={isRevealed ? { borderColor: color, color, background: color + '1a' } : {}}
              onClick={() => handlePlayerClick(i)}
            >
              <span>{name || `P${i + 1}`}</span>
              {isRevealed && (
                <span className="ladder-player-prize">
                  → {prizes[results[i]] || `${results[i] + 1}등`}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="ladder-controls">
        {revealedPlayers.size < players.length && (
          <button className="ladder-reveal-btn" onClick={revealAll}>모두 공개</button>
        )}
        <button className="ladder-reset-btn" onClick={startGame}>사다리 새로 뽑기</button>
        <button className="ladder-reset-btn" onClick={reset}>다시 설정</button>
      </div>
    </div>
  )
}
