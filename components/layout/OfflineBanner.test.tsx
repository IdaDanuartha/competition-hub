import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OfflineBanner } from './OfflineBanner'

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
})

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const { container } = render(<OfflineBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an offline indicator when the offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    render(<OfflineBanner />)
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })
})
