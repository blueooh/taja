'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, type Message } from '@/lib/supabase'

const MAX_MESSAGE_LENGTH = 200

type WsStatus = 'connecting' | 'connected' | 'error'
type ChatMessage = Message & { isOptimistic?: boolean }

interface Props {
  nickname: string
}

function sendBrowserNotification(title: string, body: string) {
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return

  const notif = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: 'chat-message',
  })
  notif.onclick = () => {
    window.focus()
    notif.close()
  }
}

export default function ChatBox({ nickname }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting')
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPerm(Notification.permission)
    }
  }, [])

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPerm(result)
  }

  useEffect(() => {
    const fetchMessages = async () => {
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
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const incoming = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
            const tempIdx = prev.findIndex(
              (m) =>
                m.isOptimistic &&
                m.nickname === incoming.nickname &&
                m.content === incoming.content
            )
            if (tempIdx !== -1) {
              const next = [...prev]
              next[tempIdx] = incoming
              return next
            }
            return [...prev, incoming]
          })

          if (incoming.nickname !== nickname) {
            sendBrowserNotification(
              `💬 ${incoming.nickname}`,
              incoming.content
            )
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setWsStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setWsStatus('error')
        else setWsStatus('connecting')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [nickname])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return

    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      nickname,
      content,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }

    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setSending(true)
    setError(null)
    inputRef.current?.focus()

    const { error } = await supabase.from('messages').insert({ nickname, content })

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setError('전송 실패')
    }

    setSending(false)
  }

  const notifButtonLabel =
    notifPerm === 'granted' ? '🔔' :
    notifPerm === 'denied'  ? '🔕' : '🔔'

  const notifButtonTitle =
    notifPerm === 'granted' ? '알림 켜짐' :
    notifPerm === 'denied'  ? '알림이 브라우저에서 차단됨' : '알림 켜기'

  return (
    <div className="chatbox">
      <div className="chatbox-header">
        <div className="chatbox-header-left">
          <h2>💬 타짜톡</h2>
          <span
            className={`chatbox-ws-dot chatbox-ws-dot--${wsStatus}`}
            title={
              wsStatus === 'connected' ? '실시간 연결됨' :
              wsStatus === 'error' ? '연결 오류' : '연결 중'
            }
          />
        </div>
        <div className="chatbox-header-right">
          {notifPerm !== 'denied' && (
            <button
              className={`chatbox-notif-btn ${notifPerm === 'granted' ? 'chatbox-notif-btn--on' : ''}`}
              onClick={requestNotifPermission}
              title={notifButtonTitle}
              disabled={notifPerm === 'granted'}
            >
              {notifButtonLabel}
            </button>
          )}
          <span className="chatbox-badge">{nickname}</span>
        </div>
      </div>

      <div className="chatbox-list" ref={listRef}>
        {loading && <div className="chatbox-status">불러오는 중...</div>}
        {!loading && messages.length === 0 && (
          <div className="chatbox-status">첫 메시지를 남겨보세요!</div>
        )}
        {messages.map((msg) => {
          const isMe = msg.nickname === nickname
          return (
            <div
              key={msg.id}
              className={`chatbox-msg ${isMe ? 'chatbox-msg--me' : 'chatbox-msg--other'} ${msg.isOptimistic ? 'chatbox-msg--optimistic' : ''}`}
            >
              <span className="chatbox-msg-nick">{msg.nickname}</span>
              <div className="chatbox-bubble">{msg.content}</div>
              <span className="chatbox-msg-time">
                {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )
        })}
      </div>

      {error && <div className="chatbox-error">{error}</div>}

      <form className="chatbox-form" onSubmit={handleSend}>
        <input
          ref={inputRef}
          className="chatbox-input"
          type="text"
          placeholder="메시지 입력..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={sending}
        />
        <button
          className="chatbox-send-btn"
          type="submit"
          disabled={!input.trim() || sending}
        >
          전송
        </button>
      </form>
    </div>
  )
}
