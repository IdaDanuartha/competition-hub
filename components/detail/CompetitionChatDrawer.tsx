'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Send,
  Bot,
  User,
  X,
  Loader2,
  Copy,
  Check,
  FileText,
  Pin,
  Trophy,
  Users,
  Lightbulb,
  Plus,
  History,
  Trash2,
  MessageSquare,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ModelSelector } from '@/components/ui/ModelSelector'

const CHAT_MODEL_OPTIONS = [
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
  { value: 'gpt-4o', label: 'GPT-4o Flagship (OpenAI)' },
]


interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  hasPdf?: boolean
}

interface ChatSessionItem {
  id: string
  competition_id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

interface CompetitionChatDrawerProps {
  competitionId: string
  competitionName: string
}

function FormattedMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />

        const isBulletLine = /^[-*]\s+/.test(line.trim())
        const bulletContent = isBulletLine ? line.trim().replace(/^[-*]\s+/, '') : line

        const parts = bulletContent.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
        const parsedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-zinc-900 dark:text-zinc-50">
                {part.slice(2, -2)}
              </strong>
            )
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={pIdx}>{part.slice(1, -1)}</em>
          }
          return part
        })

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const headingParts = headingMatch[2].split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              )
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx}>{part.slice(1, -1)}</em>
            }
            return part
          })
          return (
            <p
              key={idx}
              className={`font-bold text-zinc-900 dark:text-zinc-50 ${level <= 2 ? 'text-[15px] mt-1' : 'text-sm'}`}
            >
              {headingParts}
            </p>
          )
        }

        if (isBulletLine) {
          return (
            <div key={idx} className="flex gap-2 items-start pl-1">
              <span className="text-emerald-500 font-bold select-none">•</span>
              <span>{parsedLine}</span>
            </div>
          )
        }

        return <p key={idx}>{parsedLine}</p>
      })}
    </div>
  )
}

const QUICK_PROMPTS = [
  { text: 'Apa saja syarat pendaftarannya?', icon: Pin, color: 'text-emerald-500' },
  { text: 'Apa kriteria penilaian & bobotnya?', icon: Trophy, color: 'text-amber-500' },
  { text: 'Berapa biaya & jumlah anggota tim?', icon: Users, color: 'text-sky-500' },
  { text: 'Berikan rekomendasi ide karya yang cocok', icon: Lightbulb, color: 'text-yellow-500' },
]

import { usePreferredModel } from '@/hooks/usePreferredModel'

export function CompetitionChatDrawer({ competitionId, competitionName }: CompetitionChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showSessionList, setShowSessionList] = useState(false)

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [preferredModel, setPreferredModel] = usePreferredModel('gemini-3.6-flash')

  const [modelStatuses, setModelStatuses] = useState<Record<string, { status: any; message: string }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Load chat sessions & active chat history from Supabase
  const loadSessionsAndMessages = async (targetSessionId?: string) => {
    try {
      const url = targetSessionId
        ? `/api/chat?competition_id=${competitionId}&session_id=${targetSessionId}`
        : `/api/chat?competition_id=${competitionId}&action=sessions`

      const res = await fetch(url)
      const data = await res.json()

      if (data.sessions) {
        setSessions(data.sessions)
      }

      if (data.activeSessionId) {
        setActiveSessionId(data.activeSessionId)
      } else if (targetSessionId) {
        setActiveSessionId(targetSessionId)
      }

      if (Array.isArray(data.messages)) {
        const restored: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at || m.timestamp || Date.now()),
          hasPdf: m.has_pdf,
        }))
        setMessages(restored)
      }
    } catch (err) {
      console.warn('[Chat History] Failed to load from Supabase:', err)
    }
  }

  useEffect(() => {
    if (competitionId && isOpen) {
      loadSessionsAndMessages()
    }
  }, [competitionId, isOpen])

  function handleModelChange(model: string) {
    setPreferredModel(model)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-chat-model', model)
    }
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    fetch('/api/ai-models-status')
      .then((res) => res.json())
      .then((data) => {
        if (data.models) setModelStatuses(data.models)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleOpenEvent = () => setIsOpen(true)
    window.addEventListener('open-ai-chat', handleOpenEvent)
    return () => window.removeEventListener('open-ai-chat', handleOpenEvent)
  }, [])

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages, isLoading, showSessionList])

  const handleNewChat = () => {
    setActiveSessionId(null)
    setMessages([])
    setShowSessionList(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSelectSession = (sessionId: string) => {
    setShowSessionList(false)
    loadSessionsAndMessages(sessionId)
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/chat?session_id=${sessionId}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        handleNewChat()
      }
    } catch (err) {
      console.warn('[Delete Session] Failed:', err)
    }
  }

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim()
    if (!queryText || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    if (!textToSend) setInput('')
    setIsLoading(true)

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competition_id: competitionId,
          session_id: activeSessionId,
          messages: apiMessages,
          preferred_model: preferredModel,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses pertanyaan.')
      }

      if (data.session_id && data.session_id !== activeSessionId) {
        setActiveSessionId(data.session_id)
        // Refresh session list to reflect new session title
        fetch(`/api/chat?competition_id=${competitionId}&action=sessions`)
          .then((r) => r.json())
          .then((d) => d.sessions && setSessions(d.sessions))
          .catch(() => {})
      }

      const botMessage: Message = {
        id: data.id || (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        hasPdf: data.has_pdf,
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (err: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Error: ${err.message || 'Gagal tersambung ke AI. Silakan coba lagi.'}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex fixed bottom-20 right-6 z-40 items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white shadow-xl hover:from-emerald-500 hover:to-teal-500 transition-all hover:scale-105 active:scale-95 group cursor-pointer"
      >
        <div className="relative">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-200"></span>
          </span>
        </div>
        <span className="text-sm font-semibold pr-1">Tanya AI Guidebook</span>
      </button>

      {/* Slide-over Drawer / Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300 overflow-hidden">
            {/* Header */}
            <div className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/90 shrink-0">
              {/* Row 1: Action Controls & Model Selector */}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {showSessionList ? (
                    <button
                      onClick={() => setShowSessionList(false)}
                      className="flex items-center gap-1 rounded-lg bg-zinc-200/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Kembali ke Chat</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setShowSessionList(true)}
                        className="relative flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 sm:px-2.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                        title="Daftar Riwayat Sesi Chat"
                      >
                        <History className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                        <span className="hidden sm:inline">Riwayat</span>
                        {sessions.length > 0 && (
                          <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                            {sessions.length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={handleNewChat}
                        title="Chat Baru"
                        className="flex items-center gap-1 rounded-lg border border-emerald-600/30 bg-emerald-50 px-2 py-1.5 sm:px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">New Chat</span>
                      </button>
                    </div>

                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <ModelSelector
                    options={CHAT_MODEL_OPTIONS}
                    selectedModel={preferredModel}
                    modelStatuses={modelStatuses as any}
                    onSelectModel={handleModelChange}
                  />

                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Competition Title Sub-bar */}
              <div className="flex items-center justify-between border-t border-zinc-200/70 bg-white px-3.5 py-1.5 dark:border-zinc-800/70 dark:bg-zinc-950 text-[11px] text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <Bot className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {competitionName}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                  AI Guidebook Assistant
                </span>
              </div>
            </div>


            {/* View: Sessions History List */}
            {showSessionList ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Daftar Percakapan ({sessions.length})
                  </h4>
                  <Button
                    size="sm"
                    onClick={handleNewChat}
                    className="h-8 rounded-lg bg-emerald-600 text-xs text-white hover:bg-emerald-500 flex items-center gap-1 px-3"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Mulai Chat Baru</span>
                  </Button>
                </div>

                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 space-y-2">
                    <MessageSquare className="h-10 w-10 stroke-1" />
                    <p className="text-xs">Belum ada riwayat percakapan untuk lomba ini.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((sess) => {
                      const isActive = sess.id === activeSessionId
                      return (
                        <div
                          key={sess.id}
                          onClick={() => handleSelectSession(sess.id)}
                          className={`group flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                            isActive
                              ? 'border-emerald-500 bg-emerald-50/70 dark:border-emerald-500/60 dark:bg-emerald-950/40'
                              : 'border-zinc-200/80 bg-zinc-50/50 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-950/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isActive
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                              }`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-semibold truncate ${
                                  isActive
                                    ? 'text-emerald-900 dark:text-emerald-100'
                                    : 'text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                {sess.title || 'Percakapan Tanpa Judul'}
                              </p>
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                {new Date(sess.updated_at).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleDeleteSession(sess.id, e)}
                            title="Hapus Sesi Chat ini"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* View: Active Chat Conversation */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8 px-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        Ada yang ingin ditanyakan tentang lomba ini?
                      </h4>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                        Saya dapat membaca metadata lomba &amp; dokumen PDF Guidebook secara langsung untuk menjawab pertanyaan Anda.
                      </p>
                    </div>

                    {/* Quick Prompts with Lucide SVG Icons */}
                    <div className="w-full space-y-2 pt-2">
                      <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-left pl-1">
                        Rekomendasi Pertanyaan:
                      </p>
                      <div className="grid grid-cols-1 gap-2 text-left">
                        {QUICK_PROMPTS.map((prompt, idx) => {
                          const IconComp = prompt.icon
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSend(prompt.text)}
                              className="rounded-xl border border-zinc-200/90 bg-zinc-50/60 p-3 text-xs text-zinc-700 hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/30 transition-all font-medium flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <IconComp className={`h-4 w-4 ${prompt.color} shrink-0`} />
                                <span className="truncate">{prompt.text}</span>
                              </div>
                              <Send className="h-3.5 w-3.5 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {m.role === 'assistant' && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm mt-1">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      <div className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                        m.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 rounded-bl-none border border-zinc-200/60 dark:border-zinc-800'
                      }`}>
                        {m.role === 'assistant' && (
                          <div className="flex items-center justify-between gap-2 border-b border-zinc-200/50 dark:border-zinc-800 pb-1.5 mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                              {m.hasPdf ? (
                                <>
                                  <FileText className="h-3 w-3" /> Berdasarkan Guidebook PDF
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3" /> AI Assistant
                                </>
                              )}
                            </span>
                            <button
                              onClick={() => handleCopy(m.id, m.content)}
                              className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors p-0.5"
                              title="Salin Pesan"
                            >
                              {copiedId === m.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        )}

                        <div className="font-sans">
                          <FormattedMarkdown content={m.content} />
                        </div>

                        <div className={`mt-1.5 text-[10px] ${m.role === 'user' ? 'text-emerald-100 text-right' : 'text-zinc-400'}`}>
                          {m.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {m.role === 'user' && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-white shadow-sm mt-1 dark:bg-zinc-700">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm mt-1">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl rounded-bl-none bg-zinc-100 px-4 py-3 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>Membaca guidebook PDF &amp; menyusun jawaban...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Bar */}
            {!showSessionList && (
              <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSend()
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Tanyakan sesuatu tentang lomba ini..."
                    disabled={isLoading}
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-emerald-500 dark:focus:bg-zinc-950 transition-all"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading || !input.trim()}
                    className="rounded-xl px-3.5 py-2.5 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
