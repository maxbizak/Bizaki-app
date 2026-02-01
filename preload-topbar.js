const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bizakiWin", {
    minimize: () => ipcRenderer.send("win:min"),
    maximize: () => ipcRenderer.send("win:max"),
    close: () => ipcRenderer.send("win:close"),
    onMaximizedChanged: (cb) => {
        ipcRenderer.on("win:maximized", (_, v) => cb(!!v));
    }
});
