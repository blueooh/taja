'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface QuickMsg {
  id: string
  text: string
  fromMe: boolean
  fading: boolean
}

const VISIBLE_MS = 10_000
const FADE_MS = 800
const MAX_LENGTH = 200

interface Props {
  myNickname: string
  opponentNickname: string
}

export default function GameChat({ myNickname, opponentNickname }: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<QuickMsg[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Clean up all pending timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current.clear()
    }
  }, [])

  const addMessage = useCallback((id: string, text: string, fromMe: boolean) => {
    setMessages(prev => [...prev, { id, text, fromMe, fading: false }])
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

  useEffect(() => {
    if (!myNickname || !opponentNickname) return
    const channelName = `game-quickchat:${[myNickname, opponentNickname].sort().join(':')}`
    const ch = supabase.channel(channelName)
    channelRef.current = ch
    ch.on('broadcast', { event: 'quick_chat' }, ({ payload }) => {
      const { sender, text, id } = payload as { sender: string; text: string; id: string }
      if (sender === myNickname) return
      addMessage(id, text, false)
    }).subscribe()
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [myNickname, opponentNickname, addMessage])

  // Close form on Escape key
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
    if (!content || sending || !myNickname || !channelRef.current) return
    const msgId = crypto.randomUUID()
    setInput('')
    setSending(true)
    setOpen(false)
    addMessage(msgId, content, true)
    try {
      await Promise.allSettled([
        channelRef.current.send({
          type: 'broadcast',
          event: 'quick_chat',
          payload: { sender: myNickname, text: content, id: msgId },
        }),
        fetch('/api/dm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: opponentNickname, content }),
        }),
      ])
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
    <div className="game-chat">
      <div className="game-chat-bubbles">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`game-chat-bubble${msg.fromMe ? ' game-chat-bubble--me' : ' game-chat-bubble--other'}${msg.fading ? ' game-chat-bubble--fading' : ''}`}
          >
            {msg.text}
          </div>
        ))}
      </div>
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
  )
}
