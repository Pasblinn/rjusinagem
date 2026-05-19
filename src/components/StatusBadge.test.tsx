import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  describe('type=producao', () => {
    it.each([
      ['criada', 'Criada'],
      ['em_producao', 'Em Produção'],
      ['pausada', 'Pausada'],
      ['finalizada', 'Finalizada'],
      ['cancelada', 'Cancelada'],
    ])('renders label for %s', (status, label) => {
      render(<StatusBadge status={status} type="producao" />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('type=financeiro', () => {
    it.each([
      ['pendente', 'Pendente'],
      ['parcial', 'Parcial'],
      ['pago', 'Pago'],
      ['atrasado', 'Atrasado'],
      ['cancelado', 'Cancelado'],
    ])('renders label for %s', (status, label) => {
      render(<StatusBadge status={status} type="financeiro" />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('type=payment (legado)', () => {
    it.each([
      ['pago', 'PAGO'],
      ['nao_pago', 'NÃO PAGO'],
      ['pendente', 'PENDENTE'],
      ['parcial', 'PARCIAL'],
      ['atrasado', 'ATRASADO'],
    ])('renders uppercase label for %s', (status, label) => {
      render(<StatusBadge status={status} type="payment" />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('type=op (default)', () => {
    it.each([
      ['criada', 'Criada'],
      ['em_producao', 'Em Produção'],
      ['finalizada', 'Finalizada'],
      ['faturada', 'Faturada'],
      ['nota_emitida', 'Nota Emitida'],
      ['paga', 'Paga'],
    ])('renders label for %s', (status, label) => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('falls back to raw status for unknown values', () => {
    render(<StatusBadge status="desconhecido" type="producao" />)
    expect(screen.getByText('desconhecido')).toBeInTheDocument()
  })

  it('uses slate palette in dark classes', () => {
    const { container } = render(<StatusBadge status="criada" type="producao" />)
    expect(container.firstChild?.textContent).toBe('Criada')
    expect((container.firstChild as HTMLElement).className).toMatch(/dark:bg-slate-/)
  })
})
