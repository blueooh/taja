'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/lib/auth'
import type { ConversationItem } from '@/app/api/dm/inbox/route'

const MAX_LENGTH = 200

type ChatMode = 'inbox' | 'dm'

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
  onUnreadChange?: (hasUnread: boolean) => void
}

function sendBrowserNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.hasFocus()) return
  const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'dm-message' })
  n.onclick = () => { window.focus(); n.close() }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  return isToday
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function ChatBox({ user, onNeedAuth, isOpen, onToggle, onUnreadChange }: Props) {
  const [chatMode, setChatMode] = useState<ChatMode>('inbox')
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [dmTarget, setDmTarget] = useState('')
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([])
  const [dmLoading, setDmLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlineMembers, setOnlineMembers] = useState<string[]>([])
  const [unreadFrom, setUnreadFrom] = useState<Set<string>>(new Set())
  const [onlineDropdown, setOnlineDropdown] = useState<string | null>(null)
  const onlineDropdownRef = useRef<HTMLDivElement>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatModeRef = useRef<ChatMode>('inbox')
  const dmTargetRef = useRef('')
  const isOpenRef = useRef(isOpen)
  const nickname = user?.nickname ?? ''
  const nicknameRef = useRef(nickname)

  useEffect(() => { nicknameRef.current = nickname }, [nickname])
  useEffect(() => { chatModeRef.current = chatMode }, [chatMode])
  useEffect(() => { dmTargetRef.current = dmTarget }, [dmTarget])
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])

  useEffect(() => { onUnreadChange?.(unreadFrom.size > 0) }, [unreadFrom, onUnreadChange])

  // 채팅창 열릴 때 즉시 하단 이동
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [isOpen])

  // 새 메시지 smooth 스크롤
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: isOpen ? 'smooth' : 'auto' })
  }, [dmMessages])

  const fetchInbox = useCallback(async () => {
    if (!user) return
    setInboxLoading(true)
    try {
      const res = await fetch('/api/dm/inbox')
      const json = await res.json()
      if (json.success) setConversations(json.data)
    } catch { /* ignore */ } finally {
      setInboxLoading(false)
    }
  }, [user])

  // 채팅창 열릴 때 inbox 새로고침
  useEffect(() => {
    if (!isOpen || !user || chatMode !== 'inbox') return
    fetchInbox()
  }, [isOpen, fetchInbox, user, chatMode])

  // 온라인 멤버 Presence 추적
  useEffect(() => {
    const ch = supabase.channel('taja:online')
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ nickname: string }>()
      const members = Object.values(state).flat().map(p => p.nickname).filter(Boolean)
      setOnlineMembers([...new Set(members)])
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && user) await ch.track({ nickname: user.nickname })
    })
    return () => { supabase.removeChannel(ch) }
  }, [user])

  // DM 수신 구독
  useEffect(() => {
    if (!nickname) return
    const inbox = supabase.channel(`dm:inbox:${nickname}`)
    inbox.on('broadcast', { event: 'dm_message' }, ({ payload }) => {
      const msg = payload as DmMessage
      const isViewingThisConv =
        chatModeRef.current === 'dm' && dmTargetRef.current === msg.sender && isOpenRef.current
      if (isViewingThisConv) {
        setDmMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      } else {
        setUnreadFrom(prev => new Set([...prev, msg.sender]))
        sendBrowserNotification(`💬 ${msg.sender}`, msg.content)
      }
      setConversations(prev => [
        { partner: msg.sender, lastMessage: msg.content, lastAt: msg.created_at },
        ...prev.filter(c => c.partner !== msg.sender),
      ])
    }).subscribe()
    return () => { supabase.removeChannel(inbox) }
  }, [nickname])

  // 로그아웃 시 inbox로 복귀
  useEffect(() => {
    if (!user) { setChatMode('inbox'); setDmTarget(''); setDmMessages([]) }
  }, [user])

  const openDm = useCallback(async (targetNick: string) => {
    if (!user || targetNick === nickname) return
    setDmTarget(targetNick); dmTargetRef.current = targetNick
    setChatMode('dm'); chatModeRef.current = 'dm'
    setDmMessages([]); setInput(''); setError(null)
    setUnreadFrom(prev => { const s = new Set(prev); s.delete(targetNick); return s })
    setDmLoading(true)
    try {
      const res = await fetch(`/api/dm?with=${encodeURIComponent(targetNick)}`)
      const json = await res.json()
      if (json.success) setDmMessages(json.data)
      else setError(json.error ?? 'DM을 불러오는데 실패했습니다.')
    } catch {
      setError('DM을 불러오는데 실패했습니다.')
    } finally {
      setDmLoading(false)
    }
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [user, nickname])

  const backToInbox = useCallback(() => {
    setChatMode('inbox'); chatModeRef.current = 'inbox'
    setDmTarget(''); dmTargetRef.current = ''
    setInput(''); setError(null)
    fetchInbox()
  }, [fetchInbox])

  const handleDmSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending || !user || !dmTarget) return
    const tempId = `temp-${Date.now()}`
    const optimistic: DmMessage = {
      id: tempId, sender: nickname, receiver: dmTarget, content,
      created_at: new Date().toISOString(), isOptimistic: true,
    }
    setDmMessages(prev => [...prev, optimistic])
    setInput(''); setSending(true); setError(null)
    inputRef.current?.focus()
    try {
      const res = await fetch('/api/dm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: dmTarget, content }),
      })
      const json = await res.json()
      if (json.success) {
        setDmMessages(prev => prev.map(m => m.id === tempId ? json.data : m))
        setConversations(prev => [
          { partner: dmTarget, lastMessage: content, lastAt: new Date().toISOString() },
          ...prev.filter(c => c.partner !== dmTarget),
        ])
      } else {
        setDmMessages(prev => prev.filter(m => m.id !== tempId))
        setError(json.error ?? '전송 실패')
      }
    } catch {
      setDmMessages(prev => prev.filter(m => m.id !== tempId))
      setError('네트워크 오류로 전송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  // 온라인 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!onlineDropdown) return
    const handler = (e: MouseEvent) => {
      if (onlineDropdownRef.current && !onlineDropdownRef.current.contains(e.target as Node)) {
        setOnlineDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onlineDropdown])

  const otherOnline = onlineMembers.filter(m => m !== nickname)

  return (
    <div className="chatbox">
      {/* 헤더 */}
      <div className="chatbox-header">
        <div className="chatbox-header-left">
          {chatMode === 'dm' ? (
            <>
              <button className="chatbox-collapse-btn chatbox-collapse-btn--back" onClick={backToInbox} title="목록으로">←</button>
              <h2>{dmTarget}</h2>
              {onlineMembers.includes(dmTarget) && <span className="chatbox-online-dot" title="접속 중" />}
            </>
          ) : (
            <>
              <button className="chatbox-collapse-btn" onClick={onToggle} title="타짜톡 닫기">▶</button>
              <h2>💬 타짜톡</h2>
            </>
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      {!user ? (
        <div className="chatbox-auth-gate">
          <p>타짜톡을 이용하려면<br />로그인이 필요합니다.</p>
          <button className="chatbox-send-btn" onClick={onNeedAuth}>로그인</button>
        </div>
      ) : chatMode === 'dm' ? (
        <>
          <div className="chatbox-list" ref={listRef}>
            {dmLoading && <div className="chatbox-status">불러오는 중...</div>}
            {!dmLoading && dmMessages.length === 0 && (
              <div className="chatbox-status">{dmTarget}와의 첫 대화를 시작하세요!</div>
            )}
            {dmMessages.map(msg => {
              const isMe = msg.sender === nickname
              return (
                <div key={msg.id} className={`chatbox-msg ${isMe ? 'chatbox-msg--me' : 'chatbox-msg--other'} ${msg.isOptimistic ? 'chatbox-msg--optimistic' : ''}`}>
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
              ref={inputRef} className="chatbox-input" type="text"
              placeholder={`${dmTarget}에게 메시지...`}
              value={input} onChange={e => setInput(e.target.value)}
              maxLength={MAX_LENGTH} disabled={sending}
            />
            <button className="chatbox-send-btn" type="submit" disabled={!input.trim() || sending}>전송</button>
          </form>
        </>
      ) : (
        <div className="chatbox-inbox">
          {/* 접속 중인 멤버 */}
          {otherOnline.length > 0 && (
            <div className="chatbox-online-row">
              <span className="chatbox-online-label">접속 중</span>
              <div className="chatbox-online-members">
                {otherOnline.map(nick => (
                  <div key={nick} className="chatbox-online-wrap" ref={onlineDropdown === nick ? onlineDropdownRef : null}>
                    <button
                      className={`chatbox-online-badge${onlineDropdown === nick ? ' chatbox-online-badge--active' : ''}`}
                      onClick={() => setOnlineDropdown(prev => prev === nick ? null : nick)}
                    >
                      <span className="chatbox-online-dot" />
                      {nick}
                    </button>
                    {onlineDropdown === nick && (
                      <div className="chatbox-online-menu">
                        <button className="chatbox-online-menu-item" onClick={() => { setOnlineDropdown(null); openDm(nick) }}>
                          💬 대화하기
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 대화 목록 */}
          {inboxLoading ? (
            <div className="chatbox-status">불러오는 중...</div>
          ) : conversations.length === 0 ? (
            <div className="chatbox-status">대화 내역이 없습니다.<br />닉네임으로 먼저 말을 걸어보세요!</div>
          ) : (
            <div className="chatbox-conv-list">
              {conversations.map(conv => (
                <button key={conv.partner} className="chatbox-conv-item" onClick={() => openDm(conv.partner)}>
                  <div className="chatbox-conv-top">
                    <span className="chatbox-conv-partner">
                      {onlineMembers.includes(conv.partner) && <span className="chatbox-online-dot" />}
                      {conv.partner}
                    </span>
                    <span className="chatbox-conv-time">{formatTime(conv.lastAt)}</span>
                    {unreadFrom.has(conv.partner) && <span className="chatbox-unread-dot" />}
                  </div>
                  <div className="chatbox-conv-preview">{conv.lastMessage}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
