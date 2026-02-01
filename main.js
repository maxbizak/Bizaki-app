const { app, BrowserWindow, BrowserView, session, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");

const TOPBAR_H = 48;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#0b0f17",
        frame: false,
        webPreferences: {
            contextIsolation: true,
            sandbox: true
        }
    });

    // Разрешения на микрофон/камеру/медиа (WebRTC/getUserMedia)
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
        if (permission === "media" || permission === "microphone" || permission === "camera") {
            return callback(true);
        }
        callback(false);
    });

    // Topbar (кастомный верхний бар)
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

    // Основной контент (сайт)
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
        topView.setBounds({ x: 0, y: 0, width: w, height: TOPBAR_H });
        contentView.setBounds({ x: 0, y: TOPBAR_H, width: w, height: h - TOPBAR_H });
    };

    win.on("resize", layout);

    // Для правильной иконки "развернуть/восстановить" в topbar
    win.on("maximize", () => topView.webContents.send("win:maximized", true));
    win.on("unmaximize", () => topView.webContents.send("win:maximized", false));

    // Кнопки окна из topbar
    ipcMain.on("win:min", () => win.minimize());
    ipcMain.on("win:max", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
    ipcMain.on("win:close", () => win.close());

    // ---------- AUTO UPDATE ----------
    // Логи автоапдейта: %AppData%/BIZAKI/logs/...
    log.transports.file.level = "info";
    autoUpdater.logger = log;

    const sendUpdate = (payload) => {
        try {
            topView.webContents.send("update:status", payload);
        } catch { }
    };

    autoUpdater.on("checking-for-update", () => sendUpdate({ state: "checking" }));
    autoUpdater.on("update-available", (info) => sendUpdate({ state: "available", info }));
    autoUpdater.on("update-not-available", (info) => sendUpdate({ state: "none", info }));
    autoUpdater.on("download-progress", (p) =>
        sendUpdate({
            state: "downloading",
            percent: p.percent,
            bytesPerSecond: p.bytesPerSecond,
            transferred: p.transferred,
            total: p.total
        })
    );
    autoUpdater.on("update-downloaded", (info) => sendUpdate({ state: "ready", info }));
    autoUpdater.on("error", (err) =>
        sendUpdate({ state: "error", message: err?.message || String(err) })
    );

    // Команда из UI: “Установить и перезапустить”
    ipcMain.on("update:install", () => {
        autoUpdater.quitAndInstall();
    });

    // Важно: autoUpdater работает нормально только в packaged (установленное приложение)
    if (app.isPackaged) {
        autoUpdater.autoDownload = true;

        // Проверка при запуске
        autoUpdater.checkForUpdatesAndNotify().catch(() => { });

        // Периодическая проверка (опционально)
        setInterval(() => {
            autoUpdater.checkForUpdates().catch(() => { });
        }, 6 * 60 * 60 * 1000); // каждые 6 часов
    } else {
        sendUpdate({ state: "dev", message: "Auto-update disabled (not packaged)" });
    }
    // -------------------------------

    layout();
}

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
