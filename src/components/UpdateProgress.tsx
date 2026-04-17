import { useEffect, useState } from 'react'
import { Download, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react'

type UpdateState =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

declare global {
  interface Window {
    electron?: {
      platform?: string
      version?: string
      onUpdateStatus?: (cb: (data: UpdateState) => void) => () => void
      restartAndInstall?: () => Promise<void>
    }
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(1)} ${units[i]}`
}

export function UpdateProgress() {
  const [status, setStatus] = useState<UpdateState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.electron?.onUpdateStatus) return
    const unsubscribe = window.electron.onUpdateStatus((data) => {
      setStatus(data)
      setDismissed(false)
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  if (!status || dismissed) return null
  if (status.state === 'not-available') return null

  const canDismiss = status.state === 'error'

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {status.state === 'checking' && <RefreshCw className="animate-spin text-blue-600" size={22} />}
          {status.state === 'available' && <Download className="text-blue-600" size={22} />}
          {status.state === 'downloading' && <Download className="text-blue-600" size={22} />}
          {status.state === 'downloaded' && <CheckCircle2 className="text-emerald-600" size={22} />}
          {status.state === 'error' && <AlertCircle className="text-red-600" size={22} />}
        </div>

        <div className="flex-1 min-w-0">
          {status.state === 'checking' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-neutral-100">Verificando atualizações…</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Consultando GitHub Releases.</p>
            </>
          )}

          {status.state === 'available' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-neutral-100">Nova versão disponível</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">v{status.version} — iniciando download…</p>
            </>
          )}

          {status.state === 'downloading' && (
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900 dark:text-neutral-100">Baixando atualização</p>
                <span className="text-sm font-bold text-blue-600">
                  {Math.round(status.percent)}%
                </span>
              </div>
              <div className="mt-2 w-full h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-200 ease-out"
                  style={{ width: `${status.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400 mt-2">
                <span>
                  {formatBytes(status.transferred)} / {formatBytes(status.total)}
                </span>
                <span>{formatBytes(status.bytesPerSecond)}/s</span>
              </div>
            </>
          )}

          {status.state === 'downloaded' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-neutral-100">Atualização pronta</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                v{status.version} foi baixada. Reinicie para aplicar.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => window.electron?.restartAndInstall?.()}
                  className="flex-1 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Reiniciar agora
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-2 text-sm font-medium border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-lg hover:border-gray-300 dark:hover:border-neutral-600"
                >
                  Depois
                </button>
              </div>
            </>
          )}

          {status.state === 'error' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-neutral-100">Erro ao atualizar</p>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1 break-words">{status.message}</p>
            </>
          )}
        </div>

        {canDismiss && (
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
