import { describe, it, expect } from 'vitest'
import { STATUS_ORDER, statusLabel, statusColorClass, statusProgress } from './status'

describe('STATUS_ORDER', () => {
  it('has 8 statuses ending in cancelled', () => {
    expect(STATUS_ORDER).toHaveLength(8)
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe('cancelled')
  })
})

describe('statusLabel', () => {
  it('renders a human label', () => {
    expect(statusLabel('in_progress')).toBe('In Progress')
    expect(statusLabel('not_selected')).toBe('Not Selected')
  })
})

describe('statusColorClass', () => {
  it('maps researching to blue and cancelled to red', () => {
    expect(statusColorClass('researching')).toContain('blue')
    expect(statusColorClass('submitted')).toContain('indigo')
    expect(statusColorClass('cancelled')).toContain('red')
  })
})


describe('statusProgress', () => {
  it('returns stage 1 of 6 for researching (not_selected excluded from the ladder)', () => {
    expect(statusProgress('researching')).toEqual({ stage: 1, total: 6 })
  })
  it('returns stage 6 of 6 for completed', () => {
    expect(statusProgress('completed')).toEqual({ stage: 6, total: 6 })
  })
  it('treats not_selected as a terminal stage equal to its position when it dropped out', () => {
    expect(statusProgress('not_selected').total).toBe(6)
  })
})
