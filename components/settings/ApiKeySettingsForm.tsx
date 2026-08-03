'use client'

import { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, Check, Loader2, Info, Layers } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ApiKeySettingsFormProps {
  defaultGeminiKey?: string | null
  defaultGeminiKeys?: string[] | null
  defaultOpenaiKey?: string | null
  isLoading?: boolean
  onSubmit: (values: { gemini_api_key: string | null; gemini_api_keys: string[] | null; openai_api_key: string | null }) => Promise<any>
}

export function ApiKeySettingsForm({
  defaultGeminiKey = '',
  defaultGeminiKeys = [],
  defaultOpenaiKey = '',
  isLoading = false,
  onSubmit,
}: ApiKeySettingsFormProps) {
  const initialGemini = (defaultGeminiKeys && defaultGeminiKeys.length > 0)
    ? defaultGeminiKeys.join('\n')
    : defaultGeminiKey || ''

  const [geminiKeysText, setGeminiKeysText] = useState(initialGemini)
  const [openaiKey, setOpenaiKey] = useState(defaultOpenaiKey || '')
  const [showGemini, setShowGemini] = useState(false)
  const [showOpenai, setShowOpenai] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const initGem = (defaultGeminiKeys && defaultGeminiKeys.length > 0)
      ? defaultGeminiKeys.join('\n')
      : defaultGeminiKey || ''
    setGeminiKeysText(initGem)
    setOpenaiKey(defaultOpenaiKey || '')
  }, [defaultGeminiKey, defaultGeminiKeys, defaultOpenaiKey])

  const parsedGeminiKeys = geminiKeysText
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSavedSuccess(false)

    try {
      await onSubmit({
        gemini_api_key: parsedGeminiKeys[0] || null,
        gemini_api_keys: parsedGeminiKeys.length > 0 ? parsedGeminiKeys : null,
        openai_api_key: openaiKey.trim() || null,
      })
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (_err) {
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-4 sm:p-5 space-y-4 border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
          <Key className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <h3>Custom AI API Keys &amp; Multi-Key Failover</h3>
        </div>
        {parsedGeminiKeys.length > 1 && (
          <span className="text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {parsedGeminiKeys.length} Gemini Keys (Auto Failover)
          </span>
        )}
      </div>

      <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 dark:border-purple-900/40 dark:bg-purple-950/30 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
        <p className="leading-relaxed">
          Jika dikosongkan (default), sistem akan menggunakan API Key bawaan dari berkas <code className="bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded font-mono text-[11px]">.env</code>. 
          Dukungan <strong>Multiple Gemini API Keys</strong> memungkinkan fallback otomatis saat Key #1 habis kuota/Rate Limit (429).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Gemini API Keys (Multi-Key Support) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>Gemini API Keys (Multi-Key Failover)</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-normal">
              {parsedGeminiKeys.length > 0 ? `${parsedGeminiKeys.length} Key Dikirim` : 'Default (.env)'}
            </span>
          </label>
          <div className="relative">
            <textarea
              rows={3}
              placeholder={'AIzaSy_Key1...\nAIzaSy_Key2...\nAIzaSy_Key3...\n(Pisahkan dengan koma atau baris baru)'}
              value={geminiKeysText}
              onChange={(e) => setGeminiKeysText(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white p-2.5 text-xs font-mono text-zinc-900 shadow-2xs focus:border-purple-500 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-purple-500 leading-relaxed resize-y"
            />
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            💡 Masukkan beberapa Gemini API Key (pisahkan dengan koma atau baris baru). Jika Key #1 mencapai limit kuota (429), AI akan otomatis beralih ke Key #2, Key #3, dst.
          </p>
        </div>

        {/* OpenAI API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>OpenAI API Key (GPT-4o &amp; GPT-4o-mini)</span>
            <span className="text-[10px] text-zinc-400 font-normal">
              {openaiKey ? 'Custom Key Digunakan' : 'Default (.env)'}
            </span>
          </label>
          <div className="relative">
            <Input
              type={showOpenai ? 'text' : 'password'}
              placeholder="sk-proj-... (kosongkan untuk default .env)"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="pr-10 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => setShowOpenai(!showOpenai)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          {savedSuccess ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> API Key &amp; Failover Berhasil Disimpan!
            </span>
          ) : (
            <span />
          )}

          <Button type="submit" size="sm" disabled={isSubmitting || isLoading} className="gap-1.5">
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan API Keys</span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}

