'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DateTimePickerProps {
  id?: string
  value?: string | null
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
]

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const QUICK_TIME_PRESETS = [
  '09:00',
  '12:00',
  '15:00',
  '17:00',
  '20:00',
  '23:59',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = 'Pilih tanggal & waktu...',
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse initial date & time from incoming YYYY-MM-DDTHH:mm or ISO string
  const parseVal = (valStr?: string | null) => {
    if (!valStr || valStr.trim() === '') return { dateStr: '', timeStr: '23:59' }
    try {
      const d = new Date(valStr)
      if (isNaN(d.getTime())) return { dateStr: '', timeStr: '23:59' }
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`
      return { dateStr, timeStr }
    } catch {
      return { dateStr: '', timeStr: '23:59' }
    }
  }

  const currentParsed = parseVal(value)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(currentParsed.dateStr)
  const [selectedTimeStr, setSelectedTimeStr] = useState<string>(currentParsed.timeStr)

  // Calendar navigation month/year state
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (currentParsed.dateStr) {
      const parts = currentParsed.dateStr.split('-')
      return new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
    }
    return new Date()
  })

  // Sync internal state when external value prop changes
  useEffect(() => {
    const parsed = parseVal(value)
    setSelectedDateStr(parsed.dateStr)
    setSelectedTimeStr(parsed.timeStr || '23:59')
    if (parsed.dateStr) {
      const parts = parsed.dateStr.split('-')
      setViewDate(new Date(Number(parts[0]), Number(parts[1]) - 1, 1))
    }
  }, [value])

  // Close popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Emit updated ISO format string (YYYY-MM-DDTHH:mm) to parent onChange
  const emitChange = (dateStr: string, timeStr: string) => {
    if (!dateStr) {
      onChange('')
      return
    }
    const t = timeStr || '23:59'
    onChange(`${dateStr}T${t}`)
  }

  const handleDateSelect = (dateStr: string) => {
    setSelectedDateStr(dateStr)
    emitChange(dateStr, selectedTimeStr)
  }

  const handleTimeSelect = (timeStr: string) => {
    setSelectedTimeStr(timeStr)
    if (selectedDateStr) {
      emitChange(selectedDateStr, timeStr)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDateStr('')
    setSelectedTimeStr('23:59')
    onChange('')
  }

  // Preset shortcuts
  const applyPreset = (preset: 'today' | 'tomorrow' | 'plus7') => {
    const now = new Date()
    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (preset === 'tomorrow') {
      target.setDate(target.getDate() + 1)
    } else if (preset === 'plus7') {
      target.setDate(target.getDate() + 7)
    }

    const dStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
    const tStr = '23:59'
    setSelectedDateStr(dStr)
    setSelectedTimeStr(tStr)
    setViewDate(new Date(target.getFullYear(), target.getMonth(), 1))
    emitChange(dStr, tStr)
  }

  // Format label for display trigger
  const getDisplayText = () => {
    if (!selectedDateStr) return null
    try {
      const parts = selectedDateStr.split('-')
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      const dayOfWeek = DAY_NAMES[d.getDay()]
      const dayNum = d.getDate()
      const monthName = MONTH_SHORT[d.getMonth()]
      const year = d.getFullYear()
      return `${dayOfWeek}, ${dayNum} ${monthName} ${year} • ${selectedTimeStr}`
    } catch {
      return selectedDateStr
    }
  }

  // Calendar Grid Calculations
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const prevMonthPadding = Array.from({ length: firstDayOfMonth }, (_, i) => prevMonthDays - firstDayOfMonth + 1 + i)
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const totalCellsSoFar = prevMonthPadding.length + currentMonthDays.length
  const nextMonthPadding = Array.from({ length: (42 - totalCellsSoFar) % 7 }, (_, i) => i + 1)

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const [hours, minutes] = selectedTimeStr.split(':')

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      <input type="hidden" id={id} value={value || ''} readOnly />

      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-xs font-medium transition-all cursor-pointer select-none dark:bg-zinc-950',
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/20 dark:border-purple-400'
            : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
          disabled && 'opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900',
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
          {selectedDateStr ? (
            <span className="truncate text-zinc-900 dark:text-zinc-100 font-semibold">
              {getDisplayText()}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {selectedDateStr && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
              title="Kosongkan tanggal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
        </div>
      </div>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[300px] max-w-[360px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 animate-in fade-in zoom-in-95 duration-150">
          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 pb-3 dark:border-zinc-800/80">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Pintasan:</span>
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className="px-2 py-1 rounded-md bg-purple-50 text-[11px] font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 transition-colors"
            >
              Hari Ini 23:59
            </button>
            <button
              type="button"
              onClick={() => applyPreset('tomorrow')}
              className="px-2 py-1 rounded-md bg-purple-50 text-[11px] font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 transition-colors"
            >
              Besok 23:59
            </button>
            <button
              type="button"
              onClick={() => applyPreset('plus7')}
              className="px-2 py-1 rounded-md bg-purple-50 text-[11px] font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 transition-colors"
            >
              +7 Hari
            </button>
          </div>

          {/* Calendar Month Header */}
          <div className="flex items-center justify-between pt-3 pb-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {MONTH_NAMES[month]} {year}
            </h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Day Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center py-1">
            {DAY_NAMES.map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-zinc-400">
                {d}
              </span>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 text-center pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            {prevMonthPadding.map((d, idx) => (
              <span key={`prev-${idx}`} className="py-1 text-xs text-zinc-300 dark:text-zinc-700 select-none">
                {d}
              </span>
            ))}
            {currentMonthDays.map((dayNum) => {
              const dateCellStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`
              const isSelected = selectedDateStr === dateCellStr
              const isToday =
                new Date().getFullYear() === year &&
                new Date().getMonth() === month &&
                new Date().getDate() === dayNum

              return (
                <button
                  key={`curr-${dayNum}`}
                  type="button"
                  onClick={() => handleDateSelect(dateCellStr)}
                  className={cn(
                    'py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                    isSelected
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : isToday
                      ? 'border border-purple-400 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                  )}
                >
                  {dayNum}
                </button>
              )
            })}
            {nextMonthPadding.map((d, idx) => (
              <span key={`next-${idx}`} className="py-1 text-xs text-zinc-300 dark:text-zinc-700 select-none">
                {d}
              </span>
            ))}
          </div>

          {/* Time Picker Section */}
          <div className="pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-purple-500" /> Waktu / Jam
              </span>
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <select
                  value={hours || '23'}
                  onChange={(e) => handleTimeSelect(`${e.target.value}:${minutes || '59'}`)}
                  className="bg-transparent text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, i) => pad(i)).map((h) => (
                    <option key={h} value={h} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-zinc-400">:</span>
                <select
                  value={minutes || '59'}
                  onChange={(e) => handleTimeSelect(`${hours || '23'}:${e.target.value}`)}
                  className="bg-transparent text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
                >
                  {Array.from({ length: 60 }, (_, i) => pad(i)).map((m) => (
                    <option key={m} value={m} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Time Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TIME_PRESETS.map((t) => {
                const isActive = selectedTimeStr === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTimeSelect(t)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer',
                      isActive
                        ? 'border-purple-600 bg-purple-600 text-white dark:border-purple-500'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                    )}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-4 flex items-center justify-end gap-2 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition-colors cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" /> Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
