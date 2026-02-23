// Web Audio API 기반 고스톱 효과음 (파일 없이 합성)

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

function tone(
  freq: number,
  start: number,
  duration: number,
  volume: number = 0.25,
  type: OscillatorType = 'sine',
  fadeOut = true,
) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + start)
  gain.gain.setValueAtTime(volume, c.currentTime + start)
  if (fadeOut) {
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration)
  }
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + duration)
}

// 카드 선택 (짧은 탁)
export function soundCardSelect() {
  tone(320, 0, 0.06, 0.15, 'triangle')
}

// 카드 내기 (탁 + 여운)
export function soundCardPlace() {
  tone(180, 0, 0.04, 0.3, 'square')
  tone(120, 0.02, 0.12, 0.2, 'triangle')
}

// 카드 먹기 (슥- 긁는 소리)
export function soundCardCapture() {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.18)
  gain.gain.setValueAtTime(0.2, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.18)
}

// 고 선언 (상승 3음)
export function soundGo() {
  tone(523, 0,    0.12, 0.3, 'sine') // C5
  tone(659, 0.12, 0.12, 0.3, 'sine') // E5
  tone(784, 0.24, 0.2,  0.3, 'sine') // G5
}

// 스톱 (하강 2음)
export function soundStop() {
  tone(659, 0,   0.12, 0.3, 'sine') // E5
  tone(392, 0.1, 0.25, 0.3, 'sine') // G4
}

// 승리 팡파레
export function soundWin() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    tone(freq, i * 0.1, 0.15, 0.25, 'sine')
  })
  tone(1047, 0.4, 0.5, 0.3, 'sine')
}

// 패배
export function soundLose() {
  tone(392, 0,    0.15, 0.2, 'sine') // G4
  tone(349, 0.15, 0.15, 0.2, 'sine') // F4
  tone(294, 0.3,  0.4,  0.2, 'sine') // D4
}

// 카운트다운 틱
export function soundTick() {
  tone(880, 0, 0.08, 0.2, 'square')
}

// 게임 시작
export function soundGameStart() {
  tone(523, 0,   0.1, 0.25, 'sine')
  tone(784, 0.1, 0.1, 0.25, 'sine')
  tone(1047, 0.2, 0.2, 0.3, 'sine')
}
