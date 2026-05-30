const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const log = require('electron-log')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development'

// Tela branca ao abrir em alguns PCs Windows (GPU integrada / drivers de video
// antigos) e um bug classico do Electron: a aceleracao de hardware falha e o
// Chromium renderiza uma tela em branco. Desabilitar a aceleracao forca a
// renderizacao por software, que e universalmente compativel. Em um app de
// gestao (sem 3D/video pesado) o impacto de performance e irrelevante.
if (!isDev) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
}

// Configurar logs do auto-updater
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
log.info('App iniciando...')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    backgroundColor: '#fafafa'
  })

  // Diagnostico de falhas do renderer. Sem isto, uma tela branca nao deixa
  // nenhum rastro nos logs — foi o que cegou as tentativas anteriores. Tudo vai
  // para o electron-log (userData/logs), acessivel no proprio PC do cliente.
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log.error('Renderer did-fail-load:', code, desc, url)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('Renderer process gone:', details)
  })
  mainWindow.webContents.on('preload-error', (_e, file, error) => {
    log.error('Preload error:', file, error)
  })
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    log.info(`Renderer console [${level}] ${message} (${sourceId}:${line})`)
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow
      .loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
      .catch((err) => log.error('Falha ao carregar index.html:', err))
  }
}

// Menu mínimo para habilitar atalhos Ctrl+C/V/X/Z/A e pesquisa inputs
Menu.setApplicationMenu(
  Menu.buildFromTemplate([
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer', accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo', label: 'Refazer', accelerator: 'CmdOrCtrl+Y' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar', accelerator: 'CmdOrCtrl+X' },
        { role: 'copy', label: 'Copiar', accelerator: 'CmdOrCtrl+C' },
        { role: 'paste', label: 'Colar', accelerator: 'CmdOrCtrl+V' },
        { role: 'selectAll', label: 'Selecionar tudo', accelerator: 'CmdOrCtrl+A' },
      ],
    },
  ])
)

// ═══════════════════════════════════════════════════════════
// Auto Update - busca atualizações do GitHub Releases
// ═══════════════════════════════════════════════════════════
function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', payload)
  }
}

function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    log.info('Verificando atualizações...')
    sendUpdateStatus({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    log.info('Atualização disponível:', info.version)
    sendUpdateStatus({ state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('Nenhuma atualização disponível. Versão atual:', app.getVersion())
    sendUpdateStatus({ state: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download: ${Math.round(progress.percent)}%`)
    sendUpdateStatus({
      state: 'downloading',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Atualização baixada:', info.version)
    sendUpdateStatus({ state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    log.error('Erro no auto-updater:', err)
    sendUpdateStatus({ state: 'error', message: err.message || String(err) })
  })

  ipcMain.handle('update-install', () => {
    autoUpdater.quitAndInstall()
  })

  // Verificar atualizações ao abrir
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('Falha ao verificar atualizações:', err)
    sendUpdateStatus({ state: 'error', message: err.message || String(err) })
  })
}

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
