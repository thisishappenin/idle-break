import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('toast', {
  action: () => ipcRenderer.send('toast-action'),
  dismiss: () => ipcRenderer.send('toast-dismiss')
})
