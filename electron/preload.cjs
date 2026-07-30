const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('anleo', {
  isElectron: true,
  openDialog: (opts) => ipcRenderer.invoke('dialog:open', opts),
  saveDialog: (opts) => ipcRenderer.invoke('dialog:save', opts),
  savePathDialog: (opts) => ipcRenderer.invoke('dialog:save-path', opts),
  exportPdf: (opts) => ipcRenderer.invoke('export:pdf', opts),
  readFile: (opts) => ipcRenderer.invoke('file:read', opts),
  writeFile: (opts) => ipcRenderer.invoke('file:write', opts),
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', { key, value }),
  // The OpenRouter key never travels through the plaintext store.
  secretGet: () => ipcRenderer.invoke('secret:get'),
  secretSet: (value) => ipcRenderer.invoke('secret:set', value),
  securityStatus: () => ipcRenderer.invoke('security:status'),
  fontsSave: (name, data) => ipcRenderer.invoke('fonts:save', { name, data }),
  fontsList: () => ipcRenderer.invoke('fonts:list'),
  fontsDelete: (name) => ipcRenderer.invoke('fonts:delete', name),
  appVersion: () => ipcRenderer.invoke('app:version'),
  onMenu: (cb) => {
    ipcRenderer.on('anleo:menu', (_e, action) => cb(action))
  },
  onOpenPath: (cb) => {
    ipcRenderer.on('anleo:open-path', (_e, p) => cb(p))
  },
})
