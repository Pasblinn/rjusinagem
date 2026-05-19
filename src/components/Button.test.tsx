import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })

  it('invokes onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Click</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not invoke onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button onClick={onClick} disabled>
        Click
      </Button>,
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each([
    ['primary', 'bg-blue-600'],
    ['secondary', 'bg-gray-100'],
    ['success', 'bg-emerald-600'],
    ['danger', 'bg-red-600'],
    ['outline', 'border-gray-300'],
  ] as const)('applies %s variant classes', (variant, expectedClass) => {
    render(<Button variant={variant}>x</Button>)
    expect(screen.getByRole('button').className).toContain(expectedClass)
  })

  it.each([
    ['sm', 'px-3'],
    ['md', 'px-4'],
    ['lg', 'px-5'],
  ] as const)('applies %s size classes', (size, expectedClass) => {
    render(<Button size={size}>x</Button>)
    expect(screen.getByRole('button').className).toContain(expectedClass)
  })

  it('applies fullWidth class', () => {
    render(<Button fullWidth>x</Button>)
    expect(screen.getByRole('button').className).toContain('w-full')
  })

  it('forwards arbitrary props (type, aria-label)', () => {
    render(
      <Button type="submit" aria-label="enviar">
        x
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'enviar' })
    expect(btn).toHaveAttribute('type', 'submit')
  })
})
