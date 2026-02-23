'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface QuickMsg {
  id: string
  text: string
  fading: boolean
}

const VISIBLE_MS = 5_000
const FADE_MS = 800
const MAX_LENGTH = 200

interface Props {
  myUserId: string
  opponentNickname: string
  opponentId: string
}

export default function GameChat({ myUserId, opponentNickname, opponentId }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<QuickMsg[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current.clear()
    }
  }, [])

  const addMessage = useCallback((id: string, text: string) => {
    setMessages(prev => [...prev, { id, text, fading: false }])
    const t1 = setTimeout(() => {
      timersRef.current.delete(t1)
      setMessages(prev => prev.map(m => m.id === id ? { ...m, fading: true } : m))
      const t2 = setTimeout(() => {
        timersRef.current.delete(t2)
        setMessages(prev => prev.filter(m => m.id !== id))
      }, FADE_MS)
      timersRef.current.add(t2)
    }, VISIBLE_MS)
    timersRef.current.add(t1)
  }, [])

  // ChatBox의 dm:inbox 구독에서 전파된 브라우저 이벤트 수신 (중복 Supabase 채널 불필요)
  useEffect(() => {
    if (!myUserId || !opponentId) return
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as { sender_id: string; content: string; id: string }
      if (msg.sender_id !== opponentId) return
      addMessage(msg.id ?? crypto.randomUUID(), msg.content)
    }
    window.addEventListener('taja:dm', handler)
    return () => window.removeEventListener('taja:dm', handler)
  }, [myUserId, opponentId, addMessage])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending || !opponentId) return
    setInput('')
    setSending(true)
    setOpen(false)
    try {
      await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: opponentId, content }),
      })
    } finally {
      setSending(false)
    }
  }

  const toggleInput = () => {
    setOpen(v => {
      if (!v) setTimeout(() => inputRef.current?.focus(), 50)
      return !v
    })
  }

  if (!opponentNickname) return null

  return (
    <>
      {messages.length > 0 && (
        <div className="game-chat-overlay">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`game-chat-overlay-bubble${msg.fading ? ' game-chat-overlay-bubble--fading' : ''}`}
            >
              <span className="game-chat-overlay-nick">{opponentNickname}</span>
              <span className="game-chat-overlay-text">{msg.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="game-chat">
        <button className="game-chat-nick-btn" onClick={toggleInput} title="메시지 보내기">
          {opponentNickname}
        </button>
        {open && (
          <form className="game-chat-form" onSubmit={handleSend}>
            <input
              ref={inputRef}
              className="game-chat-input"
              type="text"
              placeholder={`${opponentNickname}에게...`}
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={MAX_LENGTH}
              disabled={sending}
            />
            <button className="game-chat-send-btn" type="submit" disabled={!input.trim() || sending}>
              전송
            </button>
          </form>
        )}
      </div>
    </>
  )
}
