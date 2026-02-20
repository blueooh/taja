'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, type Message } from '@/lib/supabase'
import Link from 'next/link'

const NICKNAME_REGEX = /^[a-zA-Z0-9가-힣_]{1,20}$/
const STORAGE_KEY = 'taja:nickname'
const MAX_MESSAGE_LENGTH = 200

export default function ChatPage() {
  const [nickname, setNickname] = useState<string | null>(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && NICKNAME_REGEX.test(saved)) {
      setNickname(saved)
    }
  }, [])

  useEffect(() => {
    if (!nickname) return

    const fetchMessages = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) {
        setError('메시지를 불러오는데 실패했습니다.')
      } else {
        setMessages(data ?? [])
      }
      setLoading(false)
    }

    fetchMessages()

    const channel = supabase
      .channel('messages-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [nickname])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nicknameInput.trim()
    if (NICKNAME_REGEX.test(trimmed)) {
      localStorage.setItem(STORAGE_KEY, trimmed)
      setNickname(trimmed)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || !nickname || sending) return

    setSending(true)
    setError(null)

    const { error } = await supabase
      .from('messages')
      .insert({ nickname, content })

    if (error) {
      setError('메시지 전송에 실패했습니다.')
    } else {
      setInput('')
      inputRef.current?.focus()
    }

    setSending(false)
  }

  const isValidNickname = NICKNAME_REGEX.test(nicknameInput.trim())

  if (!nickname) {
    return (
      <div className="nickname-screen">
        <div className="nickname-card">
          <h1>타짜톡</h1>
          <p>닉네임을 입력하고 채팅에 참여하세요!</p>
          <form onSubmit={handleNicknameSubmit}>
            <input
              className="nickname-input"
              type="text"
              placeholder="닉네임 입력..."
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={20}
              autoFocus
            />
            {nicknameInput.length > 0 && !isValidNickname && (
              <p style={{ color: '#dc3545', fontSize: '0.82rem', marginBottom: '8px' }}>
                한글, 영문, 숫자, 밑줄(_)만 사용 가능합니다.
              </p>
            )}
            <button
              className="nickname-submit-btn"
              type="submit"
              disabled={!isValidNickname}
            >
              입장하기
            </button>
          </form>
          <Link href="/" style={{ display: 'block', marginTop: '16px', color: '#888', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← 타자 게임으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-header-left">
            <Link href="/" className="back-link">← 타자 게임</Link>
            <h1>💬 타짜톡</h1>
          </div>
          <div className="chat-user-badge">{nickname}</div>
        </div>

        <div className="chat-list" ref={listRef}>
          {loading && (
            <div className="chat-loading">메시지 불러오는 중...</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="chat-empty">첫 메시지를 남겨보세요!</div>
          )}
          {messages.map((msg) => {
            const isMe = msg.nickname === nickname
            return (
              <div key={msg.id} className={`chat-message ${isMe ? 'chat-message--me' : 'chat-message--other'}`}>
                {!isMe && (
                  <span className="chat-message-nick">{msg.nickname}</span>
                )}
                <div className="chat-bubble">{msg.content}</div>
                <span className="chat-message-time">
                  {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="chat-error">{error}</div>
        )}

        <form className="chat-input-form" onSubmit={handleSend}>
          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            placeholder="메시지를 입력하세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={sending}
            autoFocus
          />
          <button
            className="chat-send-btn"
            type="submit"
            disabled={!input.trim() || sending}
          >
            {sending ? '...' : '전송'}
          </button>
        </form>
      </div>
    </div>
  )
}
