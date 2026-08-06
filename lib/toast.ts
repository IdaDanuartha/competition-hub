'use client'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
const listeners: Set<Listener> = new Set()

function notify() {
  listeners.forEach((listener) => listener([...toasts]))
}

export const toast = {
  success: (message: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    toasts = [...toasts, { id, type: 'success', message }]
    notify()
    setTimeout(() => toast.dismiss(id), 4000)
  },
  error: (message: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    toasts = [...toasts, { id, type: 'error', message }]
    notify()
    setTimeout(() => toast.dismiss(id), 5000)
  },
  info: (message: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    toasts = [...toasts, { id, type: 'info', message }]
    notify()
    setTimeout(() => toast.dismiss(id), 4000)
  },
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  },
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener)
  listener([...toasts])
  return () => {
    listeners.delete(listener)
  }
}
