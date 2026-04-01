import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, FileText, DollarSign } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './Button'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, hasPermission } = useAuth()
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md border-b-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RJ Usinagem</h1>
              <p className="text-sm text-gray-600 mt-1">Sistema de Gestão de Produção</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold text-gray-900">{user?.nome}</p>
                <p className="text-sm text-gray-600 capitalize">{user?.role}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut size={20} className="inline mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2">
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors border-b-4
                    ${isActive
                      ? 'text-blue-600 border-blue-600 bg-blue-50'
                      : 'text-gray-600 border-transparent hover:text-blue-600 hover:bg-gray-50'
                    }`}
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
