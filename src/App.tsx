import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { OrdemProducaoForm } from './pages/OrdemProducaoForm'
import { OrdemProducaoDetalhes } from './pages/OrdemProducaoDetalhes'
import { Financeiro } from './pages/Financeiro'
import { PontoMobile } from './pages/PontoMobile'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 text-lg">Carregando...</p>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" />
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Rota pública - Ponto Eletrônico Mobile (sem autenticação) */}
      <Route path="/ponto/:token" element={<PontoMobile />} />

      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/op/nova"
        element={
          <PrivateRoute>
            <OrdemProducaoForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/op/:id"
        element={
          <PrivateRoute>
            <OrdemProducaoDetalhes />
          </PrivateRoute>
        }
      />
      <Route
        path="/op/:id/editar"
        element={
          <PrivateRoute>
            <OrdemProducaoForm />
          </PrivateRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <PrivateRoute>
            <Financeiro />
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}

export default App
