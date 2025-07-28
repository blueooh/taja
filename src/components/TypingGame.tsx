import React, { useState, useEffect, useRef } from 'react';
import './TypingGame.css';

interface GameResult {
  time: number;
  accuracy: number;
  wpm: number;
  date: Date;
}

const TypingGame: React.FC = () => {
  const [currentSentence, setCurrentSentence] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isGameFinished, setIsGameFinished] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [results, setResults] = useState<GameResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [errors, setErrors] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 타자 연습용 문장들
  const sentences = [
    "안녕하세요. 오늘 날씨가 정말 좋네요.",
    "프로그래밍을 배우는 것은 매우 재미있습니다.",
    "React와 TypeScript로 만든 타자 게임입니다.",
    "빠르고 정확한 타이핑을 연습해보세요.",
    "컴퓨터를 사용할 때 타자 속도가 중요합니다.",
    "한글과 영어를 모두 연습할 수 있습니다.",
    "매일 조금씩 연습하면 실력이 늘어납니다.",
    "타자 게임을 통해 재미있게 연습해보세요.",
    "정확도와 속도를 모두 고려해야 합니다.",
    "꾸준한 연습이 실력 향상의 비결입니다."
  ];

  const startGame = () => {
    const randomIndex = Math.floor(Math.random() * sentences.length);
    setCurrentSentence(sentences[randomIndex]);
    setUserInput('');
    setIsGameStarted(true);
    setIsGameFinished(false);
    setStartTime(Date.now());
    setErrors(0);
    setCurrentIndex(0);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const calculateAccuracy = (): number => {
    if (currentSentence.length === 0) return 100;
    const correctChars = currentSentence.split('').filter((char, index) => 
      userInput[index] === char
    ).length;
    return Math.round((correctChars / currentSentence.length) * 100);
  };

  const calculateWPM = (timeInSeconds: number): number => {
    const words = currentSentence.split(' ').length;
    const minutes = timeInSeconds / 60;
    return Math.round(words / minutes);
  };

  const finishGame = () => {
    const endTimeNow = Date.now();
    setEndTime(endTimeNow);
    setIsGameFinished(true);
    setIsGameStarted(false);

    const timeInSeconds = (endTimeNow - startTime) / 1000;
    const accuracy = calculateAccuracy();
    const wpm = calculateWPM(timeInSeconds);

    const newResult: GameResult = {
      time: timeInSeconds,
      accuracy,
      wpm,
      date: new Date()
    };

    setResults(prev => [newResult, ...prev]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);

    // 오류 계산
    let errorCount = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== currentSentence[i]) {
        errorCount++;
      }
    }
    setErrors(errorCount);

    // 게임 완료 체크
    if (value === currentSentence) {
      finishGame();
    }
  };

  const resetGame = () => {
    setIsGameStarted(false);
    setIsGameFinished(false);
    setUserInput('');
    setStartTime(0);
    setEndTime(0);
    setErrors(0);
    setCurrentIndex(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="typing-game">
      <div className="game-container">
        {!isGameStarted && !isGameFinished && (
          <div className="start-screen">
            <h2>타자 게임 시작</h2>
            <p>아래 버튼을 클릭하여 게임을 시작하세요!</p>
            <button onClick={startGame} className="start-button">
              게임 시작
            </button>
          </div>
        )}

        {isGameStarted && (
          <div className="game-screen">
            <div className="stats">
              <div className="stat-item">
                <span>시간: </span>
                <span>{formatTime((Date.now() - startTime) / 1000)}</span>
              </div>
              <div className="stat-item">
                <span>오류: </span>
                <span>{errors}</span>
              </div>
            </div>

            <div className="sentence-display">
              <p className="sentence-text">{currentSentence}</p>
            </div>

            <div className="input-area">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={handleInputChange}
                placeholder="여기에 타이핑하세요..."
                className="typing-input"
                disabled={isGameFinished}
              />
            </div>

            <div className="progress">
              <div 
                className="progress-bar" 
                style={{ width: `${(userInput.length / currentSentence.length) * 100}%` }}
              ></div>
            </div>

            <button onClick={resetGame} className="reset-button">
              다시 시작
            </button>
          </div>
        )}

        {isGameFinished && (
          <div className="result-screen">
            <h2>게임 완료!</h2>
            <div className="result-stats">
              <div className="result-item">
                <span>소요 시간: </span>
                <span>{formatTime(endTime - startTime)}</span>
              </div>
              <div className="result-item">
                <span>정확도: </span>
                <span>{calculateAccuracy()}%</span>
              </div>
              <div className="result-item">
                <span>WPM: </span>
                <span>{calculateWPM((endTime - startTime) / 1000)}</span>
              </div>
            </div>
            <button onClick={startGame} className="play-again-button">
              다시 플레이
            </button>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="history">
          <h3>기록</h3>
          <div className="history-list">
            {results.slice(0, 5).map((result, index) => (
              <div key={index} className="history-item">
                <span>{result.date.toLocaleDateString()}</span>
                <span>{formatTime(result.time)}</span>
                <span>{result.accuracy}%</span>
                <span>{result.wpm} WPM</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TypingGame; 