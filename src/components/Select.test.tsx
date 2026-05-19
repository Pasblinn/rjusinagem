import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Select } from './Select'

const OPTIONS = [
  { value: 'a', label: 'Opcao A' },
  { value: 'b', label: 'Opcao B' },
  { value: 'c', label: 'Opcao C' },
]

describe('Select', () => {
  it('renders all options', () => {
    render(<Select options={OPTIONS} label="Categoria" />)
    expect(screen.getByText('Opcao A')).toBeInTheDocument()
    expect(screen.getByText('Opcao B')).toBeInTheDocument()
    expect(screen.getByText('Opcao C')).toBeInTheDocument()
  })

  it('shows label and error', () => {
    render(<Select options={OPTIONS} label="Categoria" error="Escolha uma" />)
    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Escolha uma')).toBeInTheDocument()
  })

  it('updates value via user selection', async () => {
    function Wrapper() {
      const [v, setV] = useState('a')
      return (
        <Select
          options={OPTIONS}
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
      )
    }
    const user = userEvent.setup()
    render(<Wrapper />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await user.selectOptions(select, 'b')
    expect(select.value).toBe('b')
  })
})
