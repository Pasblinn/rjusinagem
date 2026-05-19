import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal', () => {
  it('does not render when isOpen=false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="t">
        <div data-testid="inside">x</div>
      </Modal>,
    )
    expect(screen.queryByTestId('inside')).not.toBeInTheDocument()
  })

  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Editar OP">
        <div data-testid="inside">conteudo</div>
      </Modal>,
    )
    expect(screen.getByText('Editar OP')).toBeInTheDocument()
    expect(screen.getByTestId('inside')).toBeInTheDocument()
  })

  it('calls onClose when clicking the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal isOpen onClose={onClose} title="t">
        <div />
      </Modal>,
    )
    await user.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when clicking the backdrop', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <Modal isOpen onClose={onClose} title="t">
        <div />
      </Modal>,
    )
    const backdrop = container.querySelector('div.absolute.inset-0') as HTMLElement
    expect(backdrop).toBeTruthy()
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it.each([
    ['sm', 'max-w-md'],
    ['md', 'max-w-2xl'],
    ['lg', 'max-w-4xl'],
    ['xl', 'max-w-6xl'],
  ] as const)('applies %s size class', (size, klass) => {
    render(
      <Modal isOpen onClose={() => {}} title="t" size={size}>
        <div />
      </Modal>,
    )
    expect(document.querySelector(`.${klass}`)).toBeTruthy()
  })
})
