import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Textarea } from './Textarea'

describe('Textarea', () => {
  it('renders label and error', () => {
    render(<Textarea label="Obs" error="campo invalido" />)
    expect(screen.getByText('Obs')).toBeInTheDocument()
    expect(screen.getByText('campo invalido')).toBeInTheDocument()
    expect(screen.getByRole('textbox').className).toContain('border-red-500')
  })

  it('accepts user typing', async () => {
    function Wrapper() {
      const [v, setV] = useState('')
      return <Textarea value={v} onChange={(e) => setV(e.target.value)} placeholder="p" />
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    const ta = screen.getByPlaceholderText('p') as HTMLTextAreaElement
    await user.type(ta, 'linha 1')
    expect(ta.value).toBe('linha 1')
  })
})
