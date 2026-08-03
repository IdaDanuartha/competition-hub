'use client'

import { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, Check, Loader2, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ApiKeySettingsFormProps {
  defaultGeminiKey?: string | null
  defaultOpenaiKey?: string | null
  isLoading?: boolean
  onSubmit: (values: { gemini_api_key: string | null; openai_api_key: string | null }) => Promise<any>
}

export function ApiKeySettingsForm({
  defaultGeminiKey = '',
  defaultOpenaiKey = '',
  isLoading = false,
  onSubmit,
}: ApiKeySettingsFormProps) {
  const [geminiKey, setGeminiKey] = useState(defaultGeminiKey || '')
  const [openaiKey, setOpenaiKey] = useState(defaultOpenaiKey || '')
  const [showGemini, setShowGemini] = useState(false)
  const [showOpenai, setShowOpenai] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setGeminiKey(defaultGeminiKey || '')
    setOpenaiKey(defaultOpenaiKey || '')
  }, [defaultGeminiKey, defaultOpenaiKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSavedSuccess(false)

    try {
      await onSubmit({
        gemini_api_key: geminiKey.trim() || null,
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
      <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
        <Key className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <h3>Custom AI API Keys</h3>
      </div>

      <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 dark:border-purple-900/40 dark:bg-purple-950/30 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
        <p className="leading-relaxed">
          Jika dikosongkan (default), sistem akan menggunakan API Key bawaan dari berkas <code className="bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded font-mono text-[11px]">.env</code>. 
          Anda dapat memasukkan API Key pribadi jika ingin mengontrol kuota &amp; penggunaan secara independen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Gemini API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Gemini API Key (Google AI Studio)</span>
            <span className="text-[10px] text-zinc-400 font-normal">
              {geminiKey ? 'Custom Key Digunakan' : 'Default (.env)'}
            </span>
          </label>
          <div className="relative">
            <Input
              type={showGemini ? 'text' : 'password'}
              placeholder="AIzaSy... (kosongkan untuk default .env)"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="pr-10 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => setShowGemini(!showGemini)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
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
              <Check className="h-3.5 w-3.5" /> API Key Berhasil Disimpan!
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
              <span>Simpan API Key</span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
