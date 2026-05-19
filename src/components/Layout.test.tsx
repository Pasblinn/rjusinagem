import { describe, it, expect, vi, beforeEach } from 'vitest'

const signOutMock = vi.fn().mockResolvedValue(undefined)
let currentRole: 'financeiro' | 'chefe' | 'operador' = 'financeiro'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'x@y', nome: 'Pablo', role: currentRole, created_at: '' },
    signOut: signOutMock,
    hasPermission: (p: 'financeiro' | 'chefe' | 'operador') => {
      if (p === 'financeiro') return currentRole === 'financeiro'
      if (p === 'chefe') return currentRole === 'financeiro' || currentRole === 'chefe'
      return true
    },
  }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { ThemeProvider } from '@/contexts/ThemeContext'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider>
        <Layout>
          <div data-testid="page">conteudo</div>
        </Layout>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentRole = 'financeiro'
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('renders user info, children and nav', () => {
    renderLayout()
    expect(screen.getByText('Pablo')).toBeInTheDocument()
    expect(screen.getByText('financeiro')).toBeInTheDocument()
    expect(screen.getByText('RJ Usinagem')).toBeInTheDocument()
    expect(screen.getByTestId('page')).toBeInTheDocument()
    expect(screen.getByText('Ordens de Produção')).toBeInTheDocument()
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
  })

  it('hides "Financeiro" nav item when user is not financeiro', () => {
    currentRole = 'operador'
    renderLayout()
    expect(screen.getByText('Ordens de Produção')).toBeInTheDocument()
    expect(screen.queryByText('Financeiro')).not.toBeInTheDocument()
  })

  it('signs out and navigates to /login', async () => {
    const user = userEvent.setup()
    renderLayout()
    await user.click(screen.getByRole('button', { name: /sair/i }))
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('toggles dark mode via the theme button', async () => {
    const user = userEvent.setup()
    renderLayout()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    await user.click(screen.getByLabelText('Mudar para tema escuro'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await user.click(screen.getByLabelText('Mudar para tema claro'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
