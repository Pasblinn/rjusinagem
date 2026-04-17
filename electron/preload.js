const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  version: process.versions.electron,
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
  restartAndInstall: () => ipcRenderer.invoke('update-install'),
})
