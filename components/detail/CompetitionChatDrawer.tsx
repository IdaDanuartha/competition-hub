'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Bot, User, X, Loader2, RefreshCw, Copy, Check, FileText, Pin, Trophy, Users, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ModelSelector } from '@/components/ui/ModelSelector'

const CHAT_MODEL_OPTIONS = [
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  hasPdf?: boolean
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

        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
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

        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
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

export function CompetitionChatDrawer({ competitionId, competitionName }: CompetitionChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [preferredModel, setPreferredModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai-chat-model') || 'gemini-3.6-flash'
    }
    return 'gemini-3.6-flash'
  })
  const [modelStatuses, setModelStatuses] = useState<Record<string, { status: any; message: string }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
  }, [isOpen, messages, isLoading])

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
          messages: apiMessages,
          preferred_model: preferredModel,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses pertanyaan.')
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
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

  const handleClearHistory = () => {
    setMessages([])
  }

  return (
    <>
      {/* Floating Action Button (Only visible on Desktop/Tablet, positioned above Install toast) */}
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
          <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                    Asisten AI Guidebook
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {competitionName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Custom Model Selector */}
                <ModelSelector
                  options={CHAT_MODEL_OPTIONS}
                  selectedModel={preferredModel}
                  modelStatuses={modelStatuses as any}
                  onSelectModel={handleModelChange}
                />

                {messages.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    title="Bersihkan Percakapan"
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Chat Body */}
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

            {/* Input Bar */}
            <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
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
          </div>
        </div>
      )}
    </>
  )
}
