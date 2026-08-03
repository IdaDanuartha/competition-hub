'use client'

import { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, Check, Loader2, Info, Layers, Plus, Trash2, Lightbulb, ShieldCheck } from 'lucide-react'
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
  const getInitialGeminiList = (): string[] => {
    if (defaultGeminiKeys && defaultGeminiKeys.length > 0) {
      return defaultGeminiKeys.filter((k) => Boolean(k && k.trim()))
    }
    if (defaultGeminiKey && defaultGeminiKey.trim()) {
      return [defaultGeminiKey.trim()]
    }
    return ['']
  }

  const [geminiKeysList, setGeminiKeysList] = useState<string[]>(getInitialGeminiList)
  const [openaiKey, setOpenaiKey] = useState(defaultOpenaiKey || '')
  const [showGeminiList, setShowGeminiList] = useState<Record<number, boolean>>({})
  const [showOpenai, setShowOpenai] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setGeminiKeysList(getInitialGeminiList())
    setOpenaiKey(defaultOpenaiKey || '')
  }, [defaultGeminiKey, defaultGeminiKeys, defaultOpenaiKey])

  const handleUpdateGeminiKey = (index: number, value: string) => {
    setGeminiKeysList((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const handleAddGeminiKey = () => {
    setGeminiKeysList((prev) => [...prev, ''])
  }

  const handleRemoveGeminiKey = (index: number) => {
    setGeminiKeysList((prev) => {
      if (prev.length <= 1) return ['']
      return prev.filter((_, idx) => idx !== index)
    })
  }

  const toggleShowGeminiKey = (index: number) => {
    setShowGeminiList((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const validGeminiKeys = geminiKeysList.map((k) => k.trim()).filter(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSavedSuccess(false)

    try {
      await onSubmit({
        gemini_api_key: validGeminiKeys[0] || null,
        gemini_api_keys: validGeminiKeys.length > 0 ? validGeminiKeys : null,
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
    <Card className="p-4 sm:p-5 space-y-5 border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
          <Key className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <h3>Custom AI API Keys &amp; Multi-Key Failover</h3>
        </div>
        {validGeminiKeys.length > 1 && (
          <span className="text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {validGeminiKeys.length} Gemini Keys (Failover Aktif)
          </span>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-purple-200/80 bg-purple-50/60 p-3.5 dark:border-purple-900/50 dark:bg-purple-950/30 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-purple-950 dark:text-purple-100">
            Sistem Pengalihan Otomatis (Failover Engine)
          </p>
          <p className="leading-relaxed text-purple-800/90 dark:text-purple-300">
            Jika dikosongkan, sistem akan menggunakan API Key bawaan dari file <code className="bg-purple-100 dark:bg-purple-900/80 px-1 py-0.5 rounded font-mono text-[11px]">.env</code>.
            Anda dapat menambahkan beberapa API Key Gemini di bawah untuk pencegahan limit kuota.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Gemini API Keys Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
              <span>Gemini API Keys (Google AI Studio)</span>
            </label>
            <span className="text-[10px] text-zinc-400 font-normal">
              {validGeminiKeys.length > 0 ? `${validGeminiKeys.length} Key Dikirim` : 'Default (.env)'}
            </span>
          </div>

          <div className="space-y-2.5">
            {geminiKeysList.map((keyVal, idx) => {
              const isPreview = showGeminiList[idx] ?? false
              const displayVal = isPreview && keyVal.trim().length > 0
                ? (keyVal.trim().length <= 5
                  ? keyVal.trim()
                  : `••••••••••••••••${keyVal.trim().slice(-5)}`)
                : keyVal

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-0.5">
                    <span className="font-medium flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                      {idx === 0 ? 'Key #1 (Utama)' : `Key #${idx + 1} (Failover Backup ${idx})`}
                    </span>
                    {idx === 0 && validGeminiKeys.length > 1 && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Prioritas Pertama
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={isPreview ? 'text' : 'password'}
                        readOnly={isPreview}
                        placeholder={idx === 0 ? 'AIzaSy... (Key Utama)' : `AIzaSy... (Key Backup #${idx + 1})`}
                        value={displayVal}
                        onChange={(e) => handleUpdateGeminiKey(idx, e.target.value)}
                        className="pr-10 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowGeminiKey(idx)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer text-[10px] font-mono flex items-center gap-1"
                        title={isPreview ? 'Sembunyikan' : 'Intip 5 Karakter Terakhir'}
                      >
                        {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {geminiKeysList.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveGeminiKey(idx)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 shrink-0 h-9 w-9 p-0 rounded-lg"
                        title="Hapus Key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}

          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddGeminiKey}
              className="text-xs gap-1.5 border-dashed border-zinc-300 dark:border-zinc-700"
            >
              <Plus className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Tambah Gemini Key Backup</span>
            </Button>

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              Otomatis pindah key saat 429 Limit
            </span>
          </div>
        </div>

        {/* OpenAI API Key Section */}
        <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
              <span>OpenAI API Key (GPT-4o &amp; GPT-4o-mini)</span>
            </label>
            <span className="text-[10px] text-zinc-400 font-normal">
              {openaiKey ? 'Custom Key Digunakan' : 'Default (.env)'}
            </span>
          </div>
          <div className="relative">
            <Input
              type={showOpenai ? 'text' : 'password'}
              readOnly={showOpenai}
              placeholder="sk-proj-... (kosongkan untuk default .env)"
              value={
                showOpenai && openaiKey.trim().length > 0
                  ? (openaiKey.trim().length <= 5
                    ? openaiKey.trim()
                    : `••••••••••••••••${openaiKey.trim().slice(-5)}`)
                  : openaiKey
              }
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="pr-10 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => setShowOpenai(!showOpenai)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              title={showOpenai ? 'Sembunyikan' : 'Intip 5 Karakter Terakhir'}
            >
              {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>


        {/* Submit Section */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {savedSuccess ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="h-4 w-4" /> API Keys &amp; Failover Berhasil Disimpan!
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
