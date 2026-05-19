import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/supabase', () => {
  type Listener = (event: string, session: unknown) => void
  let _listener: Listener | null = null
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn((cb: Listener) => {
      _listener = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  }
  const from = vi.fn()
  return {
    supabase: {
      auth,
      from,
      _emit: (session: unknown) => _listener?.('SIGNED_IN', session),
    },
  }
})

import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '@/services/supabase'

function AuthReadout() {
  const { user, loading, hasPermission, signOut } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="user">{user?.nome ?? 'none'}</span>
      <span data-testid="role">{user?.role ?? 'none'}</span>
      <span data-testid="fin">{String(hasPermission('financeiro'))}</span>
      <span data-testid="che">{String(hasPermission('chefe'))}</span>
      <span data-testid="ope">{String(hasPermission('operador'))}</span>
      <button data-testid="signout" onClick={() => void signOut()}>
        signout
      </button>
    </div>
  )
}

describe('AuthContext.hasPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false for everything when no user', async () => {
    render(
      <AuthProvider>
        <AuthReadout />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('no'))
    expect(screen.getByTestId('fin').textContent).toBe('false')
    expect(screen.getByTestId('che').textContent).toBe('false')
    expect(screen.getByTestId('ope').textContent).toBe('false')
  })

  it.each([
    ['financeiro', { fin: 'true', che: 'true', ope: 'true' }],
    ['chefe',      { fin: 'false', che: 'true', ope: 'true' }],
    ['operador',   { fin: 'false', che: 'false', ope: 'true' }],
  ])('grants permissions correctly for role %s', async (role, expected) => {
    const userRow = { id: 'u1', email: 'x@y', nome: 'Z', role, created_at: '' }
    const singleMock = vi.fn().mockResolvedValue({ data: userRow, error: null })
    const eqMock = vi.fn().mockReturnValue({ single: singleMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    ;(supabase.from as any).mockReturnValue({ select: selectMock })
    ;(supabase.auth.getSession as any).mockResolvedValueOnce({
      data: { session: { user: { id: 'u1' } } },
    })

    render(
      <AuthProvider>
        <AuthReadout />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe(role))
    expect(screen.getByTestId('fin').textContent).toBe(expected.fin)
    expect(screen.getByTestId('che').textContent).toBe(expected.che)
    expect(screen.getByTestId('ope').textContent).toBe(expected.ope)
  })

  it('clears user on signOut', async () => {
    const userRow = { id: 'u1', email: 'x@y', nome: 'Z', role: 'financeiro', created_at: '' }
    const singleMock = vi.fn().mockResolvedValue({ data: userRow, error: null })
    const eqMock = vi.fn().mockReturnValue({ single: singleMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    ;(supabase.from as any).mockReturnValue({ select: selectMock })
    ;(supabase.auth.getSession as any).mockResolvedValueOnce({
      data: { session: { user: { id: 'u1' } } },
    })

    render(
      <AuthProvider>
        <AuthReadout />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Z'))

    await act(async () => {
      screen.getByTestId('signout').click()
    })
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'))
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
