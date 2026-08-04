'use client'

import { useState, useEffect } from 'react'
import { Send, Loader2, CheckCircle2, AlertCircle, QrCode, Wifi, WifiOff, RefreshCw, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { settingsSchema } from '@/lib/validation'

const OFFSET_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '1 day', minutes: 1440 },
  { label: '3 days', minutes: 4320 },
  { label: '1 week', minutes: 10080 },
]

interface WhatsAppSettingsFormProps {
  defaultNumber: string
  defaultOffsets: number[]
  isLoading?: boolean
  onSubmit: (values: { whatsapp_number: string; default_reminder_offsets_minutes: number[] }) => void | Promise<any>
}

interface FonnteDeviceState {
  loading: boolean
  connected: boolean
  device?: string | null
  name?: string | null
  quota?: string | null
  package?: string | null
  expired?: string | null
  error?: string | null
}

export function WhatsAppSettingsForm({ defaultNumber, defaultOffsets, isLoading = false, onSubmit }: WhatsAppSettingsFormProps) {
  const [number, setNumber] = useState(defaultNumber)
  const [offsets, setOffsets] = useState<number[]>(defaultOffsets)
  const [error, setError] = useState<string | null>(null)
  const [localSubmitting, setLocalSubmitting] = useState(false)

  const [testLoading, setTestLoading] = useState(false)
  const [testSuccess, setTestSuccess] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  // Fonnte device status state
  const [deviceState, setDeviceState] = useState<FonnteDeviceState>({
    loading: true,
    connected: false,
  })

  // QR Modal state
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)

  async function checkDeviceStatus() {
    setDeviceState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch('/api/fonnte-device', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setDeviceState({ loading: false, connected: false, error: data.error || 'Gagal mengecek status Fonnte' })
        return false
      } else {
        const isConn = data.connected ?? false
        setDeviceState({
          loading: false,
          connected: isConn,
          device: data.device,
          name: data.name,
          quota: data.quota,
          package: data.package,
          expired: data.expired,
        })
        return isConn
      }
    } catch (e: any) {
      setDeviceState({ loading: false, connected: false, error: e?.message || 'Gagal terhubung ke Fonnte' })
      return false
    }
  }

  async function fetchQrCode() {
    setQrLoading(true)
    setQrError(null)
    try {
      const res = await fetch('/api/fonnte-qr', { cache: 'no-store' })
      const data = await res.json()
      if (data.qrUrl) {
        setQrUrl(data.qrUrl)
      } else if (data.reason === 'device already connect') {
        setShowQrModal(false)
        checkDeviceStatus()
      } else {
        setQrError(data.reason || 'Gagal mengambil QR Code dari Fonnte. Silakan coba lagi.')
      }
    } catch {
      setQrError('Terjadi kesalahan jaringan saat mengambil QR Code.')
    } finally {
      setQrLoading(false)
    }
  }

  function handleOpenQrModal() {
    setShowQrModal(true)
    fetchQrCode()
  }

  useEffect(() => {
    checkDeviceStatus()
  }, [])

  // Auto poll device status every 4 seconds while QR modal is open
  useEffect(() => {
    if (!showQrModal) return
    const interval = setInterval(async () => {
      const isConnected = await checkDeviceStatus()
      if (isConnected) {
        setShowQrModal(false)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [showQrModal])

  function toggleOffset(minutes: number) {
    setOffsets((prev) => (prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = settingsSchema.safeParse({
      whatsapp_number: number,
      default_reminder_offsets_minutes: offsets,
      rundown_generation_mode: 'auto',
    })
    if (!result.success) {
      setError(result.error.issues.find((i) => i.path[0] === 'whatsapp_number')?.message ?? 'Invalid settings')
      return
    }
    setError(null)
    setLocalSubmitting(true)
    try {
      await onSubmit({ whatsapp_number: number, default_reminder_offsets_minutes: offsets })
    } finally {
      setLocalSubmitting(false)
    }
  }

  async function handleSendTest() {
    if (testLoading) return
    setTestLoading(true)
    setTestSuccess(null)
    setTestError(null)

    try {
      const res = await fetch('/api/test-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: number }),
      })
      const data = await res.json()

      if (!res.ok) {
        setTestError(data.error || 'Gagal mengirim pesan uji coba.')
      } else {
        const queueId = data.fonnteResponse?.id?.[0] ? ` (Queue ID: ${data.fonnteResponse.id[0]})` : ''
        setTestSuccess(`${data.message || 'Pesan uji coba berhasil dikirim!'}${queueId}`)
      }
    } catch {
      setTestError('Terjadi kesalahan jaringan saat mencoba mengirim WA.')
    } finally {
      setTestLoading(false)
    }
  }

  const isSaving = isLoading || localSubmitting

  return (
    <div className="space-y-5">
      {/* Fonnte Device Status Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Status Device WhatsApp (Fonnte)</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={checkDeviceStatus}
            disabled={deviceState.loading}
            className="h-8 px-2 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${deviceState.loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>

        {deviceState.loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengecek status koneksi Fonnte...
          </div>
        ) : deviceState.connected ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Wifi className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Terhubung (Online)</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Ready
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-emerald-600/90 dark:text-emerald-400/90">
                    Device: <span className="font-semibold">{deviceState.device || '-'}</span> {deviceState.name ? `(${deviceState.name})` : ''} • Sisa Kuota: <span className="font-semibold">{deviceState.quota || '-'} pesan</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0">
                  <WifiOff className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">WhatsApp Disconnected / Belum Terhubung</span>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-400/90">
                    {deviceState.error || 'Device Fonnte belum terhubung ke WhatsApp. Silakan scan QR code untuk menghubungkan.'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleOpenQrModal}
                className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                <QrCode className="h-4 w-4" />
                Scan QR Code WA
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal Overlay */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-3">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Scan QR Code WhatsApp</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Buka WhatsApp di HP kamu &gt; Perangkat Tertaut (Linked Devices) &gt; Tautkan Perangkat (Link a Device) &gt; Arahkan kamera ke QR Code berikut.
              </p>
            </div>

            <div className="my-5 flex flex-col items-center justify-center min-h-[220px] rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  Memuat QR Code dari Fonnte...
                </div>
              ) : qrError ? (
                <div className="text-center px-4">
                  <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">{qrError}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={fetchQrCode} className="mt-3 text-xs">
                    Coba Lagi
                  </Button>
                </div>
              ) : qrUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={qrUrl}
                    alt="WhatsApp QR Code"
                    className="h-52 w-52 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menunggu kamu scan... (Halaman akan otomatis terhubung)
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs text-zinc-500">
                  QR Code tidak tersedia.
                  <Button type="button" variant="secondary" size="sm" onClick={fetchQrCode} className="mt-2 text-xs">
                    Muat Ulang QR Code
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowQrModal(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <label htmlFor="whatsapp-number" className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
            WhatsApp number
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="whatsapp-number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="62812xxxxxxx"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleSendTest}
              disabled={testLoading || !number}
              className="shrink-0 gap-1.5"
            >
              {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Test WA
            </Button>
          </div>
          {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {testSuccess && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {testSuccess}
            </p>
          )}
          {testError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {testError}
            </p>
          )}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Default reminder offsets
          </span>
          <div className="flex flex-wrap gap-2">
            {OFFSET_OPTIONS.map((opt) => {
              const active = offsets.includes(opt.minutes)
              return (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => toggleOffset(opt.minutes)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                  }`}
                >
                  {active ? '✓ ' : ''}{opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Button type="submit" size="sm" isLoading={isSaving}>
            Save WhatsApp settings
          </Button>
        </div>
      </form>
    </div>
  )
}
