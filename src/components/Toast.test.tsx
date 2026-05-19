import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { Toast } from './Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders message for success type', () => {
    render(<Toast message="Salvo" type="success" onClose={() => {}} />)
    expect(screen.getByText('Salvo')).toBeInTheDocument()
  })

  it('renders message for error type', () => {
    render(<Toast message="Falhou" type="error" onClose={() => {}} />)
    expect(screen.getByText('Falhou')).toBeInTheDocument()
  })

  it('uses green background for success', () => {
    const { container } = render(<Toast message="ok" type="success" onClose={() => {}} />)
    expect((container.firstChild as HTMLElement).className).toContain('bg-green-500')
  })

  it('uses red background for error', () => {
    const { container } = render(<Toast message="x" type="error" onClose={() => {}} />)
    expect((container.firstChild as HTMLElement).className).toContain('bg-red-500')
  })

  it('auto-closes after 5 seconds', () => {
    const onClose = vi.fn()
    render(<Toast message="x" type="success" onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when clicking the close button', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Toast message="x" type="success" onClose={onClose} />,
    )
    const closeBtn = container.querySelector('button') as HTMLButtonElement
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
