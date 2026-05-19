import React, { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'

// Telas pesadas / pouco usadas: lazy load para reduzir o boot.
// Financeiro.tsx sozinho tem 3.4k linhas e arrasta jspdf + docx + html2canvas.
const OrdemProducaoForm = lazy(() =>
  import('./pages/OrdemProducaoForm').then((m) => ({ default: m.OrdemProducaoForm })),
)
const OrdemProducaoDetalhes = lazy(() =>
  import('./pages/OrdemProducaoDetalhes').then((m) => ({ default: m.OrdemProducaoDetalhes })),
)
const Financeiro = lazy(() =>
  import('./pages/Financeiro').then((m) => ({ default: m.Financeiro })),
)
const PontoMobile = lazy(() =>
  import('./pages/PontoMobile').then((m) => ({ default: m.PontoMobile })),
)
const UpdateProgress = lazy(() =>
  import('./components/UpdateProgress').then((m) => ({ default: m.UpdateProgress })),
)

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-slate-900">
      <p className="text-gray-600 dark:text-slate-400 text-lg">Carregando...</p>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <PageFallback />
  return user ? <>{children}</> : <Navigate to="/login" />
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  )
}

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <AppRoutes />
          <Suspense fallback={null}>
            <UpdateProgress />
          </Suspense>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
