export interface ChatRoom {
  id: string
  stockCode: string
  stockName: string
  createdAt: string
  memberCount: number
}

export interface ChatMessage {
  id: string
  roomId: string
  userId: string
  nickname: string
  content: string
  createdAt: string
}
