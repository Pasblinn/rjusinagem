import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext'

function ThemeReadout() {
  const { theme, toggleTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button data-testid="toggle" onClick={toggleTheme}>
        toggle
      </button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        set dark
      </button>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        set light
      </button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to light when no localStorage entry', () => {
    render(
      <ThemeProvider>
        <ThemeReadout />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('restores theme from localStorage on mount', () => {
    window.localStorage.setItem('rj-theme', 'dark')
    render(
      <ThemeProvider>
        <ThemeReadout />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('ignores invalid localStorage values', () => {
    window.localStorage.setItem('rj-theme', 'banana' as unknown as string)
    render(
      <ThemeProvider>
        <ThemeReadout />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('toggleTheme flips between light and dark', () => {
    render(
      <ThemeProvider>
        <ThemeReadout />
      </ThemeProvider>,
    )
    const toggle = screen.getByTestId('toggle')
    expect(screen.getByTestId('theme').textContent).toBe('light')
    act(() => toggle.click())
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    act(() => toggle.click())
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('persists theme changes to localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeReadout />
      </ThemeProvider>,
    )
    act(() => screen.getByTestId('set-dark').click())
    expect(window.localStorage.getItem('rj-theme')).toBe('dark')
    act(() => screen.getByTestId('set-light').click())
    expect(window.localStorage.getItem('rj-theme')).toBe('light')
  })

  it('useTheme throws when used outside ThemeProvider', () => {
    const orig = console.error
    console.error = () => {}
    expect(() => render(<ThemeReadout />)).toThrow(/ThemeProvider/)
    console.error = orig
  })
})
