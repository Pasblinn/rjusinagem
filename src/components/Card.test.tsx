import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card } from './Card'

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <span data-testid="content">conteudo</span>
      </Card>,
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it.each([
    ['none', ''],
    ['sm', 'p-3'],
    ['md', 'p-4'],
    ['lg', 'p-6'],
  ] as const)('applies %s padding', (padding, expectedClass) => {
    const { container } = render(<Card padding={padding}>x</Card>)
    if (expectedClass) {
      expect(container.firstChild).toHaveClass(expectedClass)
    }
  })

  it('becomes clickable when onClick is provided', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<Card onClick={onClick}>x</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('cursor-pointer')
    await user.click(card)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('uses slate-800 surface in dark mode classes', () => {
    const { container } = render(<Card>x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain(
      'dark:bg-slate-800',
    )
  })
})
