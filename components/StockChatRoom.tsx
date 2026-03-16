'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/app-context'
import type { ChatMessage } from '@/lib/chat-types'

const MAX_LENGTH = 500

interface StockChatRoomProps {
  stockCode: string
  stockName: string
  onClose: () => void
}

export default function StockChatRoom({ stockCode, stockName, onClose }: StockChatRoomProps) {
  const { user } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const seenIds = useRef(new Set<string>())

  // 방 참여 + 메시지 로드
  useEffect(() => {
    let cancelled = false

    async function init() {
      // 방 참여 (없으면 생성)
      await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockCode, stockName }),
      })

      // 메시지 로드
      const res = await fetch(`/api/chat/rooms/${stockCode}/messages`)
      const json = await res.json()
      if (!cancelled && json.success) {
        const msgs = json.data as ChatMessage[]
        setMessages(msgs)
        for (const m of msgs) seenIds.current.add(m.id)
      }
      if (!cancelled) setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    init()
    return () => { cancelled = true }
  }, [stockCode, stockName])

  // 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${stockCode}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as ChatMessage
        if (seenIds.current.has(msg.id)) return
        seenIds.current.add(msg.id)
        setMessages((prev) => [...prev, msg])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [stockCode])

  // 자동 스크롤
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending || !user) return

    // 낙관적 업데이트
    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      roomId: '',
      userId: user.id,
      nickname: user.nickname,
      content,
      createdAt: new Date().toISOString(),
    }
    seenIds.current.add(tempId)
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setSending(true)
    setError(null)
    inputRef.current?.focus()

    try {
      const res = await fetch(`/api/chat/rooms/${stockCode}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (json.success) {
        seenIds.current.add(json.data.id)
        setMessages((prev) => prev.map((m) => m.id === tempId ? json.data : m))
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setError(json.error ?? '전송 실패')
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setError('네트워크 오류로 전송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }, [input, sending, user, stockCode])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stock-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stock-chat-header">
          <h3 className="modal-title">{stockName} 톡</h3>
          <span className="stock-chat-code">{stockCode}</span>
        </div>

        <div className="stock-chat-messages" ref={listRef}>
          {loading && <div className="stock-chat-status">불러오는 중...</div>}
          {!loading && messages.length === 0 && (
            <div className="stock-chat-status">첫 메시지를 남겨보세요!</div>
          )}
          {messages.map((msg) => {
            const isOwn = msg.userId === user?.id
            return (
              <div key={msg.id} className={`chat-msg ${isOwn ? 'chat-msg--own' : ''}`}>
                {!isOwn && <span className="chat-msg-nick">{msg.nickname}</span>}
                <div className="chat-msg-bubble">{msg.content}</div>
                <span className="chat-msg-time">
                  {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>

        {error && <div className="stock-chat-error">{error}</div>}

        <form className="stock-chat-form" onSubmit={handleSend}>
          <input
            ref={inputRef}
            className="stock-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요"
            maxLength={MAX_LENGTH}
            disabled={sending}
          />
          <button className="stock-chat-send-btn" type="submit" disabled={!input.trim() || sending}>
            전송
          </button>
        </form>
      </div>
    </div>
  )
}
