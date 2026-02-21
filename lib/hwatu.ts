export type CardType = 'bright' | 'animal' | 'ribbon' | 'chaff'
export type RibbonGroup = 'hong' | 'blue' | 'grass' | 'plain'

export interface HwatuCard {
  id: number
  month: number
  type: CardType
  ribbonGroup?: RibbonGroup
  isSsangpi?: boolean
  isRainBright?: boolean
  imagePath: string
}

function card(
  id: number,
  month: number,
  type: CardType,
  file: string,
  opts?: { ribbonGroup?: RibbonGroup; isSsangpi?: boolean; isRainBright?: boolean },
): HwatuCard {
  return { id, month, type, imagePath: `/hwatu/${file}`, ...opts }
}

const m = (n: number) => String(n).padStart(2, '0')

export const HWATU_DECK: HwatuCard[] = [
  // 01월 (소나무) — bright, ribbon(홍단), pi×2
  card(0,  1, 'bright',  `${m(1)}_gwang.png`),
  card(1,  1, 'ribbon',  `${m(1)}_tti.png`,  { ribbonGroup: 'hong' }),
  card(2,  1, 'chaff',   `${m(1)}_pi1.png`),
  card(3,  1, 'chaff',   `${m(1)}_pi2.png`),

  // 02월 (매화) — animal, ribbon(홍단), pi×2
  card(4,  2, 'animal',  `${m(2)}_yul.png`),
  card(5,  2, 'ribbon',  `${m(2)}_tti.png`,  { ribbonGroup: 'hong' }),
  card(6,  2, 'chaff',   `${m(2)}_pi1.png`),
  card(7,  2, 'chaff',   `${m(2)}_pi2.png`),

  // 03월 (벚꽃) — bright, ribbon(홍단), pi×2
  card(8,  3, 'bright',  `${m(3)}_gwang.png`),
  card(9,  3, 'ribbon',  `${m(3)}_tti.png`,  { ribbonGroup: 'hong' }),
  card(10, 3, 'chaff',   `${m(3)}_pi1.png`),
  card(11, 3, 'chaff',   `${m(3)}_pi2.png`),

  // 04월 (등나무) — animal, ribbon(plain), pi×2
  card(12, 4, 'animal',  `${m(4)}_yul.png`),
  card(13, 4, 'ribbon',  `${m(4)}_tti.png`,  { ribbonGroup: 'plain' }),
  card(14, 4, 'chaff',   `${m(4)}_pi1.png`),
  card(15, 4, 'chaff',   `${m(4)}_pi2.png`),

  // 05월 (난초) — animal, ribbon(초단), pi×2
  card(16, 5, 'animal',  `${m(5)}_yul.png`),
  card(17, 5, 'ribbon',  `${m(5)}_tti.png`,  { ribbonGroup: 'grass' }),
  card(18, 5, 'chaff',   `${m(5)}_pi1.png`),
  card(19, 5, 'chaff',   `${m(5)}_pi2.png`),

  // 06월 (모란) — animal, ribbon(청단), pi×2
  card(20, 6, 'animal',  `${m(6)}_yul.png`),
  card(21, 6, 'ribbon',  `${m(6)}_tti.png`,  { ribbonGroup: 'blue' }),
  card(22, 6, 'chaff',   `${m(6)}_pi1.png`),
  card(23, 6, 'chaff',   `${m(6)}_pi2.png`),

  // 07월 (싸리) — animal, ribbon(초단), pi×2
  card(24, 7, 'animal',  `${m(7)}_yul.png`),
  card(25, 7, 'ribbon',  `${m(7)}_tti.png`,  { ribbonGroup: 'grass' }),
  card(26, 7, 'chaff',   `${m(7)}_pi1.png`),
  card(27, 7, 'chaff',   `${m(7)}_pi2.png`),

  // 08월 (공산) — bright, animal, pi×2
  card(28, 8, 'bright',  `${m(8)}_gwang.png`),
  card(29, 8, 'animal',  `${m(8)}_yul.png`),
  card(30, 8, 'chaff',   `${m(8)}_pi1.png`),
  card(31, 8, 'chaff',   `${m(8)}_pi2.png`),

  // 09월 (국화) — animal, ribbon(청단), pi×2
  card(32, 9, 'animal',  `${m(9)}_yul.png`),
  card(33, 9, 'ribbon',  `${m(9)}_tti.png`,  { ribbonGroup: 'blue' }),
  card(34, 9, 'chaff',   `${m(9)}_pi1.png`),
  card(35, 9, 'chaff',   `${m(9)}_pi2.png`),

  // 10월 (단풍) — animal, ribbon(청단), pi×2
  card(36, 10, 'animal', `${m(10)}_yul.png`),
  card(37, 10, 'ribbon', `${m(10)}_tti.png`, { ribbonGroup: 'blue' }),
  card(38, 10, 'chaff',  `${m(10)}_pi1.png`),
  card(39, 10, 'chaff',  `${m(10)}_pi2.png`),

  // 11월 (오동) — bright, animal, pi, 쌍피
  card(40, 11, 'bright', `${m(11)}_gwang.png`),
  card(41, 11, 'animal', `${m(11)}_yul.png`),
  card(42, 11, 'chaff',  `${m(11)}_pi1.png`),
  card(43, 11, 'chaff',  `${m(11)}_ssangpi.png`, { isSsangpi: true }),

  // 12월 (비) — 비광, animal, ribbon(plain), 쌍피
  card(44, 12, 'bright', `${m(12)}_gwang.png`, { isRainBright: true }),
  card(45, 12, 'animal', `${m(12)}_yul.png`),
  card(46, 12, 'ribbon', `${m(12)}_tti.png`,  { ribbonGroup: 'plain' }),
  card(47, 12, 'chaff',  `${m(12)}_ssangpi.png`, { isSsangpi: true }),
]

const CARD_MAP = new Map<number, HwatuCard>(HWATU_DECK.map(c => [c.id, c]))
export function getCard(id: number): HwatuCard {
  return CARD_MAP.get(id)!
}

export function shuffleDeck(): HwatuCard[] {
  const deck = [...HWATU_DECK]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export interface DealResult {
  hand1: HwatuCard[]
  hand2: HwatuCard[]
  field: HwatuCard[]
  remaining: HwatuCard[]
}

export function deal(deck: HwatuCard[]): DealResult {
  const d = [...deck]
  return {
    hand1: d.splice(0, 10),
    hand2: d.splice(0, 10),
    field: d.splice(0, 8),
    remaining: d,
  }
}
