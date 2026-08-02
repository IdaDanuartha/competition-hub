import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationLog } from './NotificationLog'
import type { NotificationLog as NotificationLogType } from '@/lib/types/database'

function log(overrides: Partial<NotificationLogType>): NotificationLogType {
  return {
    id: '1', rundown_item_id: 'r1', channel: 'whatsapp', message: 'Reminder: Briefing in 1 day',
    status: 'sent', attempt_count: 1, sent_at: '2026-02-28T09:00:00Z', ...overrides,
  }
}

describe('NotificationLog', () => {
  it('shows a failed badge for failed sends', () => {
    render(<NotificationLog logs={[log({ status: 'failed' })]} />)
    expect(screen.getByText(/failed/i)).toBeInTheDocument()
  })

  it('shows an empty state', () => {
    render(<NotificationLog logs={[]} />)
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
  })
})
