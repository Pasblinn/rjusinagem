const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const log = require('electron-log')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development'

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
    backgroundColor: '#ffffff'
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// ═══════════════════════════════════════════════════════════
// Auto Update - busca atualizações do GitHub Releases
// ═══════════════════════════════════════════════════════════
function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    log.info('Verificando atualizações...')
  })

  autoUpdater.on('update-available', (info) => {
    log.info('Atualização disponível:', info.version)
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Atualização disponível',
      message: `Nova versão ${info.version} encontrada. O download será feito automaticamente.`,
      buttons: ['OK']
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('Nenhuma atualização disponível. Versão atual:', app.getVersion())
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download: ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Atualização baixada:', info.version)
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Atualização pronta',
      message: `A versão ${info.version} foi baixada. O aplicativo será reiniciado para aplicar a atualização.`,
      buttons: ['Reiniciar agora', 'Mais tarde']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('error', (err) => {
    log.error('Erro no auto-updater:', err)
  })

  // Verificar atualizações ao abrir
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('Falha ao verificar atualizações:', err)
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
