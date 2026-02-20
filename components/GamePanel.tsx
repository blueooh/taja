'use client'

import TypingGame from '@/components/TypingGame'
import AcidRain from '@/components/AcidRain'
import Scoreboard from '@/components/Scoreboard'

interface Props {
  nickname: string
  onTypingScoreSubmitted: () => void
  onAcidRainScoreSubmitted: () => void
  onChangeNickname: () => void
  typingScoreVersion: number
  acidRainScoreVersion: number
}

export default function GamePanel({
  nickname,
  onTypingScoreSubmitted,
  onAcidRainScoreSubmitted,
  onChangeNickname,
  typingScoreVersion,
  acidRainScoreVersion,
}: Props) {
  return (
    <div className="games-column">
      <div className="game-panel">
        <TypingGame
          nickname={nickname}
          onScoreSubmitted={onTypingScoreSubmitted}
          onChangeNickname={onChangeNickname}
        />
        <Scoreboard nickname={nickname} scoreVersion={typingScoreVersion} gameType="typing" />
      </div>
      <div className="game-panel">
        <AcidRain
          nickname={nickname}
          onScoreSubmitted={onAcidRainScoreSubmitted}
          onChangeNickname={onChangeNickname}
        />
        <Scoreboard nickname={nickname} scoreVersion={acidRainScoreVersion} gameType="acidrain" />
      </div>
    </div>
  )
}
