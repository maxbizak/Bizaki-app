const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bizaki", {
    // window controls
    min: () => ipcRenderer.send("win:min"),
    max: () => ipcRenderer.send("win:max"),
    close: () => ipcRenderer.send("win:close"),

    // updater controls
    installUpdate: () => ipcRenderer.send("update:install"),

    // events
    onMaximized: (cb) => {
        ipcRenderer.removeAllListeners("win:maximized");
        ipcRenderer.on("win:maximized", (_e, isMaximized) => cb(Boolean(isMaximized)));
    },

    onUpdateStatus: (cb) => {
        ipcRenderer.removeAllListeners("update:status");
        ipcRenderer.on("update:status", (_e, payload) => cb(payload));
    }
});
