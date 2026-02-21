'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, type Message } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_MESSAGE_LENGTH = 200

type WsStatus = 'connecting' | 'connected' | 'error'
type ChatMode = 'global' | 'dm'
type ChatMessage = Message & { isOptimistic?: boolean }

interface DmMessage {
  id: string
  sender: string
  receiver: string
  content: string
  created_at: string
  isOptimistic?: boolean
}

interface Props {
  user: AuthUser | null
  onNeedAuth: () => void
  isOpen: boolean
  onToggle: () => void
}

function sendBrowserNotification(title: string, body: string) {
  if (Notification.permission !== 'granted') return
  if (document.hasFocus()) return
  const notif = new Notification(title, { body, icon: '/favicon.ico', tag: 'chat-message' })
  notif.onclick = () => { window.focus(); notif.close() }
}

export default function ChatBox({ user, onNeedAuth, isOpen, onToggle }: Props) {
  // 글로벌 채팅
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting')
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(true)

  // DM
  const [chatMode, setChatMode] = useState<ChatMode>('global')
  const [dmTarget, setDmTarget] = useState('')
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([])
  const [dmLoading, setDmLoading] = useState(false)

  // 공용
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlineMembers, setOnlineMembers] = useState<string[]>([])

  // 읽지 않은 메시지
  const [hasUnreadGlobal, setHasUnreadGlobal] = useState(false)
  const [unreadDmFrom, setUnreadDmFrom] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dmChannelRef = useRef<RealtimeChannel | null>(null)
  const chatModeRef = useRef<ChatMode>('global')
  const dmTargetRef = useRef('')
  const isOpenRef = useRef(isOpen)

  const nickname = user?.nickname ?? ''

  useEffect(() => { chatModeRef.current = chatMode }, [chatMode])
  useEffect(() => { dmTargetRef.current = dmTarget }, [dmTarget])
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])

  // 글로벌 채팅 읽으면 unread 초기화
  useEffect(() => {
    if (isOpen && chatMode === 'global') setHasUnreadGlobal(false)
  }, [isOpen, chatMode])

  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission)
  }, [])

  // 글로벌 채팅 구독
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200)
      if (error) setError('메시지를 불러오는데 실패했습니다.')
      else setMessages(data ?? [])
      setLoading(false)
    }
    fetchMessages()

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const incoming = payload.new as Message
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev
          const tempIdx = prev.findIndex(
            (m) => m.isOptimistic && m.nickname === incoming.nickname && m.content === incoming.content
          )
          if (tempIdx !== -1) {
            const next = [...prev]
            next[tempIdx] = incoming
            return next
          }
          return [...prev, incoming]
        })
        if (incoming.nickname !== nickname) {
          sendBrowserNotification(`💬 ${incoming.nickname}`, incoming.content)
          if (!isOpenRef.current || chatModeRef.current === 'dm') {
            setHasUnreadGlobal(true)
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setWsStatus('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setWsStatus('error')
        else setWsStatus('connecting')
      })

    return () => { supabase.removeChannel(channel) }
  }, [nickname])

  // 스크롤 하단 유지
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, dmMessages])

  // 접속 중인 멤버 추적 (Presence)
  useEffect(() => {
    const presenceChannel = supabase.channel('taja:online')

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ nickname: string }>()
        const members = Object.values(state)
          .flat()
          .map(p => p.nickname)
          .filter(Boolean)
        setOnlineMembers([...new Set(members)])
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await presenceChannel.track({ nickname: user.nickname })
        }
      })

    return () => { supabase.removeChannel(presenceChannel) }
  }, [user])

  // 로그아웃 시 글로벌로 복귀
  useEffect(() => {
    if (!user) closeDm()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPerm(result)
  }

  // ===== DM =====
  const openDm = async (targetNick: string) => {
    if (!user || targetNick === nickname) return

    // 기존 DM 채널 정리
    if (dmChannelRef.current) {
      supabase.removeChannel(dmChannelRef.current)
      dmChannelRef.current = null
    }

    setDmTarget(targetNick)
    dmTargetRef.current = targetNick
    setChatMode('dm')
    chatModeRef.current = 'dm'
    setDmMessages([])
    setDmLoading(true)
    setInput('')
    setError(null)
    setUnreadDmFrom(prev => prev === targetNick ? null : prev)

    // DM 기록 불러오기
    const res = await fetch(`/api/dm?with=${encodeURIComponent(targetNick)}`)
    const json = await res.json()
    if (json.success) setDmMessages(json.data)
    setDmLoading(false)

    // DM 채널 구독
    const roomId = [nickname, targetNick].sort().join(':')
    const channel = supabase.channel(`dm:${roomId}`, { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'dm_message' }, ({ payload }) => {
        setDmMessages(prev => [...prev, payload as DmMessage])
        if (!isOpenRef.current) {
          setUnreadDmFrom(targetNick)
        }
      })
      .subscribe()
    dmChannelRef.current = channel

    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const closeDm = () => {
    if (dmChannelRef.current) {
      supabase.removeChannel(dmChannelRef.current)
      dmChannelRef.current = null
    }
    setChatMode('global')
    chatModeRef.current = 'global'
    setDmTarget('')
    dmTargetRef.current = ''
    setInput('')
    setError(null)
  }

  // ===== 전송 =====
  const handleGlobalSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending || !user) return

    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId, nickname, content,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    setSending(true)
    setError(null)
    inputRef.current?.focus()

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const json = await res.json()
    if (!json.success) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setError(json.error ?? '전송 실패')
    }
    setSending(false)
  }

  const handleDmSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending || !user || !dmTarget) return

    const tempId = `temp-${Date.now()}`
    const optimistic: DmMessage = {
      id: tempId, sender: nickname, receiver: dmTarget, content,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }
    setDmMessages(prev => [...prev, optimistic])
    setInput('')
    setSending(true)
    setError(null)
    inputRef.current?.focus()

    const res = await fetch('/api/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: dmTarget, content }),
    })
    const json = await res.json()
    if (json.success) {
      setDmMessages(prev => prev.map(m => m.id === tempId ? json.data : m))
      dmChannelRef.current?.send({
        type: 'broadcast',
        event: 'dm_message',
        payload: json.data,
      })
    } else {
      setDmMessages(prev => prev.filter(m => m.id !== tempId))
      setError(json.error ?? '전송 실패')
    }
    setSending(false)
  }

  // ===== RENDER =====
  const notifButtonLabel = notifPerm === 'granted' ? '🔔' : notifPerm === 'denied' ? '🔕' : '🔔'
  const notifButtonTitle =
    notifPerm === 'granted' ? '알림 켜짐' :
    notifPerm === 'denied' ? '알림이 브라우저에서 차단됨' : '알림 켜기'

  if (!isOpen) {
    return (
      <div className="chatbox chatbox--collapsed" onClick={onToggle} title="타짜톡 펼치기">
        <div className="chatbox-strip">
          <span className="chatbox-strip-arrow">◀</span>
          <span
            className={`chatbox-ws-dot chatbox-ws-dot--${wsStatus}`}
            title={wsStatus === 'connected' ? '실시간 연결됨' : wsStatus === 'error' ? '연결 오류' : '연결 중'}
          />
          {(hasUnreadGlobal || unreadDmFrom) && (
            <span className="chatbox-unread-dot" />
          )}
          {onlineMembers.length > 0 && (
            <span className="chatbox-strip-count">{onlineMembers.length}</span>
          )}
          <span className="chatbox-strip-label">💬 타짜톡</span>
        </div>
      </div>
    )
  }

  return (
    <div className="chatbox">
      {/* 헤더 */}
      <div className="chatbox-header">
        <div className="chatbox-header-left">
          {chatMode === 'dm' ? (
            <>
              <button className="chatbox-collapse-btn chatbox-collapse-btn--back" onClick={closeDm} title="글로벌 채팅으로">
                ←
                {hasUnreadGlobal && <span className="chatbox-unread-dot chatbox-unread-dot--btn" />}
              </button>
              <h2>💬 {dmTarget}</h2>
            </>
          ) : (
            <>
              <button className="chatbox-collapse-btn" onClick={onToggle} title="타짜톡 접기">▶</button>
              <h2>💬 타짜톡</h2>
              <span
                className={`chatbox-ws-dot chatbox-ws-dot--${wsStatus}`}
                title={wsStatus === 'connected' ? '실시간 연결됨' : wsStatus === 'error' ? '연결 오류' : '연결 중'}
              />
            </>
          )}
        </div>
        <div className="chatbox-header-right">
          {user && chatMode === 'global' ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>

      {/* 접속 중인 멤버 (글로벌 모드만) */}
      {chatMode === 'global' && onlineMembers.length > 0 && (
        <div className="chatbox-members">
          {onlineMembers.map(nick => (
            <button
              key={nick}
              className={`chatbox-member-badge${nick === nickname ? ' chatbox-member-badge--me' : ''}${unreadDmFrom === nick ? ' chatbox-member-badge--unread' : ''}`}
              onClick={() => nick !== nickname && openDm(nick)}
              title={nick === nickname ? '나' : `${nick}에게 DM 보내기`}
              disabled={!user || nick === nickname}
            >
              <span className="chatbox-member-dot" />
              {nick}
              {unreadDmFrom === nick && <span className="chatbox-unread-dot chatbox-unread-dot--badge" />}
            </button>
          ))}
        </div>
      )}

      {/* 콘텐츠 */}
      {!user ? (
        <div className="chatbox-auth-gate">
          <p>타짜톡을 이용하려면<br />로그인이 필요합니다.</p>
          <button className="chatbox-send-btn" onClick={onNeedAuth}>로그인</button>
        </div>
      ) : chatMode === 'dm' ? (
        <>
          <div className="chatbox-list" ref={listRef}>
            {dmLoading && (
              <div className="chatbox-status">불러오는 중...</div>
            )}
            {!dmLoading && dmMessages.length === 0 && (
              <div className="chatbox-status">{dmTarget}와의 첫 대화를 시작하세요!</div>
            )}
            {dmMessages.map(msg => {
              const isMe = msg.sender === nickname
              return (
                <div
                  key={msg.id}
                  className={`chatbox-msg ${isMe ? 'chatbox-msg--me' : 'chatbox-msg--other'} ${msg.isOptimistic ? 'chatbox-msg--optimistic' : ''}`}
                >
                  <span className="chatbox-msg-nick">{isMe ? '나' : msg.sender}</span>
                  <div className="chatbox-bubble">{msg.content}</div>
                  <span className="chatbox-msg-time">
                    {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
          {error && <div className="chatbox-error">{error}</div>}
          <form className="chatbox-form" onSubmit={handleDmSend}>
            <input
              ref={inputRef}
              className="chatbox-input"
              type="text"
              placeholder={`${dmTarget}에게 메시지...`}
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={sending}
            />
            <button className="chatbox-send-btn" type="submit" disabled={!input.trim() || sending}>
              전송
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="chatbox-list" ref={listRef}>
            {loading && (
              <div className="chatbox-skeleton">
                {[false, true, false, false, true].map((isMe, i) => (
                  <div key={i} className={`chatbox-skeleton-msg ${isMe ? 'chatbox-skeleton-msg--me' : ''}`}>
                    <div className="chatbox-skeleton-nick" />
                    <div className="chatbox-skeleton-bubble" />
                  </div>
                ))}
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="chatbox-status">첫 메시지를 남겨보세요!</div>
            )}
            {messages.map(msg => {
              const isMe = msg.nickname === nickname
              return (
                <div
                  key={msg.id}
                  className={`chatbox-msg ${isMe ? 'chatbox-msg--me' : 'chatbox-msg--other'} ${msg.isOptimistic ? 'chatbox-msg--optimistic' : ''}`}
                >
                  <span className="chatbox-msg-nick">{msg.nickname}</span>
                  <div className="chatbox-bubble">{msg.content}</div>
                  <span className="chatbox-msg-time">
                    {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
          {error && <div className="chatbox-error">{error}</div>}
          <form className="chatbox-form" onSubmit={handleGlobalSend}>
            <input
              ref={inputRef}
              className="chatbox-input"
              type="text"
              placeholder="메시지 입력..."
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={sending}
            />
            <button className="chatbox-send-btn" type="submit" disabled={!input.trim() || sending}>
              전송
            </button>
          </form>
        </>
      )}
    </div>
  )
}
