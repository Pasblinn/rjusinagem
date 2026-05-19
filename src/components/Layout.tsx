import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, FileText, DollarSign, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from './Button'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, hasPermission } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/', label: 'Ordens de Produção', icon: FileText, show: true },
    { path: '/financeiro', label: 'Financeiro', icon: DollarSign, show: hasPermission('financeiro') },
  ]

  const isDark = theme === 'dark'

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-600 dark:bg-sky-500 flex items-center justify-center text-white font-bold text-sm">
                RJ
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-tight">RJ Usinagem</h1>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-tight">Gestão de Produção</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 leading-tight">{user?.nome}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 capitalize leading-tight">{user?.role}</p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                title={isDark ? 'Tema claro' : 'Tema escuro'}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut size={14} />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2
                    ${isActive
                      ? 'text-blue-600 dark:text-sky-400 border-blue-600 dark:border-sky-400'
                      : 'text-gray-600 dark:text-slate-400 border-transparent hover:text-gray-900 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}
