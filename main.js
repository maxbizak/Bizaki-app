const { app, BrowserWindow, BrowserView, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const TOPBAR_H = 48;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#0b0f17",

        // ВАЖНО: убираем системный заголовок и иконку слева
        frame: false,

        webPreferences: {
            contextIsolation: true,
            sandbox: true
        }
    });

    // Разрешаем микрофон/камера
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
        if (permission === "media" || permission === "microphone" || permission === "camera") {
            return callback(true);
        }
        callback(false);
    });

    // ----- Topbar view (наш заголовок как Discord) -----
    const topView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, "preload-topbar.js")
        }
    });

    win.setBrowserView(topView);
    topView.setAutoResize({ width: true });

    topView.webContents.loadFile(path.join(__dirname, "topbar.html"));

    // ----- Content view (твой сайт) -----
    const contentView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            sandbox: true
        }
    });

    win.addBrowserView(contentView);
    contentView.setAutoResize({ width: true, height: true });
    contentView.webContents.loadURL("https://bizaki.online");

    const layout = () => {
        const [w, h] = win.getContentSize();

        // topbar
        topView.setBounds({ x: 0, y: 0, width: w, height: TOPBAR_H });

        // content below
        contentView.setBounds({ x: 0, y: TOPBAR_H, width: w, height: h - TOPBAR_H });
    };

    win.on("resize", layout);
    win.on("maximize", () => topView.webContents.send("win:maximized", true));
    win.on("unmaximize", () => topView.webContents.send("win:maximized", false));

    layout();

    // обработка команд из topbar
    const { ipcMain } = require("electron");

    ipcMain.on("win:min", () => win.minimize());
    ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
    ipcMain.on("win:close", () => win.close());
}

app.whenReady().then(() => {
    createWindow();

    // автообновление (GitHub Releases)
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => { });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
