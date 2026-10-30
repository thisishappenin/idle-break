import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('idleReset', {
  undo: () => ipcRenderer.send('undo-idle-reset'),
  dismiss: () => ipcRenderer.send('dismiss-idle-reset')
})
