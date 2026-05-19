import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Input } from './Input'

describe('Input', () => {
  it('renders label when provided', () => {
    render(<Input label="Nome" />)
    expect(screen.getByText('Nome')).toBeInTheDocument()
  })

  it('renders without label', () => {
    render(<Input placeholder="digite" />)
    expect(screen.getByPlaceholderText('digite')).toBeInTheDocument()
  })

  it('shows error message and applies error border', () => {
    render(<Input label="Nome" error="Obrigatório" />)
    expect(screen.getByText('Obrigatório')).toBeInTheDocument()
    expect(screen.getByRole('textbox').className).toContain('border-red-500')
  })

  it('updates value via user typing (controlled)', async () => {
    function Wrapper() {
      const [v, setV] = useState('')
      return <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="x" />
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    const input = screen.getByPlaceholderText('x')
    await user.type(input, 'abc')
    expect((input as HTMLInputElement).value).toBe('abc')
  })

  it('forwards disabled state', () => {
    render(<Input disabled placeholder="x" />)
    expect(screen.getByPlaceholderText('x')).toBeDisabled()
  })
})
