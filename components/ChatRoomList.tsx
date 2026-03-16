'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ChatRoom } from '@/lib/chat-types'

interface ChatRoomListProps {
  onOpenRoom: (stockCode: string, stockName: string) => void
  onClose: () => void
}

export default function ChatRoomList({ onOpenRoom, onClose }: ChatRoomListProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/rooms')
      const json = await res.json()
      if (json.success) setRooms(json.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const handleLeave = async (stockCode: string) => {
    setRooms((prev) => prev.filter((r) => r.stockCode !== stockCode))
    try {
      const res = await fetch(`/api/chat/rooms/${stockCode}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) fetchRooms()
    } catch {
      fetchRooms()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card chat-room-list-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">참여 중인 톡방</h3>

        <div className="chat-room-list">
          {loading && <div className="chat-room-list-status">불러오는 중...</div>}
          {!loading && rooms.length === 0 && (
            <div className="chat-room-list-status">참여 중인 톡방이 없습니다.</div>
          )}
          {rooms.map((room) => (
            <div key={room.stockCode} className="chat-room-item">
              <div
                className="chat-room-item-info"
                onClick={() => { onOpenRoom(room.stockCode, room.stockName); onClose() }}
              >
                <span className="chat-room-item-name">{room.stockName}</span>
                <span className="chat-room-item-meta">{room.stockCode} · {room.memberCount}명</span>
              </div>
              <button
                className="chat-room-leave-btn"
                onClick={() => handleLeave(room.stockCode)}
                title="나가기"
              >
                나가기
              </button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-cancel-btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
