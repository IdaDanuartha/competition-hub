'use client'

import { useState, useEffect } from 'react'

const LOCAL_STORAGE_KEY = 'preferred_ai_model'

export function usePreferredModel(initialDefault = 'gemini-3.6-flash') {
  const [selectedModel, setSelectedModelState] = useState<string>(initialDefault)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (saved) {
        setSelectedModelState(saved)
      }
    }
  }, [])

  const setSelectedModel = (model: string) => {
    setSelectedModelState(model)
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, model)
    }
  }

  return [selectedModel, setSelectedModel] as const
}
