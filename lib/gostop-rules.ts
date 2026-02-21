import type { HwatuCard } from './hwatu'

export interface CapturedPile {
  brights: HwatuCard[]
  animals: HwatuCard[]
  ribbons: HwatuCard[]
  chaff: HwatuCard[]
}

export function emptyPile(): CapturedPile {
  return { brights: [], animals: [], ribbons: [], chaff: [] }
}

export function addCards(pile: CapturedPile, cards: HwatuCard[]): CapturedPile {
  const next = {
    brights: [...pile.brights],
    animals: [...pile.animals],
    ribbons: [...pile.ribbons],
    chaff: [...pile.chaff],
  }
  for (const c of cards) {
    if (c.type === 'bright') next.brights.push(c)
    else if (c.type === 'animal') next.animals.push(c)
    else if (c.type === 'ribbon') next.ribbons.push(c)
    else next.chaff.push(c)
  }
  return next
}

/** Returns field cards that match the played card's month */
export function findMatches(field: HwatuCard[], card: HwatuCard): HwatuCard[] {
  return field.filter(f => f.month === card.month)
}

/** After playing a card:
 *  - 0 matches → card goes to field (return empty, caller adds card to field)
 *  - 1 match  → take 2 cards
 *  - 2 matches → take 3 cards
 *  - 3 matches → take 4 cards (쪽)
 */
export function resolvePlay(
  field: HwatuCard[],
  card: HwatuCard,
): { taken: HwatuCard[]; newField: HwatuCard[] } {
  const matches = findMatches(field, card)
  if (matches.length === 0) {
    return { taken: [], newField: [...field, card] }
  }
  const taken = [card, ...matches]
  const matchIds = new Set(matches.map(m => m.id))
  const newField = field.filter(f => !matchIds.has(f.id))
  return { taken, newField }
}

export function calculateScore(pile: CapturedPile, peokBonus: number): number {
  let score = peokBonus

  // 광 점수
  const brightCount = pile.brights.length
  const hasRain = pile.brights.some(b => b.isRainBright)
  if (brightCount === 3) score += hasRain ? 2 : 3
  else if (brightCount === 4) score += 4
  else if (brightCount >= 5) score += 15

  // 열끗 점수
  const animalCount = pile.animals.length
  if (animalCount >= 5) score += animalCount - 4

  // 띠 점수
  const ribbonCount = pile.ribbons.length
  if (ribbonCount >= 5) score += ribbonCount - 4

  // 홍단 보너스 (01/02/03 ribbons)
  const hasHong = [1, 2, 3].every(month =>
    pile.ribbons.some(r => r.month === month && r.ribbonGroup === 'hong')
  )
  if (hasHong) score += 3

  // 청단 보너스 (06/09/10 ribbons)
  const hasBlue = [6, 9, 10].every(month =>
    pile.ribbons.some(r => r.month === month && r.ribbonGroup === 'blue')
  )
  if (hasBlue) score += 3

  // 초단 보너스 (05/07 ribbons)
  const hasGrass = [5, 7].every(month =>
    pile.ribbons.some(r => r.month === month && r.ribbonGroup === 'grass')
  )
  if (hasGrass) score += 3

  // 피 점수 (쌍피 = 2장)
  const chaffValue = pile.chaff.reduce((sum, c) => sum + (c.isSsangpi ? 2 : 1), 0)
  if (chaffValue >= 10) score += chaffValue - 9

  return score
}

/** 뻑: 낸 카드도 0매칭, 드로우 카드도 0매칭, 같은 월이면 뻑 */
export function isPeok(
  playedMatches: HwatuCard[],
  drawnMatches: HwatuCard[],
  playedCard: HwatuCard,
  drawnCard: HwatuCard,
): boolean {
  return (
    playedMatches.length === 0 &&
    drawnMatches.length === 0 &&
    playedCard.month === drawnCard.month
  )
}
